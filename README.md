# Nexus Spaceports — website

Static one-page site for Nexus Spaceports, hosted on GitHub Pages.

Live at https://manaeswolf.github.io/nexus-spaceport-site/

## Structure

- `index.html` — the home page
- `news/index.html` — the newsroom: post list, and a single post when opened with `?post=<slug>`
- `news/posts/*.md` — **the posts you write.** Markdown with a small frontmatter block
- `news/data/` — **generated, do not edit.** `index.json` plus one HTML file per post
- `assets/site.css`, `assets/site.js` — shared by both pages
- `assets/` — logo, favicons, social card, imagery, globe source, and `news/` post images
- `tools/` — the post authoring and build scripts
- `.nojekyll` — tells GitHub Pages to serve files as-is, without Jekyll processing
- `robots.txt` — search-engine exclusion (see note below)
- `.gitattributes` — pins LF endings; a CRLF checkout breaks the exact-string
  tooling used to edit these files

The globe, its coastline payload and the locator map stay inline in `index.html`
— they are home-page only and the payload is large. Everything else is shared.

The former `/v2/` concept has been promoted to the root and removed. Its history
is in the git log if any of it needs recovering.

## Writing a news post

```
node tools/new-post.js
```

It asks for a title, date, optional image and optional summary, then:

- creates `news/posts/<date>-<slug>.md` with the frontmatter filled in
- copies the image into `assets/news/`, resizing to 1600px wide and re-encoding
  as JPEG (usually a 5–20× size reduction)
- rebuilds `news/data/`

Then open the `.md`, write the body in Markdown, and run:

```
node tools/build-news.js
```

Commit and push. The home page strip and the news page both pick it up.

Non-interactive if you prefer:

```
node tools/new-post.js --title "Ghana MOU signed" --date 2026-08-01 --image C:\pics\signing.jpg
```

### Editing a post

Open its file in `news/posts/`, change whatever you like, then:

```
node tools/build-news.js
```

Commit and push. That is the whole loop — the same for fixing a typo or
rewriting the thing.

**Changing the title changes the URL.** The slug is derived from the title, so a
retitled post gets a new address and the old link stops working. If a post has
already been shared, keep the old address by pinning it in the frontmatter:

```
slug: original-slug-here
```

### Deleting a post

Delete its `.md` from `news/posts/`, then run `node tools/build-news.js`. The
build removes the rendered file that has no source, so nothing is left behind.
Post images are only reported, never deleted — remove them from `assets/news/`
by hand once you are sure.

To take a post down without losing it, set `draft: true` in its frontmatter and
rebuild. It stays in the repo and vanishes from the site.

**Frontmatter fields.** `title` and `date` (YYYY-MM-DD) are required; the build
refuses to run without them. `image`, `imageAlt`, `summary` and `slug` are
optional — without a summary the first ~320 characters of the body are used. Set
`draft: true` to keep a post out of the build.

The build fails loudly and writes nothing if a post is missing a title, has a
malformed date, or points at an image that does not exist. It will not leave the
site in a half-updated state.

**Markdown supported:** headings, paragraphs, `**bold**`, `*italic*`, links,
images, bullet and numbered lists (including wrapped lines), blockquotes,
`inline code` and horizontal rules. Post content is HTML-escaped at build time,
so a stray `<` or `&` in your writing is safe.

Posts are converted at build time, so the browser never downloads a Markdown
parser. `index.json` holds only metadata and the excerpt; a post's body is
fetched only when someone opens it, so the index stays small as posts pile up.

The image step needs Windows PowerShell (it uses System.Drawing, which ships
with Windows). Everything else is plain Node with no dependencies — there is no
`npm install` for this repo.

## The latest-news strip

`#news-strip` sits directly under the hero on the home page. The active card
takes 70% of the width with its neighbours peeking either side, dimmed and faded
out by a mask on the rail. Hovering a neighbour slides it in after a short delay;
the arrows do the same explicitly. On narrow screens cards go to 86% and stack
their image above the text.

If `news/data/index.json` is missing or unreadable the whole strip hides itself
rather than leaving an empty shell on the page.

## ⚠ Wiring up the enquiry form — still outstanding

The form is not connected to an inbox. It states plainly that nothing was sent
rather than pretending to succeed, so nobody is misled — but a submitted enquiry
goes nowhere. The contact address is currently the only working route.

1. Create a free form at https://formspree.io (Netlify Forms and Basin work the same way)
2. Copy the endpoint URL it gives you, e.g. `https://formspree.io/f/abcdwxyz`
3. In `index.html`, find `var ENDPOINT = '';` near the bottom and paste it in
4. Commit and push

Nothing else needs changing — the success, failure and validation paths are
already written against it.

## Contact address and anti-harvesting

`info@nexus-spaceport.com` never appears as a contiguous string in the served
HTML. Three layers:

1. **Markup** — the address is split across `<span>` elements with the `@` and
   the `.` supplied by CSS `::before`, so it renders correctly with no JavaScript
   and no flash of placeholder text.
2. **Runtime** — a small script assembles the real address, sets the `mailto:`
   href on every `[data-m]` link, and replaces the split spans with real text so
   the address can be copied. This only ever exists in the live DOM.
3. **No-JS fallback** — the links point at `#invest` (the enquiry form), which is
   a working route rather than a dead end.

There is also a hidden decoy block: 50 addresses across 25 near-miss spellings of
the real domain (`nexusspaceport.com`, `nexus-spaceports.com`, and so on). All 25
were checked to have no A and no MX record, so mail to any of them fails at DNS
lookup and reaches nobody. They are `display:none` and `aria-hidden="true"`, so
screen readers skip them entirely.

**Re-check the decoys occasionally.** DNS status is a point-in-time fact — if
someone registers one of those variants later, that decoy would start delivering
to a real mailbox. Anyone registering a near-miss of the brand is almost
certainly a typosquatter, which is the intent, but it is worth knowing.

## Theme

Light and dark, toggled from the nav. Light is the default for visitors with no
stored preference; the choice persists in `localStorage`. The theme is applied by
a small inline script in `<head>` so there is no flash of the wrong palette, and
the globe canvas re-themes along with the CSS.

Every surface colour is a CSS variable, so a new palette is a change to the two
`:root` blocks rather than a hunt through the stylesheet.

Note: `assets/globe.source.js` is a readable reference copy of the globe script.
The inlined copy in `index.html` has since diverged — it takes a theme-aware
palette and an alpha multiplier. Treat `index.html` as the source of truth.

## Keeping it out of search results

The `<meta name="robots" content="noindex, nofollow">` tag in `index.html` is
what actually excludes the site from search engines. `robots.txt` is included
too, but has **no effect** on a `github.io/<repo>` project URL — crawlers only
read robots.txt from a domain root. It becomes live if the site ever moves to a
custom domain.

Open Graph tags still produce link previews when the URL is shared in WhatsApp,
LinkedIn or Slack. That is deliberate: noindex stops search engines finding it,
while previews still work for links you send on purpose.

## Moving to a custom domain

Two absolute URLs in `<head>` are hard-coded to the GitHub Pages address and must
be updated or link previews will break:

- `og:url`
- `og:image` (and `twitter:image`)

Also reconsider the `noindex` tag at that point, and note that `robots.txt`
becomes effective once the site is at a domain root.

## Local preview

Open `index.html` directly in a browser, or serve the folder:

```
python -m http.server 8000
```

Then visit http://localhost:8000
