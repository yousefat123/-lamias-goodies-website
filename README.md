# Lamia's Goodies — Website

Trilingual (Arabic / Hebrew / English) storefront for Lamia's Goodies. Static
HTML/CSS/JS, no build step, no framework. Guest ordering happens via a
pre-filled WhatsApp message per product — no account required. Customers can
optionally sign in (email/password or Google) for a profile, favorites, and
order history. Product data, accounts, and orders are backed by Firebase
(Auth + Firestore + Storage).

Live site: https://yousefat123.github.io/-lamias-goodies-website/

## Project structure

```
lamias-goodies-website/
  index.html          storefront: catalog + WhatsApp ordering + sign-in
  account.html         customer profile, favorites, order history
  admin.html            admin panel: product CRUD + photo upload, orders
  css/
    styles.css          all styling
  js/
    config.js            WhatsApp number + admin email
    i18n.js               UI text + category labels per language
    products-data.js      fallback catalog (used if Firestore is
                         unreachable) + one-time migration source
    firebase-config.js    Firebase project config + init
    auth.js                sign-in modal, header account UI, user doc
                         creation, window.LamiaFirebase bridge
    account.js              account.html logic
    admin.js                 admin.html logic
    app.js                    rendering + language switching + WhatsApp
                         link building + favorites/order hooks
  firestore.rules       Firestore security rules (paste into Console)
  storage.rules          Storage security rules (paste into Console)
  assets/
    icons/               placeholder for future PWA icons
```

## Running locally

No build step needed. Either:
- Open `index.html` directly in a browser, or
- Serve the folder with any static server, e.g. `python3 -m http.server`
  then visit `http://localhost:8000`

Firebase features (accounts, favorites, orders, admin panel) require real
values in `js/firebase-config.js` and `localhost` added to Firebase
Console → Authentication → Settings → Authorized domains. Without that,
`js/firebase-config.js` logs a warning and every Firebase-dependent feature
no-ops safely — guest browsing/ordering always works regardless.

## Admin access

Admin panel (`admin.html`) is restricted to `yousef3talla@gmail.com`
(`CONFIG.adminEmail` in `js/config.js` — a UI hint only; real enforcement is
in `firestore.rules`/`storage.rules`). Sign in with Google, or use the
email/password Sign In / Sign Up toggle on the same page.

## Next steps (in priority order)

1. **Upload real product photos** via the admin panel (replaces the old
   Google Drive hotlinks used as an interim value after migration).
2. **Verify end-to-end** on the live site: sign-in, product import, a test
   order (guest and logged-in), favorites.
3. **Make it installable** — add `manifest.json` + icons in `assets/icons/`
   for "Add to Home Screen" support.
4. **Soft-launch** with real customers via the WhatsApp ordering flow.
5. **Cart + payment** (Tranzila/Cardcom for Israeli card processing) only
   once real order volume justifies the added complexity.

## Config

Edit `js/config.js` to change:
- `whatsappNumber` — international format, no leading `0` or `+`
- `adminEmail` — the one account allowed into `admin.html`

Edit `js/firebase-config.js`'s `firebaseConfig` object if the Firebase
project ever changes (values come from Firebase Console → Project settings
→ Your apps → Web app — safe to commit, not secrets).
