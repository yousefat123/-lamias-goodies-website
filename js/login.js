import { auth, isConfigured } from "./firebase-config.js";
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, GoogleAuthProvider, sendEmailVerification,
  RecaptchaVerifier, signInWithPhoneNumber
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

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
const toggleLink = document.getElementById("loginToggleModeLink");
const errorEl = document.getElementById("loginError");
let mode = "signin";

function applyMode() {
  const t = I18N[lang()];
  titleEl.textContent = mode === "signin" ? t.welcomeBack : t.createAccountTitle;
  submitBtn.textContent = mode === "signin" ? t.signIn : t.signUp;
  toggleLink.textContent = mode === "signin" ? t.toggleToSignUp : t.toggleToSignIn;
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

  document.getElementById("loginGoogleBtn").addEventListener("click", async () => {
    errorEl.hidden = true;
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      location.href = getNextUrl();
    } catch (err) {
      showError(err);
    }
  });

  // ---- Phone sign-in ----

  const phoneError = document.getElementById("phoneError");
  const sendCodeBtn = document.getElementById("sendCodeBtn");
  const verifyCodeBtn = document.getElementById("verifyCodeBtn");
  const codeFieldRow = document.getElementById("codeFieldRow");
  let confirmationResult = null;
  let recaptchaVerifier = null;

  function showPhoneError(err) {
    const detail = err?.code || err?.message || "";
    phoneError.textContent = I18N[lang()].authErrorGeneric + (detail ? ` (${detail})` : "");
    phoneError.hidden = false;
    console.error(err);
  }

  sendCodeBtn.addEventListener("click", async () => {
    phoneError.hidden = true;
    const phone = toE164(document.getElementById("loginPhone").value);
    if (!phone) {
      phoneError.textContent = I18N[lang()].phoneInvalid;
      phoneError.hidden = false;
      return;
    }
    sendCodeBtn.disabled = true;
    try {
      recaptchaVerifier ??= new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
      confirmationResult = await signInWithPhoneNumber(auth, phone, recaptchaVerifier);
      codeFieldRow.hidden = false;
      verifyCodeBtn.hidden = false;
      phoneError.textContent = I18N[lang()].codeSent;
      phoneError.className = "form-success";
      phoneError.hidden = false;
    } catch (err) {
      showPhoneError(err);
    } finally {
      sendCodeBtn.disabled = false;
    }
  });

  verifyCodeBtn.addEventListener("click", async () => {
    if (!confirmationResult) return;
    phoneError.hidden = true;
    const code = document.getElementById("loginCode").value.trim();
    verifyCodeBtn.disabled = true;
    try {
      await confirmationResult.confirm(code);
      location.href = getNextUrl();
    } catch (err) {
      phoneError.className = "form-error";
      showPhoneError(err);
    } finally {
      verifyCodeBtn.disabled = false;
    }
  });
}
