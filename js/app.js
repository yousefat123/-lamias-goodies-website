let currentLang = "ar";
let currentCat = "all";
let products = PRODUCTS; // replaced with live data in loadProducts() if configured

function waLink(text) {
  return `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(text)}`;
}

async function loadProducts() {
  if (!CONFIG.productsApiUrl) {
    products = PRODUCTS;
    return;
  }
  try {
    const res = await fetch(CONFIG.productsApiUrl);
    const data = await res.json();
    products = data;
  } catch (err) {
    console.error("Failed to load live product data, falling back to local copy:", err);
    products = PRODUCTS;
  }
}

function applyLang(lang) {
  currentLang = lang;
  const t = I18N[lang];
  document.body.setAttribute("data-lang", lang);
  document.documentElement.setAttribute("lang", lang);
  document.documentElement.setAttribute("dir", t.dir);

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (t[key]) el.textContent = t[key];
  });

  document.getElementById("mainWhatsapp").href = waLink(t.waMsg(t.brandName));

  document.querySelectorAll(".lang-switch button").forEach((b) => {
    b.classList.toggle("active", b.getAttribute("data-setlang") === lang);
  });

  renderCategories();
  renderProducts();
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
    card.innerHTML = `
      <img src="${photoUrl(p.photoId)}" alt="${p.name[currentLang]}" loading="lazy">
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
    });
    grid.appendChild(card);
  });
}

async function init() {
  await loadProducts();
  document.querySelectorAll(".lang-switch button").forEach((b) => {
    b.addEventListener("click", () => applyLang(b.getAttribute("data-setlang")));
  });
  applyLang("ar");
}

init();
