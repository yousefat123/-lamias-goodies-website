// Firebase project wiring. This file is safe to commit — the values below are
// public client identifiers, not secrets. Real security comes from
// firestore.rules / storage.rules, not from hiding this config.
//
// Fill in firebaseConfig below with the values from:
// Firebase Console -> Project settings -> General -> Your apps -> Web app
// Until real values are set, every export below resolves to null and every
// caller (auth.js, admin.js, account.js, app.js) is written to fall back to
// guest/local behavior instead of throwing.

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: null,
  authDomain: null,
  projectId: null,
  storageBucket: null,
  messagingSenderId: null,
  appId: null
};

const isConfigured = Object.values(firebaseConfig).every((v) => v !== null);

let app = null;
let auth = null;
let db = null;
let storage = null;

if (isConfigured) {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
} else {
  console.warn(
    "Firebase is not configured yet (js/firebase-config.js). " +
    "Accounts, favorites, order recording and the admin panel are disabled " +
    "until firebaseConfig is filled in — guest browsing and WhatsApp ordering " +
    "still work normally."
  );
}

// Fetch the live catalog from Firestore and hand it to app.js (a classic
// script, so this is the bridge: app.js exposes window.setLiveProducts and
// keeps its own hardcoded PRODUCTS array as the fallback on any failure).
async function loadLiveProducts() {
  if (!isConfigured || !db || typeof window.setLiveProducts !== "function") return;
  try {
    const snap = await getDocs(collection(db, "products"));
    if (snap.empty) return; // nothing imported yet — keep showing the fallback catalog
    const products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    window.setLiveProducts(products);
  } catch (err) {
    console.error("Failed to load live product data, keeping local fallback catalog:", err);
  }
}

loadLiveProducts();

export { app, auth, db, storage, isConfigured };
