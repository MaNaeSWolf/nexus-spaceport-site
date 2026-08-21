#!/usr/bin/env node
/* Re-checks that every domain used in a .ftx block still has no A and no MX
   record. Their whole basis is that mail to them fails at DNS lookup, and that
   is a point-in-time fact: if one is registered later and given a mailbox, the
   entry would start delivering somewhere real. Run this occasionally, and
   before any significant push of the site.

   Exit code 0 = all clear, 1 = at least one domain now resolves. */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PAGES = ['index.html', path.join('news', 'index.html')];

/* Same approach as go-live.js: ask Windows rather than node's dns.resolve*,
   which talks to whatever DNS server is configured and fails outright if that
   is unreachable. */
function query(name, type) {
  try {
    const ps =
      `$r = Resolve-DnsName -Name '${name}' -Type ${type} -DnsOnly -ErrorAction SilentlyContinue | ` +
      `Where-Object { $_.QueryType -eq '${type}' }; ` +
      `$out = @($r | ForEach-Object { if ($_.IPAddress) { $_.IPAddress } elseif ($_.NameExchange) { $_.NameExchange } }); ` +
      `ConvertTo-Json -Compress -InputObject @($out)`;
    const raw = execFileSync('powershell', ['-NoProfile', '-Command', ps],
      { encoding: 'utf8', windowsHide: true }).trim();
    if (!raw) return [];
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter(Boolean) : [v].filter(Boolean);
  } catch (e) { return []; }
}

const domains = new Set();
let blocks = 0, addresses = 0;

for (const rel of PAGES) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, 'utf8');
  const re = /<div class="ftx"[^>]*>([\s\S]*?)<\/div>/g;
  let m;
  while ((m = re.exec(html))) {
    blocks++;
    for (const a of m[1].match(/mailto:([^"]+)/g) || []) {
      addresses++;
      domains.add(a.split('@')[1].toLowerCase());
    }
  }
}

if (!domains.size) {
  console.error('No .ftx blocks found. Has the markup changed?');
  process.exit(1);
}

console.log(`${blocks} blocks, ${addresses} addresses, ${domains.size} distinct domains\n`);

const live = [];
for (const d of [...domains].sort()) {
  const a = query(d, 'A');
  const mx = query(d, 'MX');
  const ok = a.length === 0 && mx.length === 0;
  if (!ok) live.push({ d, a, mx });
  console.log(`${ok ? '  ok  ' : '  LIVE'}  ${d.padEnd(28)}${ok ? '' : `A:[${a}] MX:[${mx}]`}`);
}

if (live.length) {
  console.log(`\n${live.length} domain(s) now resolve. Remove them from the .ftx blocks.`);
  process.exit(1);
}
console.log(`\nAll ${domains.size} clear — no A, no MX.`);
