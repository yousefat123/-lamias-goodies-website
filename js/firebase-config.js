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
  apiKey: "AIzaSyAbKzFXjL1cAprvbeAWw5uFwR3sB3aCe5Y",
  authDomain: "lamias-goodies.firebaseapp.com",
  projectId: "lamias-goodies",
  storageBucket: "lamias-goodies.firebasestorage.app",
  messagingSenderId: "579398769410",
  appId: "1:579398769410:web:5d637c23abb3eb1423001b"
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

// Firebase Auth has no native "phone number + password" account type — only
// SMS-verified phone auth or email/password. Per explicit user decision
// (accepting that this means no proof the signer-up actually owns the
// number — there's no OTP check), phone accounts are implemented as a
// regular email/password account under the hood, using this synthetic,
// never-shown, never-real "email" derived from the phone number. Every
// caller (login.js for sign in/up, auth.js/account.js for reading the
// profile back out) must use this exact helper so accounts round-trip
// consistently.
const PHONE_EMAIL_DOMAIN = "phone.lamias-goodies.local";
function phoneToSyntheticEmail(e164Phone) {
  return `${e164Phone.replace("+", "")}@${PHONE_EMAIL_DOMAIN}`;
}
function isPhoneSyntheticEmail(email) {
  return !!email && email.endsWith(`@${PHONE_EMAIL_DOMAIN}`);
}
function syntheticEmailToPhone(email) {
  return `+${email.split("@")[0]}`;
}

export {
  app, auth, db, storage, isConfigured,
  phoneToSyntheticEmail, isPhoneSyntheticEmail, syntheticEmailToPhone
};
