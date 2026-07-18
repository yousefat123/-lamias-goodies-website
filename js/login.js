import { auth, db, isConfigured, phoneToSyntheticEmail } from "./firebase-config.js";
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, GoogleAuthProvider, sendEmailVerification, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

// Every phone number on this site is Israeli for now — the UI only takes
// the local part (e.g. "054-1234567" or "0541234567") and this fixed
// prefix is prepended, matching CONFIG.whatsappNumber's convention
// elsewhere in the codebase (Israel, no separate country picker yet).
const PHONE_COUNTRY_CODE = "+972";
function toE164(localNumber) {
  const digits = localNumber.replace(/\D/g, "").replace(/^0/, "");
  return digits ? `${PHONE_COUNTRY_CODE}${digits}` : null;
}

// Only ever redirect to a known page of this site — never trust the raw
// query param, to avoid an open-redirect if this URL is ever shared/crafted.
const ALLOWED_NEXT = ["index.html", "account.html", "admin.html"];
function getNextUrl() {
  const requested = new URLSearchParams(location.search).get("next");
  return ALLOWED_NEXT.includes(requested) ? requested : "index.html";
}

let currentLang = "ar";
function lang() { return currentLang; }

// login.html doesn't load app.js, so it needs its own minimal language
// switching (same pattern as js/admin.js and js/account.js).
window.translateDom = function (root) {
  const t = I18N[currentLang];
  (root || document).querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (t[key]) el.textContent = t[key];
  });
};

function applyLang(newLang) {
  currentLang = newLang;
  document.body.setAttribute("data-lang", newLang);
  document.documentElement.setAttribute("lang", newLang);
  document.documentElement.setAttribute("dir", I18N[newLang].dir);
  window.translateDom(document);
  document.querySelectorAll(".lang-switch button").forEach((b) => {
    b.classList.toggle("active", b.getAttribute("data-setlang") === newLang);
  });
  applyMode();
}

document.querySelectorAll(".lang-switch button").forEach((b) => {
  b.addEventListener("click", () => applyLang(b.getAttribute("data-setlang")));
});
window.translateDom(document);

// ---- Sign in / sign up mode ----

const titleEl = document.getElementById("authPageTitle");
const submitBtn = document.getElementById("loginSubmitBtn");
const phoneSubmitBtn = document.getElementById("phoneSubmitBtn");
const toggleLink = document.getElementById("loginToggleModeLink");
const errorEl = document.getElementById("loginError");
const forgotPasswordLink = document.getElementById("forgotPasswordLink");
let mode = "signin"; // shared by both the email form and the phone form below

function applyMode() {
  const t = I18N[lang()];
  titleEl.textContent = mode === "signin" ? t.welcomeBack : t.createAccountTitle;
  submitBtn.textContent = mode === "signin" ? t.signIn : t.signUp;
  phoneSubmitBtn.textContent = mode === "signin" ? t.signIn : t.signUp;
  toggleLink.textContent = mode === "signin" ? t.toggleToSignUp : t.toggleToSignIn;
  forgotPasswordLink.textContent = t.forgotPassword;
  forgotPasswordLink.hidden = mode !== "signin";
}
applyMode();

toggleLink.addEventListener("click", (e) => {
  e.preventDefault();
  mode = mode === "signin" ? "signup" : "signin";
  errorEl.hidden = true;
  applyMode();
});

function showError(err) {
  const detail = err?.code || err?.message || "";
  errorEl.textContent = I18N[lang()].authErrorGeneric + (detail ? ` (${detail})` : "");
  errorEl.hidden = false;
  console.error(err);
}

// ---- Auth actions ----

if (!isConfigured) {
  errorEl.textContent = "Firebase is not configured yet — see js/firebase-config.js.";
  errorEl.hidden = false;
  submitBtn.disabled = true;
  document.getElementById("loginGoogleBtn").disabled = true;
} else {
  // Suppressed while a sign-in/sign-up action is in flight below, so that
  // action can finish its own steps (e.g. sending the verification email)
  // before navigating away — otherwise this listener firing the instant
  // Firebase reports a user would redirect first and race that step.
  let suppressAutoRedirect = false;

  onAuthStateChanged(auth, (user) => {
    if (user && !suppressAutoRedirect) location.href = getNextUrl();
  });

  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    suppressAutoRedirect = true;
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    try {
      if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(cred.user);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      location.href = getNextUrl();
    } catch (err) {
      suppressAutoRedirect = false;
      showError(err);
    }
  });

  forgotPasswordLink.addEventListener("click", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    const email = document.getElementById("loginEmail").value.trim();
    if (!email) {
      errorEl.textContent = I18N[lang()].resetEmailRequired;
      errorEl.hidden = false;
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      errorEl.className = "form-success";
      errorEl.textContent = I18N[lang()].resetEmailSent;
      errorEl.hidden = false;
    } catch (err) {
      errorEl.className = "form-error";
      showError(err);
    }
  });

  document.getElementById("loginGoogleBtn").addEventListener("click", async () => {
    errorEl.hidden = true;
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      location.href = getNextUrl();
    } catch (err) {
      showError(err);
    }
  });

  // ---- Phone sign-in (phone number + password, no SMS verification) ----
  // Explicit user decision: simpler than SMS, but means no proof anyone
  // "owns" the phone number they type in — it's really just a username.
  // Implemented as a regular Firebase email/password account under a
  // synthetic email derived from the phone (see phoneToSyntheticEmail in
  // firebase-config.js) so it reuses the same well-tested Auth code path.

  const phoneError = document.getElementById("phoneError");

  function showPhoneError(err) {
    const detail = err?.code || err?.message || "";
    phoneError.textContent = I18N[lang()].authErrorGeneric + (detail ? ` (${detail})` : "");
    phoneError.hidden = false;
    console.error(err);
  }

  document.getElementById("phoneForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    phoneError.hidden = true;
    const phone = toE164(document.getElementById("loginPhone").value);
    const password = document.getElementById("loginPhonePassword").value;
    if (!phone) {
      phoneError.textContent = I18N[lang()].phoneInvalid;
      phoneError.hidden = false;
      return;
    }
    suppressAutoRedirect = true;
    const syntheticEmail = phoneToSyntheticEmail(phone);
    try {
      if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, syntheticEmail, password);
        // Written directly (not left to auth.js's ensureUserDoc) so the
        // real phone number — not the synthetic email — ends up in the
        // profile shown on account.html.
        await setDoc(doc(db, "users", cred.user.uid), {
          email: null,
          phone,
          displayName: "",
          address: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      } else {
        await signInWithEmailAndPassword(auth, syntheticEmail, password);
      }
      location.href = getNextUrl();
    } catch (err) {
      suppressAutoRedirect = false;
      showPhoneError(err);
    }
  });
}
