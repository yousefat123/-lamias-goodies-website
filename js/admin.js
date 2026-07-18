import { auth, db, storage, isConfigured } from "./firebase-config.js";
import {
  onAuthStateChanged, signOut as fbSignOut
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  collection, doc, setDoc, updateDoc, deleteDoc, getDocs, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import {
  ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js";

let currentLang = "ar";

function translateDom() {
  const t = I18N[currentLang];
  document.body.setAttribute("data-lang", currentLang);
  document.documentElement.setAttribute("lang", currentLang);
  document.documentElement.setAttribute("dir", t.dir);
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (t[key]) el.textContent = t[key];
  });
  document.querySelectorAll(".lang-switch button").forEach((b) => {
    b.classList.toggle("active", b.getAttribute("data-setlang") === currentLang);
  });
}

document.querySelectorAll(".lang-switch button").forEach((b) => {
  b.addEventListener("click", () => {
    currentLang = b.getAttribute("data-setlang");
    translateDom();
  });
});
translateDom();

// Signing in/up itself happens on the shared login.html page (linked from
// #adminLoginBox below) — this file only gates content once Firebase
// reports whether someone, and specifically the admin, is signed in.
const loginBox = document.getElementById("adminLoginBox");
const notAuthorizedBox = document.getElementById("adminNotAuthorized");
const adminContent = document.getElementById("adminContent");

if (isConfigured) {
  document.getElementById("adminSignOutBtn").addEventListener("click", () => fbSignOut(auth));
  document.getElementById("adminSignOutBtn2").addEventListener("click", () => fbSignOut(auth));

  onAuthStateChanged(auth, (user) => {
    loginBox.hidden = true;
    notAuthorizedBox.hidden = true;
    adminContent.hidden = true;

    if (!user) {
      loginBox.hidden = false;
      return;
    }
    if (user.email !== CONFIG.adminEmail) {
      notAuthorizedBox.hidden = false;
      return;
    }
    adminContent.hidden = false;
    loadProducts();
    loadOrders();
  });
} else {
  loginBox.hidden = false;
}

// ---- Product form (add/edit) ----

const form = document.getElementById("productForm");
const productIdRow = document.getElementById("productIdRow");
const productIdInput = document.getElementById("productId");
const productDocIdInput = document.getElementById("productDocId");
const productFormError = document.getElementById("productFormError");
const cancelBtn = document.getElementById("productCancelBtn");

function resetForm() {
  form.reset();
  productDocIdInput.value = "";
  productIdInput.disabled = false;
  productIdRow.hidden = false;
  cancelBtn.hidden = true;
  productFormError.hidden = true;
}

cancelBtn.addEventListener("click", resetForm);

function fillFormForEdit(id, p) {
  productDocIdInput.value = id;
  productIdInput.value = id;
  productIdInput.disabled = true;
  document.getElementById("productCategory").value = p.category || "";
  document.getElementById("productPrice").value = p.price || 0;
  document.getElementById("nameAr").value = p.name?.ar || "";
  document.getElementById("nameHe").value = p.name?.he || "";
  document.getElementById("nameEn").value = p.name?.en || "";
  document.getElementById("descAr").value = p.desc?.ar || "";
  document.getElementById("descHe").value = p.desc?.he || "";
  document.getElementById("descEn").value = p.desc?.en || "";
  document.getElementById("productAvailable").checked = p.available !== false;
  cancelBtn.hidden = false;
  window.scrollTo({ top: form.offsetTop - 20, behavior: "smooth" });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  productFormError.hidden = true;

  const existingDocId = productDocIdInput.value;
  const id = existingDocId || productIdInput.value.trim();
  if (!id) {
    productFormError.textContent = "ID is required.";
    productFormError.hidden = false;
    return;
  }

  const data = {
    category: document.getElementById("productCategory").value.trim(),
    price: Number(document.getElementById("productPrice").value) || 0,
    name: {
      ar: document.getElementById("nameAr").value.trim(),
      he: document.getElementById("nameHe").value.trim(),
      en: document.getElementById("nameEn").value.trim()
    },
    desc: {
      ar: document.getElementById("descAr").value.trim(),
      he: document.getElementById("descHe").value.trim(),
      en: document.getElementById("descEn").value.trim()
    },
    available: document.getElementById("productAvailable").checked,
    updatedAt: serverTimestamp()
  };

  const saveBtn = document.getElementById("productSaveBtn");
  saveBtn.disabled = true;
  try {
    const fileInput = document.getElementById("productPhoto");
    const file = fileInput.files[0];
    if (file) {
      const photoRef = ref(storage, `products/${id}/${file.name}`);
      await uploadBytes(photoRef, file);
      data.photoUrl = await getDownloadURL(photoRef);
    }

    const isNew = !existingDocId;
    if (isNew) data.createdAt = serverTimestamp();
    await setDoc(doc(db, "products", id), data, { merge: true });

    resetForm();
    loadProducts();
  } catch (err) {
    productFormError.textContent = String(err.message || err);
    productFormError.hidden = false;
    console.error(err);
  } finally {
    saveBtn.disabled = false;
  }
});

// ---- Product list ----

const listEl = document.getElementById("adminProductList");

async function loadProducts() {
  listEl.textContent = I18N[currentLang].loading;
  const snap = await getDocs(collection(db, "products"));
  listEl.innerHTML = "";
  snap.docs.forEach((d) => {
    const p = d.data();
    const row = document.createElement("div");
    row.className = "admin-product-row";
    row.innerHTML = `
      <img src="${p.photoUrl || ""}" alt="">
      <div class="admin-product-row-info">
        <strong>${p.name?.en || p.name?.ar || d.id}</strong>
        <span>${d.id} · ${p.category} · ₪${p.price} · ${p.available === false ? "hidden" : "available"}</span>
      </div>
      <div class="cta-row">
        <button class="btn btn-ghost" data-edit="${d.id}" data-i18n="editProduct">Edit</button>
        <button class="btn btn-ghost" data-delete="${d.id}" data-i18n="deleteProduct">Delete</button>
      </div>
    `;
    row.querySelector("[data-edit]").addEventListener("click", () => fillFormForEdit(d.id, p));
    row.querySelector("[data-delete]").addEventListener("click", async () => {
      if (!confirm(I18N[currentLang].confirmDelete)) return;
      await deleteDoc(doc(db, "products", d.id));
      loadProducts();
    });
    listEl.appendChild(row);
  });
}

// ---- One-time legacy import ----

document.getElementById("importLegacyBtn").addEventListener("click", async () => {
  const btn = document.getElementById("importLegacyBtn");
  btn.disabled = true;
  try {
    for (const p of PRODUCTS) {
      await setDoc(doc(db, "products", p.id), {
        category: p.category,
        price: p.price,
        name: p.name,
        desc: p.desc,
        photoUrl: photoUrl(p.photoId), // interim Drive link — replace via Upload Photo above
        available: true,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      }, { merge: true });
    }
    loadProducts();
  } finally {
    btn.disabled = false;
  }
});

// ---- Orders ----

const orderListEl = document.getElementById("adminOrderList");

async function loadOrders() {
  orderListEl.textContent = I18N[currentLang].loading;
  const snap = await getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc")));
  orderListEl.innerHTML = "";
  if (snap.empty) {
    orderListEl.textContent = I18N[currentLang].ordersEmpty;
    return;
  }
  snap.docs.forEach((d) => {
    const o = d.data();
    const t = I18N[currentLang];
    const when = o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString(currentLang) : "";
    const row = document.createElement("div");
    row.className = "admin-product-row";
    row.innerHTML = `
      <div class="admin-product-row-info">
        <strong>${o.productName} — ₪${o.price}</strong>
        <span>${when} · ${o.userId ? "account" : "guest"} · <span class="status-badge status-${o.status}">${t.orderStatus[o.status] || o.status}</span></span>
      </div>
      <div class="cta-row">
        ${o.status !== "fulfilled" ? `<button class="btn btn-ghost" data-fulfill data-i18n="markFulfilled">${t.markFulfilled}</button>` : ""}
        ${o.status !== "cancelled" ? `<button class="btn btn-ghost" data-cancel data-i18n="markCancelled">${t.markCancelled}</button>` : ""}
      </div>
    `;
    row.querySelector("[data-fulfill]")?.addEventListener("click", async () => {
      await updateDoc(doc(db, "orders", d.id), { status: "fulfilled" });
      loadOrders();
    });
    row.querySelector("[data-cancel]")?.addEventListener("click", async () => {
      await updateDoc(doc(db, "orders", d.id), { status: "cancelled" });
      loadOrders();
    });
    orderListEl.appendChild(row);
  });
}
