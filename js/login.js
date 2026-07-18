import { auth, isConfigured } from "./firebase-config.js";
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, GoogleAuthProvider, sendEmailVerification
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

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
}
