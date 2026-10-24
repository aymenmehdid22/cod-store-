import type { Locale } from "./config";

export type Dictionary = {
  currency: string;
  switchLanguage: string;
  siteDescription: string;
  colorLabel: string;
  quantityLabel: string;
  decreaseQty: string;
  increaseQty: string;
  deliveryLabel: string;
  deliveryHomeTitle: string;
  deliveryHomeSub: string;
  deliveryStopdeskTitle: string;
  deliveryStopdeskSub: string;
  wilayaLabel: string;
  wilayaPlaceholder: string;
  wilayaSearch: string;
  wilayaNone: string;
  orderTitle: string;
  fullName: string;
  phone: string;
  productTotal: string;
  deliveryFeeNote: string;
  submit: string;
  submitting: string;
  errorGeneric: string;
  errorNetwork: string;
  successTitle: string;
  successThanks: string;
  orderWord: string;
  quantityWord: string;
  colorWord: string;
  totalWord: string;
  successContact: string;
  save: string; // contains {amount}
  descriptionTitle: string;
  ratingLabel: string; // contains {n}
  imageN: string; // contains {n}
  stickyTotal: string;
  notFoundTitle: string;
  notFoundText: string;
  backToShop: string;
  metaTitleSuffix: string;
  metaDescription: string; // {name} {price}
  ogDescription: string;
  soldOut: string;
  promoLabel: string;
  promoPlaceholder: string;
  api: {
    tooMany: string;
    invalid: string;
    phone: string;
    productNotFound: string;
    variantNotFound: string;
    colorUnavailable: string;
    server: string;
    wilayaInvalid: string;
    outOfStock: string;
    discountInvalid: string;
    unavailable: string;
  };
};

const fr: Dictionary = {
  currency: "DA",
  switchLanguage: "Changer de langue",
  siteDescription: "Commandez en ligne, payez à la livraison. Livraison 58 wilayas.",
  colorLabel: "Couleur",
  quantityLabel: "Quantité",
  decreaseQty: "Diminuer la quantité",
  increaseQty: "Augmenter la quantité",
  deliveryLabel: "Livraison",
  deliveryHomeTitle: "À DOMICILE",
  deliveryHomeSub: "Recevez chez vous",
  deliveryStopdeskTitle: "STOPDESK",
  deliveryStopdeskSub: "Retrait en agence",
  wilayaLabel: "Wilaya",
  wilayaPlaceholder: "Sélectionner votre wilaya",
  wilayaSearch: "Rechercher (ex : Oran)…",
  wilayaNone: "Aucune wilaya trouvée.",
  orderTitle: "COMMANDER",
  fullName: "Nom complet",
  phone: "Numéro de téléphone",
  productTotal: "Total produit",
  deliveryFeeNote: "Frais de livraison payables à la réception.",
  submit: "COMMANDER",
  submitting: "ENVOI EN COURS…",
  errorGeneric: "Une erreur est survenue. Réessayez.",
  errorNetwork: "Erreur réseau. Vérifiez votre connexion et réessayez.",
  successTitle: "COMMANDE ENREGISTRÉE",
  successThanks: "Merci pour votre commande.",
  orderWord: "Commande",
  quantityWord: "Quantité",
  colorWord: "Couleur",
  totalWord: "Total",
  successContact: "Nous allons vous contacter prochainement pour confirmer votre commande.",
  save: "Économisez {amount}",
  descriptionTitle: "Description",
  ratingLabel: "{n} sur 5",
  imageN: "Image {n}",
  stickyTotal: "Total",
  notFoundTitle: "Page introuvable",
  notFoundText: "Le produit demandé n'existe pas.",
  backToShop: "Retour à la boutique",
  metaTitleSuffix: "Livraison 58 wilayas",
  metaDescription:
    "{name} à {price}. Paiement à la livraison, livraison à domicile ou stopdesk dans les 58 wilayas.",
  ogDescription: "Paiement à la livraison — 58 wilayas.",
  soldOut: "Épuisé",
  promoLabel: "Code promo (optionnel)",
  promoPlaceholder: "EX : BIENVENUE10",
  api: {
    tooMany: "Trop de requêtes, réessayez dans une minute.",
    invalid: "Données invalides.",
    phone: "Numéro de téléphone invalide.",
    productNotFound: "Produit introuvable.",
    variantNotFound: "Variante introuvable.",
    colorUnavailable: "Cette couleur est actuellement indisponible.",
    outOfStock: "Stock insuffisant pour cette quantité.",
    discountInvalid: "Code promo invalide ou expiré.",
    unavailable: "Ce produit n'est plus disponible.",
    server: "Erreur serveur, veuillez réessayer.",
    wilayaInvalid: "Wilaya invalide.",
  },
};

const ar: Dictionary = {
  currency: "دج",
  switchLanguage: "تغيير اللغة",
  siteDescription: "اطلب عبر الإنترنت وادفع عند الاستلام. التوصيل إلى 58 ولاية.",
  colorLabel: "اللون",
  quantityLabel: "الكمية",
  decreaseQty: "تقليل الكمية",
  increaseQty: "زيادة الكمية",
  deliveryLabel: "التوصيل",
  deliveryHomeTitle: "إلى المنزل",
  deliveryHomeSub: "استلم طلبك في بيتك",
  deliveryStopdeskTitle: "مكتب التوصيل",
  deliveryStopdeskSub: "الاستلام من المكتب",
  wilayaLabel: "الولاية",
  wilayaPlaceholder: "اختر ولايتك",
  wilayaSearch: "ابحث (مثال: وهران)…",
  wilayaNone: "لم يتم العثور على ولاية.",
  orderTitle: "اطلب الآن",
  fullName: "الاسم الكامل",
  phone: "رقم الهاتف",
  productTotal: "مجموع المنتج",
  deliveryFeeNote: "رسوم التوصيل تُدفع عند الاستلام.",
  submit: "اطلب الآن",
  submitting: "جارٍ الإرسال…",
  errorGeneric: "حدث خطأ. يرجى المحاولة مرة أخرى.",
  errorNetwork: "خطأ في الشبكة. تحقق من اتصالك وحاول مرة أخرى.",
  successTitle: "تم تسجيل طلبك",
  successThanks: "شكراً على طلبك.",
  orderWord: "الطلب",
  quantityWord: "الكمية",
  colorWord: "اللون",
  totalWord: "المجموع",
  successContact: "سنتصل بك قريباً لتأكيد طلبك.",
  save: "وفّر {amount}",
  descriptionTitle: "الوصف",
  ratingLabel: "{n} من 5",
  imageN: "صورة {n}",
  stickyTotal: "المجموع",
  notFoundTitle: "الصفحة غير موجودة",
  notFoundText: "المنتج المطلوب غير موجود.",
  backToShop: "العودة إلى المتجر",
  metaTitleSuffix: "التوصيل إلى 58 ولاية",
  metaDescription:
    "{name} بسعر {price}. الدفع عند الاستلام، التوصيل إلى المنزل أو إلى مكتب التوصيل في 58 ولاية.",
  ogDescription: "الدفع عند الاستلام — 58 ولاية.",
  soldOut: "نفد المخزون",
  promoLabel: "رمز الخصم (اختياري)",
  promoPlaceholder: "مثال: WELCOME10",
  api: {
    tooMany: "طلبات كثيرة، حاول مرة أخرى بعد دقيقة.",
    invalid: "بيانات غير صالحة.",
    phone: "رقم الهاتف غير صالح.",
    productNotFound: "المنتج غير موجود.",
    variantNotFound: "الخيار غير موجود.",
    colorUnavailable: "هذا اللون غير متوفر حالياً.",
    outOfStock: "الكمية المطلوبة غير متوفرة في المخزون.",
    discountInvalid: "رمز الخصم غير صالح أو منتهي الصلاحية.",
    unavailable: "هذا المنتج لم يعد متوفراً.",
    server: "خطأ في الخادم، يرجى المحاولة مرة أخرى.",
    wilayaInvalid: "ولاية غير صالحة.",
  },
};

export const DICTIONARIES: Record<Locale, Dictionary> = { fr, ar };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}
