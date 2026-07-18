# Lamia's Goodies — Website

Trilingual (Arabic / Hebrew / English) storefront for Lamia's Goodies. Static
HTML/CSS/JS, no build step, no framework. Ordering happens via a pre-filled
WhatsApp message per product.

## Project structure

```
lamias-goodies-website/
  index.html          entry point, references the files below
  css/
    styles.css         all styling
  js/
    config.js           site constants (WhatsApp number, future API URL)
    i18n.js              UI text + category labels per language
    products-data.js     product catalog (temporary hardcoded source)
    app.js               rendering + language switching logic
  assets/
    icons/               placeholder for future PWA icons
```

## Running locally

No build step needed. Either:
- Open `index.html` directly in a browser, or
- Serve the folder with any static server, e.g. `python3 -m http.server`
  then visit `http://localhost:8000`

## Known data issues (source: Google Sheet)

- `MAA-001` / `MAA-002` / `MAA-003` (date / walnut / pistachio maamoul)
  currently share one placeholder photo — only one maamoul photo has been
  uploaded to Drive so far. Update `photoId` in `js/products-data.js` once
  real photos exist for each.
- The sheet's category cell for maamoul items reads "Tradetional arabic
  sweets" (typo). `products-data.js` already maps these to the correct
  `maamoul` category key regardless of the sheet's text.

## Next steps (in priority order)

1. **Wire up live data.** Deploy the product sheet as a Google Apps Script
   Web App, then set `CONFIG.productsApiUrl` in `js/config.js`. `app.js`
   already has the fetch logic in `loadProducts()` — it just needs a URL.
2. **Fix the data issues above** in the source sheet before adding many more
   rows.
3. **Deploy** to Vercel / Netlify / GitHub Pages for a real, testable URL.
4. **Make it installable** — add `manifest.json` + icons in `assets/icons/`
   for "Add to Home Screen" support.
5. **Soft-launch** with real customers via the WhatsApp ordering flow before
   adding cart/payment.
6. **Cart + payment** (Tranzila/Cardcom for Israeli card processing) only
   once real order volume justifies the added complexity.

## Config

Edit `js/config.js` to change:
- `whatsappNumber` — international format, no leading `0` or `+`
- `productsApiUrl` — set once the Apps Script backend is deployed
