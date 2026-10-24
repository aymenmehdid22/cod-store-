import type { Locale } from "./config";

export type StoreStrings = {
  nav: { home: string; shop: string; cart: string; skip: string };
  shop: { title: string; searchPlaceholder: string; search: string; all: string; sortLabel: string; sortNew: string; sortPriceAsc: string; sortPriceDesc: string; sortName: string; results: string; none: string; prev: string; next: string; page: string };
  card: { soldOut: string; sale: string };
  cart: { title: string; empty: string; continue: string; remove: string; qty: string; subtotal: string; checkout: string; add: string; added: string; viewCart: string; unavailable: string };
  checkout: { title: string; summary: string; discount: string; shipping: string; shippingTbd: string; free: string; total: string; back: string; quoteError: string };
  confirm: { title: string; text: string; number: string; total: string; keep: string };
  footer: { pages: string; prefs: string; rights: string; contact: string };
  consent: { title: string; text: string; accept: string; refuse: string; saved: string; refreshNote: string };
  home: { heroCta: string; allProducts: string; empty: string };
  notFound: { title: string; text: string; back: string };
  lang: string;
};

const fr: StoreStrings = {
  nav: { home: "Accueil", shop: "Boutique", cart: "Panier", skip: "Aller au contenu" },
  shop: { title: "Boutique", searchPlaceholder: "Rechercher un produit…", search: "Rechercher", all: "Tout", sortLabel: "Trier", sortNew: "Nouveautés", sortPriceAsc: "Prix croissant", sortPriceDesc: "Prix décroissant", sortName: "Nom (A-Z)", results: "{n} produit(s)", none: "Aucun produit ne correspond à votre recherche.", prev: "Précédent", next: "Suivant", page: "Page {p} / {n}" },
  card: { soldOut: "Épuisé", sale: "Promo" },
  cart: { title: "Votre panier", empty: "Votre panier est vide.", continue: "Continuer mes achats", remove: "Retirer", qty: "Quantité", subtotal: "Sous-total", checkout: "Commander", add: "Ajouter au panier", added: "Ajouté au panier", viewCart: "Voir le panier", unavailable: "Certains articles ne sont plus disponibles." },
  checkout: { title: "Finaliser la commande", summary: "Récapitulatif", discount: "Remise", shipping: "Livraison", shippingTbd: "Calculée après le choix de la wilaya", free: "Offerte", total: "Total à payer à la livraison", back: "Retour au panier", quoteError: "Impossible de calculer le total pour le moment." },
  confirm: { title: "Commande enregistrée", text: "Merci ! Nous vous appelons très bientôt pour confirmer la commande et la livraison.", number: "Numéro de commande", total: "Total à payer à la livraison", keep: "Conservez ce numéro pour tout échange avec nous." },
  footer: { pages: "Informations", prefs: "Préférences cookies", rights: "Tous droits réservés.", contact: "Contact" },
  consent: { title: "Cookies et mesure d'audience", text: "Avec votre accord, nous utilisons des outils de mesure et de publicité (Google, Meta, TikTok) pour améliorer la boutique et nos annonces. Aucun nom, téléphone ni adresse n'est transmis à ces outils.", accept: "Accepter", refuse: "Refuser", saved: "Préférences enregistrées.", refreshNote: "Si vous retirez votre accord, rechargez la page pour arrêter complètement les outils déjà chargés." },
  home: { heroCta: "Voir la boutique", allProducts: "Tous les produits", empty: "Aucun produit n'est disponible pour le moment." },
  notFound: { title: "Page introuvable", text: "Cette page n'existe pas ou n'est plus disponible.", back: "Retour à l'accueil" },
  lang: "Langue",
};
const ar: StoreStrings = {
  nav: { home: "الرئيسية", shop: "المتجر", cart: "السلة", skip: "تخطّ إلى المحتوى" },
  shop: { title: "المتجر", searchPlaceholder: "ابحث عن منتج…", search: "بحث", all: "الكل", sortLabel: "ترتيب", sortNew: "الأحدث", sortPriceAsc: "السعر تصاعدياً", sortPriceDesc: "السعر تنازلياً", sortName: "الاسم", results: "{n} منتج", none: "لا توجد منتجات مطابقة لبحثك.", prev: "السابق", next: "التالي", page: "صفحة {p} / {n}" },
  card: { soldOut: "نفد المخزون", sale: "تخفيض" },
  cart: { title: "سلتك", empty: "سلتك فارغة.", continue: "متابعة التسوق", remove: "إزالة", qty: "الكمية", subtotal: "المجموع الفرعي", checkout: "إتمام الطلب", add: "أضف إلى السلة", added: "تمت الإضافة إلى السلة", viewCart: "عرض السلة", unavailable: "بعض المنتجات لم تعد متوفرة." },
  checkout: { title: "إتمام الطلب", summary: "ملخص الطلب", discount: "الخصم", shipping: "التوصيل", shippingTbd: "يُحسب بعد اختيار الولاية", free: "مجاني", total: "المبلغ المستحق عند الاستلام", back: "العودة إلى السلة", quoteError: "تعذّر حساب المجموع حالياً." },
  confirm: { title: "تم تسجيل طلبك", text: "شكراً لك! سنتصل بك قريباً جداً لتأكيد الطلب والتوصيل.", number: "رقم الطلب", total: "المبلغ المستحق عند الاستلام", keep: "احتفظ بهذا الرقم لأي تواصل معنا." },
  footer: { pages: "معلومات", prefs: "تفضيلات ملفات تعريف الارتباط", rights: "جميع الحقوق محفوظة.", contact: "اتصل بنا" },
  consent: { title: "ملفات تعريف الارتباط وقياس الجمهور", text: "بموافقتك، نستخدم أدوات القياس والإعلان (Google وMeta وTikTok) لتحسين المتجر وإعلاناتنا. لا يتم إرسال أي اسم أو هاتف أو عنوان إلى هذه الأدوات.", accept: "قبول", refuse: "رفض", saved: "تم حفظ التفضيلات.", refreshNote: "إذا سحبت موافقتك، أعد تحميل الصفحة لإيقاف الأدوات المحمّلة بالكامل." },
  home: { heroCta: "تسوق الآن", allProducts: "كل المنتجات", empty: "لا توجد منتجات متاحة حالياً." },
  notFound: { title: "الصفحة غير موجودة", text: "هذه الصفحة غير موجودة أو لم تعد متاحة.", back: "العودة إلى الرئيسية" },
  lang: "اللغة",
};

export function getStoreStrings(locale: Locale): StoreStrings {
  return locale === "ar" ? ar : fr;
}
