# Nexus Spaceports — website

Static one-page site for Nexus Spaceports, hosted on GitHub Pages.

## Structure

- `index.html` — the entire site (markup, CSS and JS inlined)
- `assets/` — logo, imagery, and the un-minified globe animation source
- `.nojekyll` — tells GitHub Pages to serve files as-is, without Jekyll processing

## Local preview

Open `index.html` directly in a browser, or serve the folder:

```
python -m http.server 8000
```

Then visit http://localhost:8000
