// Temporary hardcoded product data, pulled from the Google Sheet + Drive photos
// as of the last manual sync. Once CONFIG.productsApiUrl (config.js) points to
// a deployed Apps Script Web App, app.js will fetch live data instead and this
// file becomes a fallback only.
//
// Known data issues to fix in the source sheet:
// - MAA-001/002/003 currently share one placeholder photo (only one maamoul
//   photo has been uploaded so far). Update photoId per item once real
//   photos exist for walnut and pistachio maamoul.
// - The sheet's category cell for maamoul items currently reads
//   "Tradetional arabic sweets" (typo). This file already maps them to the
//   correct "maamoul" category key regardless of the sheet typo.

function photoUrl(driveFileId) {
  return `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w600`;
}

const PRODUCTS = [
  {
    id: "CAK-001", category: "cakes", price: 120,
    photoId: "10VI1VTrbws3ItHH6HFWfqcKv_MylH4UQ",
    name: { ar: "كعكة الشوكولاتة", he: "עוגת שוקולד", en: "Chocolate Cake" },
    desc: { ar: "كيكة شوكولاتة غنية بطبقات كريمة", he: "עוגת שוקולד עשירה עם קרם", en: "Rich layered chocolate cake" }
  },
  {
    id: "MAA-001", category: "maamoul", price: 45,
    photoId: "1gbXBin1sK6zRFPUvW9W8S_IWUeXhD30b",
    name: { ar: "معمول بالتمر", he: "מעמול תמרים", en: "Date Maamoul" },
    desc: { ar: "معمول محشو بالتمر الطازج", he: "מעמול במילוי תמרים טריים", en: "Semolina cookies filled with fresh dates" }
  },
  {
    id: "MAA-002", category: "maamoul", price: 55,
    photoId: "1gbXBin1sK6zRFPUvW9W8S_IWUeXhD30b",
    name: { ar: "معمول بالجوز", he: "מעמול אגוזים", en: "Walnut Maamoul" },
    desc: { ar: "معمول محشو بالجوز الطازج", he: "מעמול במילוי אגוזים טריים", en: "Semolina cookies filled with fresh walnuts" }
  },
  {
    id: "MAA-003", category: "maamoul", price: 65,
    photoId: "1gbXBin1sK6zRFPUvW9W8S_IWUeXhD30b",
    name: { ar: "معمول فستق حلبي", he: "מעמול פיסטוק", en: "Pistachio Maamoul" },
    desc: { ar: "معمول محشو بالفستق الحلبي", he: "מעמול במילוי פיסטוק טריים", en: "Semolina cookies filled with pistachio" }
  },
  {
    id: "SWE-001", category: "sweets", price: 50,
    photoId: "1r6QkcbXegj3XVoH_-R9TkK6X-6ZlDsrf",
    name: { ar: "ألفاخوريس", he: "אלפחורס", en: "Alfajores" },
    desc: { ar: "ألفاخوريس", he: "אלפחורס", en: "Alfajores" }
  }
];
