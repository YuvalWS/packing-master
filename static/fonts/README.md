# Self-hosted fonts

The app uses **Heebo** (Hebrew + Latin) for the entire UI. Font files are not
committed to the repo. Drop the `.woff2` files into this directory so the
`@font-face` rules in [src/lib/styles/tokens.css](../../src/lib/styles/tokens.css)
can find them.

Expected filenames:

- `heebo-regular.woff2` — weight `400`
- `heebo-700.woff2` — weight `700`

Download from <https://fonts.google.com/specimen/Heebo> (latin + hebrew subsets;
woff2 format). License is OFL 1.1; redistribute fine, but we keep them out of
git to avoid committing binaries.

If a font file is missing the browser falls back to `'Assistant', system-ui,
-apple-system, sans-serif` — the layout still works.
