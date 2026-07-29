/* Compile news/posts/*.md into what the site actually reads:
 *
 *   news/data/index.json   metadata + excerpt for every post, newest first
 *   news/data/<slug>.html  the rendered body of one post
 *
 * Both the news page and the teaser on the home page read index.json. Bodies
 * are fetched only when a post is opened, so the index stays small however many
 * posts accumulate.
 *
 * Run:  node tools/build-news.js
 */
const fs = require('fs');
const path = require('path');
const { toHtml, toText, parse } = require('./md.js');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'news', 'posts');
const OUT = path.join(ROOT, 'news', 'data');

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

function dateLabel(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}`;
}

function build() {
  if (!fs.existsSync(SRC)) { console.error(`No posts directory at ${SRC}`); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });

  const files = fs.readdirSync(SRC).filter(f => f.endsWith('.md')).sort();
  const posts = [];
  const problems = [];

  for (const f of files) {
    const raw = fs.readFileSync(path.join(SRC, f), 'utf8');
    const { meta, body } = parse(raw);
    const slug = (meta.slug || f.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '')).trim();

    if (!meta.title) { problems.push(`${f}: missing "title" in frontmatter`); continue; }
    if (!meta.date || !/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) {
      problems.push(`${f}: "date" must be YYYY-MM-DD`); continue;
    }
    if (meta.draft === 'true') { console.log(`  skipped (draft): ${f}`); continue; }
    if (meta.image && !fs.existsSync(path.join(ROOT, meta.image))) {
      problems.push(`${f}: image not found -> ${meta.image}`); continue;
    }

    const plain = toText(body);
    const summary = (meta.summary || plain).slice(0, 320).trim();

    fs.writeFileSync(path.join(OUT, `${slug}.html`), toHtml(body), 'utf8');

    posts.push({
      slug,
      title: meta.title,
      date: meta.date,
      dateLabel: dateLabel(meta.date),
      image: meta.image || null,
      imageAlt: meta.imageAlt || meta.title,
      summary,
      words: plain.split(/\s+/).filter(Boolean).length,
    });
  }

  if (problems.length) {
    console.error('\nProblems - nothing written:');
    problems.forEach(p => console.error('  ' + p));
    process.exit(1);
  }

  posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(posts, null, 2) + '\n', 'utf8');

  console.log(`\nBuilt ${posts.length} post${posts.length === 1 ? '' : 's'}:`);
  posts.forEach(p => console.log(`  ${p.date}  ${p.title}${p.image ? '  [image]' : ''}  (${p.words} words)`));
  console.log(`\n  -> news/data/index.json`);
  return posts;
}

if (require.main === module) build();
module.exports = { build, dateLabel };
