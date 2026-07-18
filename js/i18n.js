// UI translations. Add a new language by adding a new key here
// and a matching font rule in css/styles.css (body[data-lang="xx"]).
const I18N = {
  ar: {
    dir: "rtl",
    brandName: "حلويات لمياء",
    heroTitle: "حلويات ومعجنات منزلية بنكهة أصيلة",
    heroSub: "كل قطعة تُصنع يدويًا بحب — كعك، معمول، وحلويات عربية تقليدية.",
    orderWhatsapp: "اطلب عبر واتساب",
    callUs: "اتصلي بنا",
    footerNote: "لمياء غودز — صُنع بحب 🍯",
    catAll: "الكل",
    order: "اطلب",
    waMsg: (name) => `مرحبًا، أريد أن أطلب: ${name}`,
    categories: { cakes: "كيك", maamoul: "معمول وحلويات تقليدية", sweets: "حلويات" }
  },
  he: {
    dir: "rtl",
    brandName: "מתוקי לאמיה",
    heroTitle: "מתוקים ומאפים ביתיים בטעם אמיתי",
    heroSub: "כל פריט מוכן ביד ובאהבה — עוגות, מעמול, וממתקים ערביים מסורתיים.",
    orderWhatsapp: "הזמינו בוואטסאפ",
    callUs: "התקשרו אלינו",
    footerNote: "מתוקי לאמיה — נעשה באהבה 🍯",
    catAll: "הכול",
    order: "הזמנה",
    waMsg: (name) => `שלום, אני רוצה להזמין: ${name}`,
    categories: { cakes: "עוגות", maamoul: "מעמול ומתוקים מסורתיים", sweets: "ממתקים" }
  },
  en: {
    dir: "ltr",
    brandName: "Lamia's Goodies",
    heroTitle: "Homemade sweets & pastries, made the traditional way",
    heroSub: "Every piece made by hand with love — cakes, maamoul, and traditional Arab sweets.",
    orderWhatsapp: "Order via WhatsApp",
    callUs: "Call us",
    footerNote: "Lamia's Goodies — made with love 🍯",
    catAll: "All",
    order: "Order",
    waMsg: (name) => `Hi, I'd like to order: ${name}`,
    categories: { cakes: "Cakes", maamoul: "Maamoul & Traditional Sweets", sweets: "Sweets" }
  }
};
