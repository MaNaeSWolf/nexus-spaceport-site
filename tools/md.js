/* Minimal Markdown -> HTML converter.
 *
 * Deliberately dependency-free: this repo has no package.json and no install
 * step, and a news post needs a small subset of Markdown. Supports headings,
 * paragraphs, bold/italic, links, images, lists, blockquotes and rules.
 *
 * Posts are converted at build time, so the browser never ships a parser.
 */

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* inline: images, links, bold, italic, code.
   Escapes first, so block detection upstream can still see raw ">" and "<".
   Escaping the whole document up front would turn "> quote" into "&gt; quote"
   and blockquotes would never match. */
function inline(raw) {
  const s = escapeHtml(raw);
  return s
    .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
      (m, alt, src, title) => `<img src="${src}" alt="${alt}"${title ? ` title="${title}"` : ''} loading="lazy" decoding="async">`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, href) => {
      const external = /^https?:\/\//.test(href);
      return `<a href="${href}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${text}</a>`;
    })
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
}

function toHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;

  const flushList = (tag, items) => {
    out.push(`<${tag}>` + items.map(t => `<li>${inline(t)}</li>`).join('') + `</${tag}>`);
  };

  while (i < lines.length) {
    let line = lines[i];

    if (!line.trim()) { i++; continue; }

    // horizontal rule
    if (/^\s*(---|\*\*\*)\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

    // heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { const n = h[1].length; out.push(`<h${n}>${inline(h[2].trim())}</h${n}>`); i++; continue; }

    // blockquote (consecutive lines)
    if (/^\s*>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
      out.push(`<blockquote><p>${inline(buf.join(' ').trim())}</p></blockquote>`);
      continue;
    }

    // lists. A wrapped bullet continues on the next line ("lazy continuation"),
    // so keep absorbing lines until something that starts a new block.
    const startsBlock = t =>
      /^\s*[-*+]\s+/.test(t) || /^\s*\d+\.\s+/.test(t) || /^#{1,6}\s/.test(t) ||
      /^\s*>/.test(t) || /^\s*(---|\*\*\*)\s*$/.test(t);

    const gatherList = (marker, tag) => {
      const items = [];
      while (i < lines.length && marker.test(lines[i])) {
        let text = lines[i].replace(marker, '');
        i++;
        while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) {
          text += ' ' + lines[i].trim();
          i++;
        }
        items.push(text);
      }
      flushList(tag, items);
    };

    if (/^\s*[-*+]\s+/.test(line)) { gatherList(/^\s*[-*+]\s+/, 'ul'); continue; }
    if (/^\s*\d+\.\s+/.test(line)) { gatherList(/^\s*\d+\.\s+/, 'ol'); continue; }

    // paragraph: gather until a blank line or the start of another block
    const buf = [];
    while (i < lines.length && lines[i].trim() &&
           !/^(#{1,6}\s|\s*[-*+]\s|\s*\d+\.\s|\s*>|\s*(---|\*\*\*)\s*$)/.test(lines[i])) {
      buf.push(lines[i].trim()); i++;
    }
    if (buf.length) out.push(`<p>${inline(buf.join(' '))}</p>`);
  }

  return out.join('\n');
}

/* Strip markup to plain text, for excerpts */
function toText(md) {
  return md
    .replace(/^---[\s\S]*?---\n/, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/[*_`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* frontmatter: --- key: value --- then body */
function parse(raw) {
  const src = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const m = src.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: src };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  return { meta, body: m[2] };
}

module.exports = { toHtml, toText, parse, escapeHtml };
