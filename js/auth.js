import { auth, db, isConfigured } from "./firebase-config.js";
import {
  onAuthStateChanged, signOut as fbSignOut
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, deleteDoc, addDoc, collection, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

function lang() {
  return document.body.getAttribute("data-lang") || "ar";
}
function t() {
  return I18N[lang()];
}

// Sign-in/sign-up itself lives on the dedicated login.html page (shared by
// every page on the site), not in a modal here. This just sends the visitor
// there and back to wherever they were.
function redirectToLogin() {
  const here = location.pathname.split("/").pop() || "index.html";
  location.href = `login.html?next=${encodeURIComponent(here)}`;
}

// ---- Cart modal markup, injected once ----

document.body.insertAdjacentHTML("beforeend", `
<div class="modal-overlay" id="cartModalOverlay" hidden>
  <div class="modal cart-modal">
    <button class="modal-close" id="cartModalClose" aria-label="close">&times;</button>
    <h3 data-i18n="cart"></h3>
    <div id="cartItemsList"></div>
    <div class="cart-total-row">
      <span data-i18n="total"></span>
      <strong id="cartTotalAmount"></strong>
    </div>
    <button class="btn btn-primary cart-checkout-btn" id="cartCheckoutBtn" data-i18n="checkoutWhatsapp"></button>
  </div>
</div>
`);

document.addEventListener("langchange", () => {
  renderAuthArea(auth?.currentUser || null);
  renderCartButton();
  renderCartItems();
});

// ---- Cart modal ----

const cartOverlay = document.getElementById("cartModalOverlay");
const cartItemsList = document.getElementById("cartItemsList");

function openCartModal() {
  renderCartItems();
  cartOverlay.hidden = false;
}
function closeCartModal() {
  cartOverlay.hidden = true;
}
document.getElementById("cartModalClose").addEventListener("click", closeCartModal);
cartOverlay.addEventListener("click", (e) => {
  if (e.target === cartOverlay) closeCartModal();
});
document.getElementById("cartCheckoutBtn").addEventListener("click", () => {
  checkoutCart();
});

// ---- Header auth area ----

const authArea = document.getElementById("authArea");

function renderAuthArea(user) {
  if (!authArea) return;
  authArea.innerHTML = "";

  if (!user) {
    const link = document.createElement("a");
    link.href = "login.html";
    link.className = "btn btn-ghost auth-signin-btn";
    link.setAttribute("data-i18n", "signIn");
    link.textContent = t().signIn;
    authArea.appendChild(link);
    return;
  }

  const initial = (user.displayName || user.email || "?").trim()[0].toUpperCase();
  const wrap = document.createElement("div");
  wrap.className = "auth-user";
  wrap.innerHTML = `
    <button class="avatar-btn" id="authAvatarBtn">${initial}</button>
    <div class="auth-dropdown" id="authDropdown" hidden>
      <a href="account.html" data-i18n="myAccount">${t().myAccount}</a>
      ${user.email === CONFIG.adminEmail ? `<a href="admin.html" data-i18n="adminPanel">${t().adminPanel}</a>` : ""}
      <button id="authSignOutBtn" data-i18n="signOut">${t().signOut}</button>
    </div>
  `;
  authArea.appendChild(wrap);

  const avatarBtn = wrap.querySelector("#authAvatarBtn");
  const dropdown = wrap.querySelector("#authDropdown");
  avatarBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.hidden = !dropdown.hidden;
  });
  document.addEventListener("click", () => { dropdown.hidden = true; }, { once: true });
  wrap.querySelector("#authSignOutBtn").addEventListener("click", () => fbSignOut(auth));
}

// ---- Header cart button ----

const cartArea = document.getElementById("cartArea");

function renderCartButton() {
  if (!cartArea) return;
  const count = [...cartMap.values()].reduce((sum, qty) => sum + qty, 0);
  cartArea.innerHTML = `
    <button class="cart-btn" id="cartOpenBtn" aria-label="cart">
      🛒${count > 0 ? `<span class="cart-badge">${count}</span>` : ""}
    </button>
  `;
  cartArea.querySelector("#cartOpenBtn").addEventListener("click", () => {
    if (!auth?.currentUser) { redirectToLogin(); return; }
    openCartModal();
  });
}

function renderCartItems() {
  if (!cartItemsList) return;
  const t18 = t();
  const entries = [...cartMap.entries()];
  if (entries.length === 0) {
    cartItemsList.innerHTML = `<p class="cart-empty">${t18.cartEmpty}</p>`;
    document.getElementById("cartTotalAmount").textContent = "₪0";
    return;
  }
  let total = 0;
  cartItemsList.innerHTML = "";
  entries.forEach(([productId, qty]) => {
    const p = window.getProduct?.(productId);
    if (!p) return;
    const lineTotal = p.price * qty;
    total += lineTotal;
    const row = document.createElement("div");
    row.className = "cart-item-row";
    row.innerHTML = `
      <img src="${p.photoUrl || ""}" alt="">
      <div class="cart-item-info">
        <strong>${p.name[lang()]}</strong>
        <span>₪${p.price} × ${qty} = ₪${lineTotal}</span>
      </div>
      <div class="cart-qty-controls">
        <button data-dec>−</button>
        <span>${qty}</span>
        <button data-inc>+</button>
      </div>
      <button class="cart-remove-btn" data-remove>&times;</button>
    `;
    row.querySelector("[data-inc]").addEventListener("click", () => updateCartQty(productId, qty + 1));
    row.querySelector("[data-dec]").addEventListener("click", () => updateCartQty(productId, qty - 1));
    row.querySelector("[data-remove]").addEventListener("click", () => updateCartQty(productId, 0));
    cartItemsList.appendChild(row);
  });
  document.getElementById("cartTotalAmount").textContent = `₪${total}`;
}

// ---- Firestore-backed user doc + favorites + cart sync ----

let favoritesSet = new Set();
let favoritesUnsub = null;
let cartMap = new Map();
let cartUnsub = null;

async function ensureUserDoc(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      email: user.email,
      displayName: user.displayName || "",
      phone: null,
      address: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
}

function syncFavorites(uid) {
  favoritesUnsub?.();
  favoritesUnsub = onSnapshot(collection(db, "users", uid, "favorites"), (snap) => {
    favoritesSet = new Set(snap.docs.map((d) => d.id));
    window.renderProducts?.();
  });
}

function syncCart(uid) {
  cartUnsub?.();
  cartUnsub = onSnapshot(collection(db, "users", uid, "cart"), (snap) => {
    cartMap = new Map(snap.docs.map((d) => [d.id, d.data().quantity || 1]));
    renderCartButton();
    renderCartItems();
  });
}

if (isConfigured) {
  onAuthStateChanged(auth, async (user) => {
    renderAuthArea(user);
    renderCartButton();
    if (user) {
      await ensureUserDoc(user);
      syncFavorites(user.uid);
      syncCart(user.uid);
    } else {
      favoritesUnsub?.();
      favoritesUnsub = null;
      favoritesSet = new Set();
      cartUnsub?.();
      cartUnsub = null;
      cartMap = new Map();
      window.renderProducts?.();
      renderCartButton();
    }
  });
} else {
  renderAuthArea(null);
  renderCartButton();
}

// ---- Cart mutations ----

async function updateCartQty(productId, qty) {
  const user = auth?.currentUser;
  if (!user) { redirectToLogin(); return; }
  const ref = doc(db, "users", user.uid, "cart", productId);
  if (qty <= 0) {
    await deleteDoc(ref);
  } else {
    await setDoc(ref, { productId, quantity: qty, addedAt: serverTimestamp() }, { merge: true });
  }
}

async function checkoutCart() {
  const user = auth?.currentUser;
  if (!user || cartMap.size === 0) return;
  const t18 = t();
  const entries = [...cartMap.entries()];
  let total = 0;
  const lines = entries
    .map(([productId, qty]) => {
      const p = window.getProduct?.(productId);
      if (!p) return null;
      total += p.price * qty;
      return `- ${p.name[lang()]} x${qty} (₪${p.price * qty})`;
    })
    .filter(Boolean)
    .join("\n");

  window.open(
    `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(t18.cartWaMsg(lines, total))}`,
    "_blank"
  );

  for (const [productId, qty] of entries) {
    const p = window.getProduct?.(productId);
    if (!p) continue;
    await addDoc(collection(db, "orders"), {
      userId: user.uid,
      productId,
      productName: p.name[lang()],
      price: p.price * qty,
      lang: lang(),
      status: "pending",
      createdAt: serverTimestamp(),
      source: "whatsapp-cart"
    });
    await deleteDoc(doc(db, "users", user.uid, "cart", productId));
  }
  closeCartModal();
}

// ---- Bridge for app.js (classic script) ----

window.LamiaFirebase = {
  currentUser: () => auth?.currentUser || null,
  requireLogin: () => redirectToLogin(),
  get favoritesSet() { return favoritesSet; },
  toggleFavorite: async (productId) => {
    const user = auth?.currentUser;
    if (!user) { redirectToLogin(); return; }
    const ref = doc(db, "users", user.uid, "favorites", productId);
    if (favoritesSet.has(productId)) {
      await deleteDoc(ref);
    } else {
      await setDoc(ref, { productId, addedAt: serverTimestamp() });
    }
  },
  addToCart: async (productId) => {
    const user = auth?.currentUser;
    if (!user) { redirectToLogin(); return; }
    await updateCartQty(productId, (cartMap.get(productId) || 0) + 1);
  },
  recordOrder: async (product, orderLang) => {
    if (!isConfigured) return;
    const user = auth?.currentUser;
    await addDoc(collection(db, "orders"), {
      userId: user ? user.uid : null,
      productId: product.id,
      productName: product.name[orderLang],
      price: product.price,
      lang: orderLang,
      status: "pending",
      createdAt: serverTimestamp(),
      source: "whatsapp"
    });
  },
  signOut: () => fbSignOut(auth)
};
