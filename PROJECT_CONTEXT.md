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
  index.html
  admin.html             admin panel: product CRUD, photo upload, one-time
                          "Import legacy products" migration button
  css/styles.css
  js/
    config.js             WhatsApp number + adminEmail
    i18n.js                all UI strings + category labels, per language
    products-data.js       fallback catalog (used if Firestore is
                          unreachable/unconfigured) + migration source
    firebase-config.js     Firebase CDN imports, project config (fill in
                          real values here once the Firebase project
                          exists), fetches live products -> setLiveProducts()
    admin.js                admin.html logic: auth-gated product CRUD
    app.js                  rendering, language switching, WhatsApp link
                          building, exposes window.setLiveProducts()
  firestore.rules          paste into Firebase Console -> Firestore -> Rules
  storage.rules            paste into Firebase Console -> Storage -> Rules
  assets/icons/            empty, placeholder for future PWA icons
  README.md
  .gitignore
```

Not yet built (see Next Steps): `js/auth.js` (customer sign-in/up modal),
`account.html`/`js/account.js` (profile, favorites, order history),
favorites/order-recording wiring in `app.js`.

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

Implementing the Firebase accounts + admin panel feature (see plan at
`C:\Users\youse\.claude\plans\replicated-mixing-sun.md`), phase by phase:

1. ✅ **Phase 1 — Firebase wiring + product migration** (done 2026-07-18):
   `js/firebase-config.js`, `admin.html`/`js/admin.js` (product CRUD, photo
   upload, legacy-import button), `firestore.rules`/`storage.rules` written.
   Verified locally: guest browsing/ordering still works unaffected when
   Firebase is unconfigured; `admin.html` correctly shows a disabled
   login state. **Blocked on the user**: create the Firebase project and
   send back the real `firebaseConfig` values (see checklist in the plan
   file) so `js/firebase-config.js` can be filled in and this phase can be
   tested end-to-end (Firestore reads/writes, Storage upload, import button).
2. **Phase 2 — Auth** (`js/auth.js`, header sign-in modal, `users/{uid}`
   creation on first login) — not started, purely additive once built.
3. **Phase 3 — Order recording** (`orders` collection + admin order list) —
   not started.
4. **Phase 4 — Favorites** (heart button + `users/{uid}/favorites`) — not
   started.
5. **Phase 5 — Account page** (`account.html`/`js/account.js`: profile,
   favorites, order history) — not started.
6. **Phase 6 — Polish & docs** (product edit/delete refinement, order status
   workflow, remove residual Drive dependency) — not started.

Deferred until the above is done and soft-launched:
- **Make it installable** — `manifest.json` + real icons in `assets/icons/`.
- **Cart + real payment** only once real order volume justifies it — use an
  Israeli processor (Tranzila/Cardcom), not Stripe/Square.

**Still outstanding, not yet confirmed done:** enabling GitHub Pages
(Settings -> Pages -> Deploy from branch `main` -> Save) — walked the user
through the steps but never got confirmation it was actually turned on.
Verify before assuming the site is publicly live.

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
