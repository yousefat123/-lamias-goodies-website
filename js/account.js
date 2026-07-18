import { auth, db, isConfigured } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  doc, getDoc, updateDoc, deleteDoc, collection, getDocs, query, where, orderBy
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

function lang() {
  return document.body.getAttribute("data-lang") || "ar";
}

// account.html doesn't load app.js, so it needs its own minimal language
// switching (same pattern as js/admin.js) rather than relying on app.js's.
window.translateDom = function (root) {
  const t = I18N[lang()];
  (root || document).querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (t[key]) el.textContent = t[key];
  });
};

function applyLang(newLang) {
  document.body.setAttribute("data-lang", newLang);
  document.documentElement.setAttribute("lang", newLang);
  document.documentElement.setAttribute("dir", I18N[newLang].dir);
  window.translateDom(document);
  document.querySelectorAll(".lang-switch button").forEach((b) => {
    b.classList.toggle("active", b.getAttribute("data-setlang") === newLang);
  });
  document.dispatchEvent(new CustomEvent("langchange", { detail: newLang }));
}

document.querySelectorAll(".lang-switch button").forEach((b) => {
  b.addEventListener("click", () => applyLang(b.getAttribute("data-setlang")));
});
window.translateDom(document);

const signedOutBox = document.getElementById("accountSignedOut");
const contentBox = document.getElementById("accountContent");

document.getElementById("accountSignInBtn").addEventListener("click", () => {
  window.LamiaFirebase?.requireLogin?.();
});

if (!isConfigured) {
  signedOutBox.hidden = false;
} else {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      signedOutBox.hidden = false;
      contentBox.hidden = true;
      return;
    }
    signedOutBox.hidden = true;
    contentBox.hidden = false;
    await loadProfile(user);
    await loadFavorites(user);
    await loadOrders(user);
  });
}

// ---- Profile ----

const profileForm = document.getElementById("profileForm");
const profileSavedMsg = document.getElementById("profileSavedMsg");

async function loadProfile(user) {
  document.getElementById("profileEmail").value = user.email || "";
  const snap = await getDoc(doc(db, "users", user.uid));
  const data = snap.exists() ? snap.data() : {};
  document.getElementById("profileName").value = data.displayName || "";
  document.getElementById("profilePhone").value = data.phone || "";
  document.getElementById("profileAddress").value = data.address || "";
}

profileForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;
  profileSavedMsg.hidden = true;
  await updateDoc(doc(db, "users", user.uid), {
    displayName: document.getElementById("profileName").value.trim(),
    phone: document.getElementById("profilePhone").value.trim(),
    address: document.getElementById("profileAddress").value.trim()
  });
  profileSavedMsg.textContent = I18N[lang()].profileSaved;
  profileSavedMsg.hidden = false;
});

// ---- Favorites ----

const favoritesListEl = document.getElementById("favoritesList");

async function loadFavorites(user) {
  const t = I18N[lang()];
  favoritesListEl.textContent = t.loading;
  const favSnap = await getDocs(collection(db, "users", user.uid, "favorites"));
  if (favSnap.empty) {
    favoritesListEl.textContent = t.favoritesEmpty;
    return;
  }
  favoritesListEl.innerHTML = "";
  for (const favDoc of favSnap.docs) {
    const productId = favDoc.id;
    const productSnap = await getDoc(doc(db, "products", productId));
    const p = productSnap.exists() ? productSnap.data() : null;
    const row = document.createElement("div");
    row.className = "admin-product-row";
    row.innerHTML = `
      <img src="${p?.photoUrl || ""}" alt="">
      <div class="admin-product-row-info">
        <strong>${p?.name?.[lang()] || productId}</strong>
        <span>${p ? "₪" + p.price : ""}</span>
      </div>
      <div class="cta-row">
        <button class="btn btn-ghost" data-remove>${t.deleteProduct}</button>
      </div>
    `;
    row.querySelector("[data-remove]").addEventListener("click", async () => {
      await deleteDoc(doc(db, "users", user.uid, "favorites", productId));
      loadFavorites(user);
    });
    favoritesListEl.appendChild(row);
  }
}

// ---- Order history ----

const ordersListEl = document.getElementById("ordersList");

async function loadOrders(user) {
  const t = I18N[lang()];
  ordersListEl.textContent = t.loading;
  const snap = await getDocs(
    query(collection(db, "orders"), where("userId", "==", user.uid), orderBy("createdAt", "desc"))
  );
  if (snap.empty) {
    ordersListEl.textContent = t.ordersEmpty;
    return;
  }
  ordersListEl.innerHTML = "";
  snap.docs.forEach((d) => {
    const o = d.data();
    const when = o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString(lang()) : "";
    const row = document.createElement("div");
    row.className = "admin-product-row";
    row.innerHTML = `
      <div class="admin-product-row-info">
        <strong>${o.productName} — ₪${o.price}</strong>
        <span>${when} · <span class="status-badge status-${o.status}">${t.orderStatus[o.status] || o.status}</span></span>
      </div>
    `;
    ordersListEl.appendChild(row);
  });
}

document.addEventListener("langchange", () => {
  const user = auth?.currentUser;
  if (user) {
    loadFavorites(user);
    loadOrders(user);
  }
});
