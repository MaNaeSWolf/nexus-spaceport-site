/* Local newsroom admin.
 *
 *   node tools/admin.js        then open http://127.0.0.1:8787
 *
 * A small HTTP server that edits news/posts/*.md, runs the build, and can
 * commit and push. Zero dependencies - plain Node http, fs and child_process.
 *
 * It is deliberately bound to 127.0.0.1: it writes files in this repo and can
 * run git, so it must never be reachable from the network. There is no auth,
 * because there is nothing to authenticate against on a loopback socket.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile, execFileSync } = require('child_process');
const { toHtml, toText, parse } = require('./md.js');

const ROOT = path.resolve(__dirname, '..');
const POSTS = path.join(ROOT, 'news', 'posts');
const IMAGES = path.join(ROOT, 'assets', 'news');
const UI = path.join(__dirname, 'admin-ui.html');
const PORT = Number(process.env.PORT) || 8787;

/* ── helpers ─────────────────────────────────────────────────────────────── */

const slugify = s => s.toLowerCase().replace(/['’]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

/* Only ever touch a plain .md directly inside news/posts. Rejects traversal
   ("../"), absolute paths, and anything that resolves outside the directory. */
function postPath(name) {
  if (typeof name !== 'string' || !/^[A-Za-z0-9._-]+\.md$/.test(name)) return null;
  const p = path.join(POSTS, name);
  if (path.dirname(path.resolve(p)) !== path.resolve(POSTS)) return null;
  return p;
}

function frontmatter(meta) {
  const order = ['title', 'date', 'slug', 'image', 'imageAlt', 'summary', 'draft'];
  const lines = ['---'];
  for (const k of order) {
    const v = meta[k];
    if (v === undefined || v === null || v === '') continue;
    lines.push(`${k}: ${String(v).replace(/\r?\n/g, ' ')}`);
  }
  lines.push('---', '');
  return lines.join('\n');
}

function listPosts() {
  if (!fs.existsSync(POSTS)) return [];
  return fs.readdirSync(POSTS).filter(f => f.endsWith('.md')).sort().reverse().map(file => {
    const { meta, body } = parse(fs.readFileSync(path.join(POSTS, file), 'utf8'));
    const slug = meta.slug || file.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
    const plain = toText(body);
    return {
      file, slug,
      title: meta.title || '(untitled)',
      date: meta.date || '',
      image: meta.image || '',
      draft: String(meta.draft) === 'true',
      words: plain.split(/\s+/).filter(Boolean).length,
      excerpt: (meta.summary || plain).slice(0, 140),
    };
  });
}

function run(cmd, args, cb) {
  execFile(cmd, args, { cwd: ROOT, maxBuffer: 8 * 1024 * 1024, windowsHide: true },
    (err, stdout, stderr) => cb(err, ((stdout || '') + (stderr || '')).trim()));
}

function readBody(req, limit = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new Error('payload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch (e) { reject(new Error('invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

const send = (res, code, data) => {
  const payload = JSON.stringify(data);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(payload);
};

/* ── routes ──────────────────────────────────────────────────────────────── */

const routes = {

  'GET /api/posts': (req, res) => send(res, 200, { posts: listPosts() }),

  'GET /api/post': (req, res, url) => {
    const p = postPath(url.searchParams.get('file'));
    if (!p || !fs.existsSync(p)) return send(res, 404, { error: 'Post not found' });
    const { meta, body } = parse(fs.readFileSync(p, 'utf8'));
    send(res, 200, { file: path.basename(p), meta, body });
  },

  'POST /api/post': async (req, res) => {
    const b = await readBody(req);
    const meta = b.meta || {};
    if (!meta.title || !String(meta.title).trim()) return send(res, 400, { error: 'A title is required.' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date || '')) return send(res, 400, { error: 'Date must be YYYY-MM-DD.' });

    /* On edit the filename is kept, so the published URL does not move when a
       title is reworded. New posts derive it from the date and title.
       An unusable "file" is an error rather than a cue to create something new
       - otherwise a bad value silently produces a stray post. */
    if (b.file !== undefined && b.file !== null && b.file !== '' && !postPath(b.file)) {
      return send(res, 400, { error: 'Unsafe or malformed filename.' });
    }
    const file = b.file || `${meta.date}-${slugify(meta.title)}.md`;
    const p = postPath(file);
    if (!p) return send(res, 400, { error: 'Unsafe filename.' });
    if (!b.file && fs.existsSync(p)) return send(res, 409, { error: `A post already exists at ${file}` });

    fs.mkdirSync(POSTS, { recursive: true });
    fs.writeFileSync(p, frontmatter(meta) + (b.body || '').replace(/\r\n/g, '\n').trimEnd() + '\n', 'utf8');
    send(res, 200, { file, saved: true });
  },

  'DELETE /api/post': (req, res, url) => {
    const name = url.searchParams.get('file');
    const p = postPath(name);
    if (!p || !fs.existsSync(p)) return send(res, 404, { error: 'Post not found' });
    fs.unlinkSync(p);
    send(res, 200, { deleted: name });
  },

  'POST /api/preview': async (req, res) => {
    const b = await readBody(req);
    send(res, 200, { html: toHtml(b.body || '') });
  },

  /* Image arrives as a data URL, which avoids hand-rolling multipart parsing.
     It is written to a temp file and handed to the same PowerShell resizer the
     command-line tool uses, so both paths produce identical output. */
  'POST /api/image': async (req, res) => {
    const b = await readBody(req);
    const m = /^data:image\/([a-zA-Z+]+);base64,(.+)$/.exec(b.dataUrl || '');
    if (!m) return send(res, 400, { error: 'Expected an image data URL.' });
    const slug = slugify(b.slug || 'image') || 'image';
    const tmp = path.join(os.tmpdir(), `nx-upload-${Date.now()}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`);
    fs.writeFileSync(tmp, Buffer.from(m[2], 'base64'));
    fs.mkdirSync(IMAGES, { recursive: true });
    const dest = path.join(IMAGES, `${slug}.jpg`);
    try {
      const out = execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass',
        '-File', path.join(__dirname, 'resize-image.ps1'), '-Source', tmp, '-Dest', dest],
        { encoding: 'utf8', windowsHide: true });
      send(res, 200, { path: `assets/news/${slug}.jpg`, log: out.trim() });
    } catch (e) {
      send(res, 500, { error: 'Could not process the image.', log: String(e.stderr || e.message).trim() });
    } finally { try { fs.unlinkSync(tmp); } catch (e) {} }
  },

  'POST /api/build': (req, res) => {
    run(process.execPath, [path.join(__dirname, 'build-news.js')], (err, log) =>
      send(res, err ? 500 : 200, { ok: !err, log }));
  },

  'GET /api/git': (req, res) => {
    run('git', ['status', '--porcelain'], (err, out) => {
      if (err) return send(res, 200, { available: false, log: out });
      const files = out.split('\n').filter(Boolean).map(l => l.trim());
      run('git', ['log', '-1', '--pretty=%h %s'], (e2, last) =>
        send(res, 200, { available: true, changes: files, lastCommit: last }));
    });
  },

  'POST /api/publish': async (req, res) => {
    const b = await readBody(req);
    const message = (b.message || 'Update news').replace(/[\r\n]+/g, ' ').slice(0, 200);
    run('git', ['add', '-A'], (e1, l1) => {
      if (e1) return send(res, 500, { ok: false, log: l1 });
      run('git', ['commit', '-m', message], (e2, l2) => {
        if (e2 && !/nothing to commit/i.test(l2)) return send(res, 500, { ok: false, log: l1 + '\n' + l2 });
        run('git', ['push'], (e3, l3) =>
          send(res, e3 ? 500 : 200, { ok: !e3, log: [l1, l2, l3].filter(Boolean).join('\n') }));
      });
    });
  },
};

/* ── server ──────────────────────────────────────────────────────────────── */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  /* A browser page on another origin must not be able to drive this. */
  const origin = req.headers.origin;
  if (origin && !/^http:\/\/(127\.0\.0\.1|localhost):/.test(origin)) {
    return send(res, 403, { error: 'Cross-origin requests are refused.' });
  }

  /* Serve images so the editor can show a thumbnail of an existing post. A post
     may point anywhere under assets/ (older ones reuse site imagery), so the
     whole folder is readable - but the resolved path is checked to be inside it,
     which is what stops a crafted "../" walking out. */
  if (req.method === 'GET' && url.pathname.startsWith('/files/')) {
    const rel = decodeURIComponent(url.pathname.slice('/files/'.length)).replace(/^assets\//, '');
    const base = path.resolve(ROOT, 'assets');
    const abs = path.resolve(base, rel);
    const inside = abs === base || abs.startsWith(base + path.sep);
    if (!inside || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      return send(res, 404, { error: 'Not found' });
    }
    const type = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
                   '.webp': 'image/webp', '.gif': 'image/gif' }[path.extname(abs).toLowerCase()];
    if (!type) return send(res, 404, { error: 'Not an image' });
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    return fs.createReadStream(abs).pipe(res);
  }

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    const html = fs.readFileSync(UI, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(html);
  }

  const handler = routes[`${req.method} ${url.pathname}`];
  if (!handler) return send(res, 404, { error: 'Not found' });

  try { await handler(req, res, url); }
  catch (e) { send(res, 500, { error: e.message || 'Server error' }); }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  Nexus newsroom admin`);
  console.log(`  http://127.0.0.1:${PORT}\n`);
  console.log(`  Editing : ${path.relative(process.cwd(), POSTS) || POSTS}`);
  console.log(`  Bound to loopback only - not reachable from the network.`);
  console.log(`  Press Ctrl+C to stop.\n`);
});
