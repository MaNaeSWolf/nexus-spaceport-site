# Nexus Spaceports — website

Static one-page site for Nexus Spaceports, hosted on GitHub Pages.

Live at https://manaeswolf.github.io/nexus-spaceport-site/

## Structure

- `index.html` — the entire site (markup, CSS and JS inlined)
- `assets/` — logo, favicons, social card, imagery, and the un-minified globe animation source
- `.nojekyll` — tells GitHub Pages to serve files as-is, without Jekyll processing
- `robots.txt` — search-engine exclusion (see note below)

## Wiring up the enquiry form

The investor enquiry form is **not yet connected to an inbox**. Until it is, it
falls back to opening the visitor's mail client, and tells them plainly that the
enquiry may not have sent.

To make it deliver properly:

1. Create a free form at https://formspree.io (Netlify Forms and Basin work the same way)
2. Copy the endpoint URL it gives you, e.g. `https://formspree.io/f/abcdwxyz`
3. In `index.html`, find `var ENDPOINT = '';` near the bottom and paste it in
4. Commit and push

Nothing else needs changing — the success, failure and validation paths are
already written against it.

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
