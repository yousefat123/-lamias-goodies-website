let currentLang = "ar";
let currentCat = "all";
let products = PRODUCTS; // replaced with live Firestore data via setLiveProducts() if configured

function waLink(text) {
  return `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(text)}`;
}

// Called by js/firebase-config.js (an ES module, loaded after this classic
// script) once the live catalog has loaded. Kept as a plain global function
// rather than converting app.js to a module, so currentLang/currentCat stay
// simple globals other classic scripts can rely on.
window.setLiveProducts = function (liveProducts) {
  products = liveProducts;
  renderCategories();
  renderProducts();
};

// Walks [data-i18n] elements under root and sets their text from the current
// language. Exposed globally so runtime-injected UI (the auth modal built by
// js/auth.js, an ES module loaded after this classic script) can reuse the
// same translation mechanism instead of inventing a second one.
window.translateDom = function (root) {
  const t = I18N[currentLang];
  (root || document).querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (t[key]) el.textContent = t[key];
  });
};

function applyLang(lang) {
  currentLang = lang;
  const t = I18N[lang];
  document.body.setAttribute("data-lang", lang);
  document.documentElement.setAttribute("lang", lang);
  document.documentElement.setAttribute("dir", t.dir);

  window.translateDom(document);

  document.getElementById("mainWhatsapp").href = waLink(t.waMsg(t.brandName));

  document.querySelectorAll(".lang-switch button").forEach((b) => {
    b.classList.toggle("active", b.getAttribute("data-setlang") === lang);
  });

  renderCategories();
  renderProducts();
  document.dispatchEvent(new CustomEvent("langchange", { detail: lang }));
}

function renderCategories() {
  const t = I18N[currentLang];
  const cats = ["all", ...new Set(products.map((p) => p.category))];
  const row = document.getElementById("catRow");
  row.innerHTML = "";
  cats.forEach((c) => {
    const btn = document.createElement("button");
    btn.className = "cat-pill" + (currentCat === c ? " active" : "");
    btn.textContent = c === "all" ? t.catAll : (t.categories[c] || c);
    btn.onclick = () => {
      currentCat = c;
      renderCategories();
      renderProducts();
    };
    row.appendChild(btn);
  });
}

function renderProducts() {
  const t = I18N[currentLang];
  const grid = document.getElementById("productGrid");
  grid.innerHTML = "";
  const list = products.filter((p) => currentCat === "all" || p.category === currentCat);
  list.forEach((p) => {
    const card = document.createElement("div");
    card.className = "product";
    const imgSrc = p.photoUrl || (p.photoId ? photoUrl(p.photoId) : "");
    const isFav = window.LamiaFirebase?.favoritesSet?.has(p.id);
    card.innerHTML = `
      <div class="product-img-wrap">
        <img src="${imgSrc}" alt="${p.name[currentLang]}" loading="lazy">
        <button class="favorite-btn${isFav ? " active" : ""}" aria-label="favorite">${isFav ? "♥" : "♡"}</button>
      </div>
      <div class="product-body">
        <div class="product-cat">${t.categories[p.category] || p.category}</div>
        <div class="product-name">${p.name[currentLang]}</div>
        <div class="product-desc">${p.desc[currentLang]}</div>
        <div class="product-foot">
          <span class="price">₪${p.price}</span>
          <button class="order-btn" data-name="${p.name[currentLang]}">${t.order}</button>
        </div>
      </div>
    `;
    card.querySelector(".order-btn").addEventListener("click", () => {
      window.open(waLink(t.waMsg(p.name[currentLang])), "_blank");
      window.LamiaFirebase?.recordOrder?.(p, currentLang)?.catch(() => {});
    });
    card.querySelector(".favorite-btn").addEventListener("click", () => {
      window.LamiaFirebase?.toggleFavorite?.(p.id);
    });
    grid.appendChild(card);
  });
}

function init() {
  document.querySelectorAll(".lang-switch button").forEach((b) => {
    b.addEventListener("click", () => applyLang(b.getAttribute("data-setlang")));
  });
  applyLang("ar");
}

init();
