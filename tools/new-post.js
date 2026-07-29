/* Create a news post.
 *
 *   node tools/new-post.js                     interactive - asks for each field
 *   node tools/new-post.js --title "..." --date 2026-07-29 --image path\to\pic.jpg
 *
 * Writes news/posts/<date>-<slug>.md, copies and resizes the image into
 * assets/news/, then rebuilds the index. Open the .md, write the body, and run
 * `node tools/build-news.js` again to publish the change.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const POSTS = path.join(ROOT, 'news', 'posts');
const IMAGES = path.join(ROOT, 'assets', 'news');

function slugify(s) {
  return s.toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function today() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function args() {
  const a = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith('--')) { out[a[i].slice(2)] = (a[i + 1] && !a[i + 1].startsWith('--')) ? a[++i] : 'true'; }
  }
  return out;
}

function ask(rl, q, fallback) {
  return new Promise(res => rl.question(fallback ? `${q} [${fallback}]: ` : `${q}: `,
    ans => res(ans.trim() || fallback || '')));
}

function ingestImage(source, slug) {
  const dest = path.join(IMAGES, `${slug}.jpg`);
  const script = path.join(__dirname, 'resize-image.ps1');
  const out = execFileSync('powershell', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script,
    '-Source', source, '-Dest', dest,
  ], { encoding: 'utf8' });
  process.stdout.write('  ' + out.trim().split('\n').join('\n  ') + '\n');
  return path.relative(ROOT, dest).split(path.sep).join('/');
}

(async () => {
  const a = args();
  let title = a.title, date = a.date, image = a.image, summary = a.summary;

  if (!title || !date) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log('\nNew Nexus news post — press Enter to accept a default.\n');
    title = title || await ask(rl, 'Title');
    date = date || await ask(rl, 'Date (YYYY-MM-DD)', today());
    image = image || await ask(rl, 'Image file (optional, leave blank for none)');
    summary = summary || await ask(rl, 'One-line summary (optional, first lines used if blank)');
    rl.close();
  }

  if (!title) { console.error('A title is required.'); process.exit(1); }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { console.error(`Date must be YYYY-MM-DD, got "${date}"`); process.exit(1); }

  const slug = slugify(title);
  const file = path.join(POSTS, `${date}-${slug}.md`);
  fs.mkdirSync(POSTS, { recursive: true });
  if (fs.existsSync(file)) { console.error(`Already exists: ${path.relative(ROOT, file)}`); process.exit(1); }

  let imageRel = '';
  if (image) {
    if (!fs.existsSync(image)) { console.error(`Image not found: ${image}`); process.exit(1); }
    fs.mkdirSync(IMAGES, { recursive: true });
    console.log('\nProcessing image:');
    imageRel = ingestImage(image, slug);
  }

  const front = [
    '---',
    `title: ${title}`,
    `date: ${date}`,
    ...(imageRel ? [`image: ${imageRel}`, `imageAlt: ${title}`] : []),
    ...(summary ? [`summary: ${summary}`] : []),
    'draft: false',
    '---',
    '',
    'Write the post here in Markdown.',
    '',
    'Blank lines separate paragraphs. Use **bold**, *italic*, [links](https://example.com),',
    '`- ` for bullets and `## ` for a subheading.',
    '',
  ].join('\n');

  fs.writeFileSync(file, front, 'utf8');
  console.log(`\nCreated  ${path.relative(ROOT, file).split(path.sep).join('/')}`);

  const { build } = require('./build-news.js');
  build();

  console.log('\nNext:');
  console.log(`  1. Edit the file above and write the body`);
  console.log(`  2. node tools/build-news.js`);
  console.log(`  3. git add -A && git commit && git push`);
})();
