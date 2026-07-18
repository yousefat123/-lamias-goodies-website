# Lamia's Goodies — Project Context

This file summarizes everything decided and built so far, for continuing
development in Claude Code. Read this before making changes.

## Business context

- Client: Yousef's mother, who runs a small home-based business selling
  cakes, sweets, and traditional Arab pastries (فطير، كعك عيد، مقروطة, etc.)
  under the name "Lamia's Goodies."
- Yousef previously built her a standalone cake-customization tool
  (separate project, not merged into this site for now).
- Goal for this project: a real, growing catalog website — not just cakes.

## Product decisions made

- **Ordering flow, phased:**
  1. **Now:** browse catalog + order via WhatsApp (pre-filled message per
     product), no online payment.
  2. **Later:** possibly real cart + card payment, once real order volume
     from phase 1 justifies the complexity (Israeli processors like
     Tranzila/Cardcom — Stripe/Square do not support Israeli merchant
     accounts).
- **Languages:** Arabic, Hebrew, and English, all three required from day
  one. Site has a language switcher; Arabic and Hebrew both render RTL.
- **Cake customizer:** intentionally NOT merged into this site for now.
- **WhatsApp number:** 0547751481 (international format used in code:
  `972547751481`).

## Data pipeline: Google Drive + Sheets as the content backend

Decision: use Google Sheets as the editable "backend" so Yousef's mother can
add products without any code changes, via a Google Apps Script Web App
(not yet built — see Next Steps).

**Drive folder structure (created manually in the user's Google Drive):**
```
Lamia's Goodies - Website/          (root — should be renamed, spaces/apostrophe
                                      are against the project's naming convention)
  lamias-goodies-products-template.xlsx   (the live product data)
  Photos/
    Cakes/            CAK-001.jpg
    Sweets/            SWE-OO1.jpg   (typo: letters OO, not zeros — kept as-is
                                       since it matches the sheet's filename)
    Tradetional arabic sweets/   MAA-001.jpg   (category name has a typo, and
                                       this one photo is shared by 3 different
                                       products — see Known Issues)
```

**Spreadsheet columns:** `id, category, name_ar, name_he, name_en,
description_ar, description_he, description_en, price, photo_filename,
available`

## Known data issues (fix in the source sheet, not just in code)

1. **Duplicate ids/photos:** `MAA-001` is used for three different products
   (date, walnut, pistachio maamoul), all currently pointing at the same
   photo. Needs unique ids (`MAA-001`, `MAA-002`, `MAA-003`, already
   reflected in code) and a distinct photo per item once available.
2. **Category typo:** sheet category cell reads "Tradetional arabic sweets."
   Code already maps these correctly to a `maamoul` category regardless.
3. **Filename typo:** `SWE-OO1.jpg` uses the letters "OO" instead of zeros.
   Functions fine since it's consistent between the sheet and the actual
   file, but worth fixing to the `SWE-001` convention going forward.

## Site architecture (current state)

Static HTML/CSS/JS, no framework, no build step. File/folder names use
hyphens only — no spaces, per explicit instruction.

```
lamias-goodies-website/
  index.html
  css/styles.css
  js/
    config.js           WhatsApp number + productsApiUrl (null until the
                          Apps Script backend is deployed)
    i18n.js               all UI strings + category labels, per language
    products-data.js      hardcoded product catalog (temporary — see Known
                          Issues above for what's wrong in it), plus the
                          photoUrl() helper
    app.js                rendering, language switching, WhatsApp link
                          building, and loadProducts() which already
                          contains the fetch-from-API logic, just needs
                          config.productsApiUrl set
  assets/icons/           empty, placeholder for future PWA icons
  README.md
  .gitignore
```

**Design tokens used:** cream background (#FAF3E6), amber (#C17F2B) +
burgundy (#7C2C3B) accents, ink text (#2B2018). Fonts: Cairo (Arabic
display), Almarai (Arabic body), Rubik (Hebrew), Fredoka (English display),
Inter (English body) — swapped via `body[data-lang]` CSS selectors. Visual
signature: a scalloped divider under the hero, evoking a maamoul mold edge.

## Known bug: product images don't load when the site is opened

Two separate causes identified in this conversation, both should be checked:

1. **Google Drive hotlinking is unreliable.** Images currently load via
   `https://drive.google.com/thumbnail?id=...&sz=w600`. This only works if
   each individual file (not just the parent folder) is shared "Anyone with
   the link," and even then it's an unofficial trick Google can break or
   rate-limit at any time. **Recommended real fix:** download the actual
   photos and put them in `assets/images/` in the project, reference them
   with local relative paths instead of Drive URLs. Trade-off: new photos
   the mother uploads to Drive won't auto-appear until someone copies them
   into the project — acceptable until the Apps Script backend exists.
2. **Opening index.html from inside an unextracted zip breaks relative
   paths.** If `index.html` is opened directly from within Windows'
   zip-browsing view rather than a fully extracted folder, `css/styles.css`
   and the `js/*.js` files fail to load (404), which looks like "the page
   loads but there are no products" since the static HTML shows but
   `app.js` never runs to render the product grid. Always fully extract
   the zip first.

## Next steps, in priority order

1. **Fix known data issues** in the source sheet (see above) while the
   catalog is still small.
2. **Move product images local** (`assets/images/`) instead of hotlinking
   Drive, per the bug above.
3. **Build the Google Apps Script Web App** that serves the sheet as JSON,
   then set `CONFIG.productsApiUrl` in `js/config.js` — `loadProducts()` in
   `app.js` already handles the fetch, this is the only wiring needed.
4. **Deploy to a real URL** — Vercel, Netlify, or GitHub Pages (all free
   for a static site like this).
5. **Make it installable** — add `manifest.json` + real icons in
   `assets/icons/` for "Add to Home Screen" (PWA basics).
6. **Soft-launch** with real customers via the WhatsApp flow, before
   building anything more complex.
7. **Cart + real payment** only once real order volume justifies it — use
   an Israeli processor (Tranzila/Cardcom), not Stripe/Square.

## Broader context explored earlier (not part of this site, background only)

Before landing on this project, the conversation explored building a POS/
kitchen-printing product to sell to cafes generally (researched Tabit,
Comfy, CashOnTab/Sumit as existing Israeli competitors; confirmed Tabit has
no public API; confirmed Square/Toast don't support Israeli merchant
accounts). That direction was set aside in favor of this concrete project
for a real client (the mother's business). A separate ice-cream-cafe POS
demo (React/Tailwind artifact with menu builder, order cart, kitchen ticket
printing via browser print) was also built during that exploration — not
connected to this project.

## Environment notes for Claude Code

- Git has not been initialized yet. User is new to git on Windows; plan is
  to install Git for Windows, then run `git init && git add . && git
  commit -m "Initial site"` inside this folder, create an empty GitHub repo
  (no README/gitignore, since one already exists here), then `git remote
  add origin <url> && git branch -M main && git push -u origin main`.
- All file/folder names must stay space-free (hyphens only) per explicit
  project convention.
