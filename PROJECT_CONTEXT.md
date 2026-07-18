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

## Accounts, admin panel, and live product data: Firebase (supersedes the old Google Sheets plan)

**Decision (2026-07-18):** the previously-planned Google Sheets + Apps Script
backend was never built and has been fully replaced by **Firebase**
(Auth + Firestore + Storage), since Firebase was needed anyway for customer
accounts and an admin panel — one system instead of two. The Google Sheet /
Drive folder described in earlier versions of this doc is **no longer the
plan**; product data now lives in Firestore and is managed from `admin.html`.

**Why Firebase:** free tier, no server to run or maintain (fits the "static
site, no build step" constraint — the JS SDK is loaded via CDN ES module
imports, no bundler needed), and it covers auth + database + file storage in
one place.

**Scope decided with the user:**
- Customer accounts: email/password **and** Google sign-in (Apple sign-in
  explicitly excluded — costs $99/yr via Apple Developer Program, skipped
  for now, can be added later if justified). Account holds: profile
  (name, phone, address), order history, and favorites/wishlist.
- Admin account: exactly one, locked to `yousef3talla@gmail.com`
  (`CONFIG.adminEmail` in `js/config.js` — UI hint only; real enforcement is
  in `firestore.rules`/`storage.rules`, checking
  `request.auth.token.email == 'yousef3talla@gmail.com'`, since there's no
  server to set custom claims). Admin can manage products (add/edit/delete,
  upload photos) and, once Phase 3 lands, view/manage orders.
- **Hard constraint:** guest WhatsApp ordering must keep working exactly as
  before, unmodified, for anyone who doesn't want an account — login is
  additive, never a gate on browsing or ordering. Every Firebase-dependent
  call in `app.js` is guarded with `window.LamiaFirebase?.foo?.()` so a
  Firebase outage or missing config never breaks the guest flow.
- Guest (not-logged-in) orders **are** recorded to Firestore too (for full
  admin visibility) — accepted trade-off: no server-side rate limiting, so
  `orders.create` rules validate shape but can't fully block spam; revisit
  with Firebase App Check later if it becomes a real problem.

**Firestore schema:**
- `products/{id}` — `name{ar,he,en}`, `desc{ar,he,en}`, `category`, `price`,
  `photoUrl` (Storage URL), `available`, `createdAt`, `updatedAt`.
- `users/{uid}` — `email`, `displayName`, `phone`, `address`, timestamps.
- `users/{uid}/favorites/{productId}` — doc id = productId (idempotent toggle).
- `orders/{id}` — one doc per order-button click: `userId` (uid or `null`
  for guest), `productId`, `productName`, `price`, `lang`, `status`
  (`pending|fulfilled|cancelled`), `createdAt`, `source: "whatsapp"`.

Full plan (architecture, file list, rules, phasing) is preserved at
`C:\Users\youse\.claude\plans\replicated-mixing-sun.md` on this machine.

**Live Firebase project:** `lamias-goodies` (created 2026-07-18 by the user
in Firebase Console). Real `firebaseConfig` values are committed in
`js/firebase-config.js` (safe — not secrets). Auth providers, Firestore, and
Storage were set up by the user following the checklist below.

**Admin login has two paths** (both on `admin.html`): Google sign-in (auto-
creates the Firebase Auth account on first use — no separate "sign up"
needed), or email/password with an explicit Sign In / Sign Up toggle (added
2026-07-18 since Google sign-in initially failed — see gotcha below). Either
way, "admin" access is just whichever account's email matches
`yousef3talla@gmail.com`; anyone can create an unrelated email/password
account through the same form, it simply won't pass the admin email check
in `firestore.rules`/`storage.rules` or in the UI gate in `js/admin.js`.

**Gotcha hit during setup:** Google sign-in failed on the live GitHub Pages
site until the deployed domain (`yousefat123.github.io`) was added to
Firebase Console → Authentication → Settings → Authorized domains
(`localhost` alone, added during initial setup, isn't enough — every real
domain the site is served from needs to be added explicitly).

## Known data issues from the old hardcoded catalog (relevant to the Firestore import, not a live sheet anymore)

1. **Duplicate ids/photos:** `MAA-001`/`002`/`003` (date, walnut, pistachio
   maamoul) currently share one photo. Fix by uploading a distinct photo per
   item via the admin panel's Upload Photo field once real photos exist.
2. **Filename typo (legacy, cosmetic only):** the old Drive file was named
   `SWE-OO1.jpg` (letters "OO" instead of zeros) — irrelevant once each
   product has a real Storage-uploaded photo.

## Site architecture (current state)

Static HTML/CSS/JS, no framework, no build step. File/folder names use
hyphens only — no spaces, per explicit instruction. New Firebase code is
loaded as ES modules (`type="module"`) after the original classic scripts;
`app.js` stays a classic script and is bridged via `window.LamiaFirebase`
and `window.setLiveProducts()` (see Firebase section above).

```
lamias-goodies-website/
  index.html              storefront: catalog + WhatsApp ordering + header
                          sign-in/account UI (#authArea)
  account.html            customer's own page: profile, favorites, order
                          history (gated: shows a sign-in prompt if logged out)
  admin.html              admin panel: product CRUD + photo upload, one-time
                          "Import legacy products" button, order management
  css/styles.css
  js/
    config.js              WhatsApp number + adminEmail
    i18n.js                 all UI strings + category labels, per language
    products-data.js        fallback catalog (used if Firestore is
                          unreachable/unconfigured) + migration source
    firebase-config.js      Firebase CDN imports + real project config,
                          fetches live products -> window.setLiveProducts()
    auth.js                  sign-in/up modal (email+password and Google),
                          header avatar/dropdown, creates users/{uid} on
                          first login, defines window.LamiaFirebase (the
                          bridge app.js/account.js call into)
    account.js               account.html logic: profile form, favorites
                          list (with remove), order history list
    admin.js                 admin.html logic: auth-gated product CRUD,
                          photo upload, legacy-import button, order list
                          with mark-fulfilled/cancel controls
    app.js                   rendering, language switching, WhatsApp link
                          building, favorite-heart + order-recording hooks,
                          exposes window.setLiveProducts()/translateDom()
  firestore.rules           paste into Firebase Console -> Firestore -> Rules
  storage.rules             paste into Firebase Console -> Storage -> Rules
  assets/icons/             empty, placeholder for future PWA icons
  README.md
  .gitignore
```

All 6 plan phases are built (Phase 1 through Phase 6 — see Next Steps).
`app.js` remains a classic script; every Firebase-touching call in it goes
through `window.LamiaFirebase?.foo?.()` so a Firebase outage/misconfig can
never break guest browsing or WhatsApp ordering.

**Design tokens used:** cream background (#FAF3E6), amber (#C17F2B) +
burgundy (#7C2C3B) accents, ink text (#2B2018). Fonts: Cairo (Arabic
display), Almarai (Arabic body), Rubik (Hebrew), Fredoka (English display),
Inter (English body) — swapped via `body[data-lang]` CSS selectors. Visual
signature: a scalloped divider under the hero, evoking a maamoul mold edge.

## Known bug: product images (status: fix in progress via Firebase Storage)

The user reported this fixed on their end (likely via Drive sharing
permissions) as of 2026-07-18, but the durable fix is Firebase Storage —
once each product's photo is uploaded through `admin.html`'s Upload Photo
field, `photoUrl` in Firestore becomes a real Storage URL and the Drive
dependency (and its "Anyone with the link" fragility) goes away entirely.
Until then, `js/products-data.js`'s old Drive-hotlink `photoUrl(photoId)`
helper is kept as the interim value the "Import legacy products" button
writes to Firestore, so the storefront isn't left with broken images mid-
migration. (The unextracted-zip gotcha from earlier — opening `index.html`
from inside Windows' zip-browsing view breaks relative paths — no longer
applies now that the site is deployed via GitHub Pages, not opened locally.)

## Next steps, in priority order

The Firebase accounts + admin panel feature (plan at
`C:\Users\youse\.claude\plans\replicated-mixing-sun.md`) is **fully built**,
all 6 phases, as of 2026-07-18:

1. ✅ **Phase 1 — Firebase wiring + product migration.** `js/firebase-config.js`
   (real project config wired in), `admin.html`/`js/admin.js` (product CRUD,
   photo upload, legacy-import button), `firestore.rules`/`storage.rules`.
2. ✅ **Phase 2 — Auth.** `js/auth.js`: modal (email/password with sign-in/up
   toggle, plus Google), header avatar + dropdown, `users/{uid}` creation on
   first login.
3. ✅ **Phase 3 — Order recording.** Every order-button click writes an
   `orders` doc (guest or logged-in); admin panel lists all orders with
   mark-fulfilled/cancel controls.
4. ✅ **Phase 4 — Favorites.** Heart button on product cards, synced to
   `users/{uid}/favorites` live via `onSnapshot`.
5. ✅ **Phase 5 — Account page.** `account.html`/`js/account.js`: profile
   form (name/phone/address), favorites list (with remove), order history.
6. ✅ **Phase 6 — Polish & docs.** This doc rewritten; product edit/delete
   and order status controls exist in the admin panel already built in
   earlier phases.

**Not done, and can't be automated:** actually re-uploading a real photo for
each product via `admin.html`'s Upload Photo field (or bulk via the DB) —
until that happens, imported products still show the old Drive-hotlink
photo as an interim value. Do this once real product photos exist.

**Verification still needed from the user** (requires real login, which
Claude cannot do on the user's behalf): sign up/in as
`yousef3talla@gmail.com` on the live site, confirm the admin panel loads,
run "Import legacy products" once, upload a real photo for one product,
place a test order (logged in and as guest) and confirm both show up in
the admin order list, toggle a favorite and confirm it shows on
`account.html`.

Deferred until the above is verified and soft-launched:
- **Make it installable** — `manifest.json` + real icons in `assets/icons/`.
- **Cart + real payment** only once real order volume justifies it — use an
  Israeli processor (Tranzila/Cardcom), not Stripe/Square.

GitHub Pages was confirmed live and working during this session (the
`yousefat123.github.io/-lamias-goodies-website/` URL was tested directly).

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

- **Git is initialized and pushed to GitHub** (2026-07-18). Branch renamed
  `master` → `main`. Remote: `origin` →
  https://github.com/yousefat123/-lamias-goodies-website
  `.claude/settings.local.json` is gitignored (machine-local Claude Code
  permissions, not project content).
- Auth for push worked via Windows' existing Git Credential Manager /
  GitHub login on this machine — no token or password was entered by
  Claude at any point.
- All file/folder names must stay space-free (hyphens only) per explicit
  project convention.
- **Keep this file up to date.** Update PROJECT_CONTEXT.md after each
  meaningful change/decision in this project, not just at the end of a
  session — this is an explicit standing instruction from the user
  (2026-07-18).
