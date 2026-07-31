/* Cut the site over to the custom domain.
 *
 *   node tools/go-live.js --check     just report whether DNS is ready
 *   node tools/go-live.js             make the change (refuses if DNS is not ready)
 *   node tools/go-live.js --force     make the change anyway
 *
 * Does three things, all of which must happen together or link previews break:
 *   1. writes CNAME, which is how GitHub Pages is told the custom domain
 *   2. rewrites the absolute og:url / og:image / twitter:image on both pages
 *   3. reports what to check afterwards
 *
 * Deliberately NOT run before the DNS change: setting the custom domain makes
 * <user>.github.io redirect to the domain, so doing it early would send anyone
 * reviewing the preview link to whatever is still answering there.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DOMAIN = 'nexus-spaceport.com';
const OLD_BASE = 'https://manaeswolf.github.io/nexus-spaceport-site';
const NEW_BASE = `https://${DOMAIN}`;
const GH_IPS = ['185.199.108.153', '185.199.109.153', '185.199.110.153', '185.199.111.153'];

const args = process.argv.slice(2);
const CHECK_ONLY = args.includes('--check');
const FORCE = args.includes('--force');

/* Uses Resolve-DnsName rather than node's dns.resolve*, which talks to whatever
   DNS server is configured and fails outright if that is unreachable. This asks
   Windows, which is what the rest of the machine uses. */
function query(name, type) {
  try {
    const ps =
      `$r = Resolve-DnsName -Name '${name}' -Type ${type} -DnsOnly -ErrorAction SilentlyContinue | ` +
      `Where-Object { $_.QueryType -eq '${type}' }; ` +
      `$out = @($r | ForEach-Object { if ($_.IPAddress) { $_.IPAddress } elseif ($_.NameHost) { $_.NameHost } elseif ($_.NameExchange) { $_.NameExchange } }); ` +
      `ConvertTo-Json -Compress -InputObject @($out)`;
    const raw = execFileSync('powershell', ['-NoProfile', '-Command', ps],
      { encoding: 'utf8', windowsHide: true }).trim();
    if (!raw) return [];
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter(Boolean) : [v].filter(Boolean);
  } catch (e) { return []; }
}

function dnsReady() {
  const out = { apex: [], www: null, mx: [], apexOk: false, wwwOk: false };
  out.apex = query(DOMAIN, 'A');
  out.www = query('www.' + DOMAIN, 'CNAME')[0] || null;
  out.mx = query(DOMAIN, 'MX');
  out.apexOk = out.apex.length > 0 && out.apex.every(ip => GH_IPS.includes(ip));
  out.wwwOk = !!out.www && /\.github\.io\.?$/i.test(out.www);
  return out;
}

(() => {
  const d = dnsReady();
  console.log(`\nDNS for ${DOMAIN}`);
  console.log(`  apex A   : ${d.apex.join(', ') || '(none)'}   ${d.apexOk ? 'points at GitHub' : 'NOT GitHub yet'}`);
  console.log(`  www      : ${d.www || '(none)'}   ${d.wwwOk ? 'points at GitHub' : 'NOT GitHub yet'}`);
  console.log(`  MX       : ${d.mx.length} record(s) — ${d.mx.some(m => /one\.com$/.test(m)) ? 'still one.com, email intact' : 'CHECK THIS, email may be affected'}`);

  if (CHECK_ONLY) {
    console.log(`\n${d.apexOk && d.wwwOk ? 'Ready to cut over: run  node tools/go-live.js' : 'Not ready yet. Change the DNS at one.com first.'}\n`);
    process.exit(d.apexOk && d.wwwOk ? 0 : 1);
  }

  if (!(d.apexOk && d.wwwOk) && !FORCE) {
    console.error('\nRefusing to cut over: DNS does not point at GitHub yet.');
    console.error('Setting the custom domain now would redirect the preview link to whatever');
    console.error('is still answering on the domain. Change the DNS first, or pass --force.\n');
    process.exit(1);
  }

  /* 1. CNAME — this is what tells Pages the custom domain */
  fs.writeFileSync(path.join(ROOT, 'CNAME'), DOMAIN + '\n', 'utf8');
  console.log(`\n  wrote CNAME -> ${DOMAIN}`);

  /* 2. absolute URLs in the two pages */
  let changed = 0;
  for (const rel of ['index.html', 'news/index.html']) {
    const p = path.join(ROOT, rel);
    let s = fs.readFileSync(p, 'utf8');
    const n = s.split(OLD_BASE).length - 1;
    if (!n) { console.log(`  ${rel}: no absolute URLs to change`); continue; }
    s = s.split(OLD_BASE).join(NEW_BASE);
    fs.writeFileSync(p, s, 'utf8');
    changed += n;
    console.log(`  ${rel}: rewrote ${n} absolute URL(s)`);
  }

  /* 3. report anything still pointing at the old host */
  const stragglers = [];
  for (const rel of ['index.html', 'news/index.html', 'README.md', 'assets/site.js', 'assets/site.css']) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) continue;
    const s = fs.readFileSync(p, 'utf8');
    if (s.includes('manaeswolf.github.io')) stragglers.push(rel);
  }

  console.log(`\n  ${changed} URL(s) updated in total`);
  if (stragglers.length) console.log(`  still mention the old host (fine in prose, check anyway): ${stragglers.join(', ')}`);

  console.log(`\nNext:`);
  console.log(`  1. git add -A && git commit -m "Cut over to nexus-spaceport.com" && git push`);
  console.log(`  2. In GitHub > Settings > Pages, wait for the certificate, then tick "Enforce HTTPS"`);
  console.log(`  3. Check https://${DOMAIN} and https://www.${DOMAIN} both load`);
  console.log(`  4. Send yourself the link and confirm the preview card renders\n`);
})();
