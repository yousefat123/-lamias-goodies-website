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
- `users/{uid}/cart/{productId}` — doc id = productId, `{ productId, quantity,
  addedAt }`. **Cart requires login** (explicit user decision, 2026-07-18,
  same as favorites) — clicking the cart icon or a product's cart button
  while signed out opens the sign-in modal instead of adding anything.
- `orders/{id}` — one doc per order (single-item WhatsApp order, or one doc
  per line item on cart checkout): `userId` (uid or `null` for guest),
  `productId`, `productName`, `price`, `lang`, `status`
  (`pending|fulfilled|cancelled`), `createdAt`, `source` (`"whatsapp"` or
  `"whatsapp-cart"`).

**Cart flow:** heart-style add-to-cart button (🛒) on every product card plus
a header cart icon with an item-count badge. Opening the cart shows a panel
with quantity steppers and a remove button per line, a running total, and a
"Checkout via WhatsApp" button that builds **one combined message** listing
every line item + total, opens WhatsApp, records one `orders` doc per line
item (`source: "whatsapp-cart"`), then clears the cart. This is additive —
the original single-item "Order" button (guest-friendly, no login, no cart)
is untouched and still the primary/fastest path.

Full plan (architecture, file list, rules, phasing) is preserved at
`C:\Users\youse\.claude\plans\replicated-mixing-sun.md` on this machine.

**Email verification** (added 2026-07-18): email/password sign-ups get a
verification email via Firebase Auth's `sendEmailVerification`; a banner on
`account.html` (with a resend button) shows for unverified email/password
accounts only — Google accounts are already verified identities, so they
never see it. Nothing is gated behind verification yet (browsing, ordering,
even admin access all work regardless) — it's informational only for now.

**Apple sign-in explicitly declined a second time** (2026-07-18, user
re-asked "add Google and Apple," confirmed to skip Apple again when told
about the $99/yr Apple Developer Program cost + needing real credentials
from that account that Claude can't obtain). Google sign-in already existed
from Phase 2. Revisit only if the user brings it up with the cost in mind.

**Live Firebase project:** `lamias-goodies` (created 2026-07-18 by the user
in Firebase Console). Real `firebaseConfig` values are committed in
`js/firebase-config.js` (safe — not secrets). Auth providers, Firestore, and
Storage were set up by the user following the checklist below.

**Sign-in is now a single dedicated page, `login.html`** (added 2026-07-18,
replacing an earlier modal-based approach and admin.html's own separate
duplicated login form — one shared implementation instead of three copies).
Every page that needs a signed-in user (`index.html` header, `account.html`,
`admin.html`) either links to `login.html?next=<page>` or — for in-flow
prompts like clicking a favorite/cart button while signed out — calls
`window.LamiaFirebase.requireLogin()`, which redirects there. On success,
`login.html` redirects back to whatever `next` said (validated against an
allowlist of real page names — `index.html`/`account.html`/`admin.html` —
so this can't be abused as an open redirect). Supports Google sign-in
(auto-creates the account on first use) and email/password with a Sign In /
Sign Up toggle. "Admin" access is just whichever account's email matches
`yousef3talla@gmail.com`; anyone can create an unrelated email/password
account through the same form, it simply won't pass the admin email check
in `firestore.rules`/`storage.rules` or in the UI gate in `js/admin.js`.

**Gotchas hit during setup:**
- Google sign-in failed on the live GitHub Pages site until the deployed
  domain (`yousefat123.github.io`) was added to Firebase Console →
  Authentication → Settings → Authorized domains (`localhost` alone, added
  during initial setup, isn't enough — every real domain the site is served
  from needs to be added explicitly).
- Email/password sign-up failed with `auth/configuration-not-found` for
  *any* email, which meant Firebase Authentication itself had never been
  activated for the project (no providers configured at all) — different
  from `auth/operation-not-allowed`, which would mean Authentication is
  active but that specific provider is off. Fix: Firebase Console →
  Authentication → click "Get Started" if that's what's showing instead of
  the Sign-in method tab, then enable providers.
- Error messages shown to the user now include the raw Firebase error code
  (e.g. `(auth/invalid-email)`) instead of only a generic translated
  string — added specifically because the generic message alone made this
  class of setup problem impossible to diagnose remotely.

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
                          sign-in/cart UI (#authArea, #cartArea)
  login.html               shared sign-in/sign-up page (Google + email/pw),
                          redirects to ?next=<page> on success
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
    login.js                  login.html logic: Google/email-password
                          sign-in+up, redirects back to the sanitized
                          ?next= page (or index.html) on success
    auth.js                  header avatar/dropdown + cart icon, redirects
                          to login.html when a signed-out visitor tries to
                          favorite/cart something, creates users/{uid} on
                          first login, cart panel (qty controls, combined
                          WhatsApp checkout), defines window.LamiaFirebase
                          (the bridge app.js/account.js call into)
    account.js               account.html logic: profile form, favorites
                          list (with remove), order history list
    admin.js                 admin.html logic: auth-gated product CRUD,
                          photo upload, legacy-import button, order list
                          with mark-fulfilled/cancel controls
    app.js                   rendering, language switching, WhatsApp link
                          building, favorite-heart + add-to-cart +
                          order-recording hooks, exposes
                          window.setLiveProducts()/translateDom()/getProduct()
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
7. ✅ **Cart** (added 2026-07-18, user request after the phased plan was
   done): add-to-cart button per product, header cart icon + badge, cart
   panel with quantity controls, combined-message WhatsApp checkout,
   `users/{uid}/cart`. Login-gated like favorites, by explicit request.

**Not done, and can't be automated:** actually re-uploading a real photo for
each product via `admin.html`'s Upload Photo field (or bulk via the DB) —
until that happens, imported products still show the old Drive-hotlink
photo as an interim value. Do this once real product photos exist.

**Action needed from the user:** `firestore.rules` was updated (added a
`cart` subcollection rule) after it was last pasted into the Firebase
Console — **re-paste the current contents of `firestore.rules` into
Firestore → Rules → Publish**, or cart reads/writes will fail against the
still-deployed older rules.

**Verification still needed from the user** (requires real login, which
Claude cannot do on the user's behalf): sign up/in as
`yousef3talla@gmail.com` on the live site (see the Google-sign-in-domain and
email/password-vs-Google gotchas above if "not authorized" shows up
unexpectedly), confirm the admin panel loads, run "Import legacy products"
once, upload a real photo for one product, place a test order (logged in
and as guest) and confirm both show up in the admin order list, toggle a
favorite and confirm it shows on `account.html`, add items to the cart and
confirm the combined WhatsApp checkout message and per-line order records
look right.

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
