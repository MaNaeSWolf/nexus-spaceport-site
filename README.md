# Nexus Spaceports — website

Static one-page site for Nexus Spaceports, hosted on GitHub Pages.

Live at https://manaeswolf.github.io/nexus-spaceport-site/

## Structure

- `index.html` — the entire site (markup, CSS and JS inlined)
- `assets/` — logo, favicons, social card, imagery, and the un-minified globe animation source
- `.nojekyll` — tells GitHub Pages to serve files as-is, without Jekyll processing
- `robots.txt` — search-engine exclusion (see note below)

## ⚠ Wiring up the enquiry form — required before this goes live

Every email address was removed from the page (spam exposure raised in review),
so **the form is now the only contact route on the site**. It is not yet
connected to an inbox, which means there is currently **no working way for a
visitor to reach you**. The form says so plainly rather than pretending to send.

This must be done before the site is shown to anyone real:

1. Create a free form at https://formspree.io (Netlify Forms and Basin work the same way)
2. Copy the endpoint URL it gives you, e.g. `https://formspree.io/f/abcdwxyz`
3. In `index.html`, find `var ENDPOINT = '';` near the bottom and paste it in
4. Commit and push

Nothing else needs changing — the success, failure and validation paths are
already written against it.

## Versions

- `/` — the current site, near-black palette
- `/v2/` — visual concept: deep ocean-ink background instead of black, amber
  accent, full-bleed sea-up masterplan render, ghosted section numerals,
  statement break, corner-bracket panels, staggered reveals

Both share the same `assets/` folder. v2 references it as `../assets/`.

v2 also has a light/dark toggle in the nav. It defaults to the OS
`prefers-color-scheme`, remembers the choice in `localStorage`, and re-themes the
globe canvas as well as the CSS. The theme is applied by a small inline script in
`<head>` so there is no flash of the wrong palette on load.

Note: `assets/globe.source.js` is a readable reference copy of the globe script as
inlined in the **live** page. v2's inlined copy has since diverged — it takes a
theme-aware palette and an alpha multiplier. Treat the live page as the source of
truth for that file.

## Keeping it out of search results

The `<meta name="robots" content="noindex, nofollow">` tag in `index.html` is
what actually excludes the site from search engines. `robots.txt` is included
too, but has **no effect** on a `github.io/<repo>` project URL — crawlers only
read robots.txt from a domain root. It becomes live if the site ever moves to a
custom domain.

Note that the Open Graph tags still produce link previews when the URL is shared
in WhatsApp, LinkedIn or Slack. That is deliberate: noindex stops search engines
finding it, while previews still work for links you send on purpose.

## Local preview

Open `index.html` directly in a browser, or serve the folder:

```
python -m http.server 8000
```

Then visit http://localhost:8000
