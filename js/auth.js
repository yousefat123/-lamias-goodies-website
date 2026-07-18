import { auth, db, isConfigured } from "./firebase-config.js";
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, GoogleAuthProvider, signOut as fbSignOut
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

// ---- Modal markup, injected once ----

document.body.insertAdjacentHTML("beforeend", `
<div class="modal-overlay" id="authModalOverlay" hidden>
  <div class="modal">
    <button class="modal-close" id="authModalClose" aria-label="close">&times;</button>
    <div class="field-row">
      <label data-i18n="emailLabel"></label>
      <input type="email" id="authEmail" autocomplete="username">
    </div>
    <div class="field-row">
      <label data-i18n="passwordLabel"></label>
      <input type="password" id="authPassword" autocomplete="current-password">
    </div>
    <div class="form-error" id="authModalError" hidden></div>
    <div class="cta-row">
      <button class="btn btn-primary" id="authSubmitBtn" data-i18n="signIn"></button>
      <button class="btn btn-ghost" id="authGoogleBtn" data-i18n="continueWithGoogle"></button>
    </div>
    <a href="#" class="toggle-auth-link" id="authToggleModeLink" data-i18n="toggleToSignUp"></a>
  </div>
</div>
`);

const overlay = document.getElementById("authModalOverlay");
const modalError = document.getElementById("authModalError");
const submitBtn = document.getElementById("authSubmitBtn");
const toggleLink = document.getElementById("authToggleModeLink");
let authMode = "signin";

function applyModalMode() {
  submitBtn.setAttribute("data-i18n", authMode === "signin" ? "signIn" : "signUp");
  toggleLink.setAttribute("data-i18n", authMode === "signin" ? "toggleToSignUp" : "toggleToSignIn");
  window.translateDom?.(overlay);
}

function openModal() {
  modalError.hidden = true;
  document.getElementById("authEmail").value = "";
  document.getElementById("authPassword").value = "";
  authMode = "signin";
  applyModalMode();
  overlay.hidden = false;
}
function closeModal() {
  overlay.hidden = true;
}

document.getElementById("authModalClose").addEventListener("click", closeModal);
overlay.addEventListener("click", (e) => {
  if (e.target === overlay) closeModal();
});
toggleLink.addEventListener("click", (e) => {
  e.preventDefault();
  authMode = authMode === "signin" ? "signup" : "signin";
  modalError.hidden = true;
  applyModalMode();
});

function showModalError(err) {
  modalError.textContent = t().authErrorGeneric;
  modalError.hidden = false;
  console.error(err);
}

if (isConfigured) {
  document.getElementById("authSubmitBtn").addEventListener("click", async () => {
    modalError.hidden = true;
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    try {
      if (authMode === "signup") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      closeModal();
    } catch (err) {
      showModalError(err);
    }
  });

  document.getElementById("authGoogleBtn").addEventListener("click", async () => {
    modalError.hidden = true;
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      closeModal();
    } catch (err) {
      showModalError(err);
    }
  });
}

document.addEventListener("langchange", () => {
  applyModalMode();
  renderAuthArea(auth?.currentUser || null);
});

// ---- Header auth area ----

const authArea = document.getElementById("authArea");

function renderAuthArea(user) {
  if (!authArea) return;
  authArea.innerHTML = "";

  if (!user) {
    const btn = document.createElement("button");
    btn.className = "btn btn-ghost auth-signin-btn";
    btn.setAttribute("data-i18n", "signIn");
    btn.textContent = t().signIn;
    btn.addEventListener("click", openModal);
    authArea.appendChild(btn);
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

// ---- Firestore-backed user doc + favorites sync ----

let favoritesSet = new Set();
let favoritesUnsub = null;

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

if (isConfigured) {
  onAuthStateChanged(auth, async (user) => {
    renderAuthArea(user);
    if (user) {
      await ensureUserDoc(user);
      syncFavorites(user.uid);
    } else {
      favoritesUnsub?.();
      favoritesUnsub = null;
      favoritesSet = new Set();
      window.renderProducts?.();
    }
  });
} else {
  renderAuthArea(null);
}

// ---- Bridge for app.js (classic script) ----

window.LamiaFirebase = {
  currentUser: () => auth?.currentUser || null,
  requireLogin: () => openModal(),
  get favoritesSet() { return favoritesSet; },
  toggleFavorite: async (productId) => {
    const user = auth?.currentUser;
    if (!user) { openModal(); return; }
    const ref = doc(db, "users", user.uid, "favorites", productId);
    if (favoritesSet.has(productId)) {
      await deleteDoc(ref);
    } else {
      await setDoc(ref, { productId, addedAt: serverTimestamp() });
    }
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
