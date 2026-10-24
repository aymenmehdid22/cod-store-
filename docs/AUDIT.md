# Audit initial — cod-store (Next.js 14 + Supabase)

Date : 12 oct. 2026 · Périmètre : archive `cod-store-fr-ar.zip` (2 616 lignes TS/TSX, 1 migration SQL).

## 1. Architecture existante

| Élément | État |
|---|---|
| Framework | Next.js 14.2 (App Router), React 18, TypeScript, Tailwind 3.4, zod, `@supabase/ssr` |
| Routes publiques | `/` (redirige vers le 1er produit), `/[product]`, `/sitemap.xml`, `/robots.txt`, 404 |
| Routes admin | `/admin` (stats), `/admin/orders`, `/admin/orders/[id]`, `/admin/login` |
| API | `POST /api/orders`, `POST /api/meta-conversion`, `PATCH /api/admin/orders/[id]` |
| i18n | FR/AR (RTL) par cookie + `Accept-Language`, dictionnaire maison |
| Catalogue | **Fichier statique `data/products.ts`** (1 produit : PARIS VINTAGE CAP, 4 couleurs) |
| Base | 1 table `orders` (produit unique par commande), RLS activée **sans aucune policy** |
| Intégrations | Google Sheets (append), Meta Pixel + CAPI (env vars), UTM/fbclid en localStorage |
| Design tokens | `background #FAFAFA`, `foreground #111`, `muted #666`, `border #EAEAEA`, Inter + Noto Sans Arabic ; classes `.card .input .label .btn-primary` ; coins `rounded-xl/2xl`, CTA noir plein |
| Absent de l'archive | `public/` (images produit), `.env*`, README, tests |

## 2. Problèmes de sécurité (par gravité)

1. **CRITIQUE — tout compte Supabase = admin.** `middleware.ts` ne vérifie que `auth.getUser()` ; `supabase/config.toml` a `enable_signup = true`. N'importe qui peut créer un compte via l'API Auth publique (la clé anon est publique) puis accéder à `/admin` et lire les commandes.
2. **CRITIQUE — changement de statut sans contrôle de rôle.** `PATCH /api/admin/orders/[id]` vérifie seulement « connecté », puis écrit avec la clé service-role. Même exploitation que (1).
3. **ÉLEVÉ — dérive migration / production.** Le SQL du dépôt ne crée aucune policy ; pourtant les pages admin lisent `orders` via le client *authenticated*. Soit l'admin affiche 0 ligne, soit une policy manuelle (probablement « authenticated peut tout lire ») existe en production et expose les données clients (nom, téléphone, adresse) à tout compte inscrit. **À vérifier :** `select * from pg_policies where tablename='orders';` La migration 002 supprime toutes les policies existantes sur `orders` et les recrée.
4. MOYEN — aucune transition de statut contrôlée, aucun historique, aucun journal d'audit.
5. MOYEN — pas d'idempotence sur `POST /api/orders` : double clic / retry réseau = commandes en double.
6. MOYEN — aucun stock : `stock: 20` est une valeur statique, jamais décrémentée → survente possible.
7. MOYEN — Meta : l'événement `Lead` navigateur n'a pas d'`eventID`, donc il est dédoublonné avec rien ; le pixel se charge sans consentement ; la CAPI n'envoie ni IP ni user-agent. (Traité en phase 6.)
8. FAIBLE — `rate-limit.ts` en mémoire (inefficace en serverless multi-instance) ; `x-forwarded-for` pris tel quel.
9. FAIBLE — `/admin` télécharge **toutes** les commandes pour calculer 3 chiffres (non scalable, remplacé par une RPC d'agrégation en phase 5).

## 3. Dette technique / manques fonctionnels

- Catalogue codé en dur → rien de gérable depuis l'admin.
- Pas de catégories, panier, recherche, pages légales/FAQ/contact, comptes clients.
- Pas de clients (CRM), remises, frais de livraison configurables, contenu éditable, rôles, audit, tracking configurable.
- Commande mono-produit (`orders.product_id` texte) ; pas de `order_items`.
- Aucun test.

## 4. Plan par phases — statut final

| Phase | Contenu | Statut |
|---|---|---|
| 1 | Audit | ✅ |
| 2 | Migrations, RLS, rôles, RPC atomiques, storage, correctifs sécurité | ✅ (002, 003, 004) |
| 3 | Admin : produits, variantes, images, catégories, stock | ✅ |
| 4 | Boutique : accueil, boutique, catégories, recherche, panier, checkout, confirmation, pages d'information, 404/erreur | ✅ |
| 5 | Commandes, clients/CRM, promotions, aperçu agrégé | ✅ |
| 6 | Marketing & Tracking consentis, analytics | ✅ |
| 7 | Réglages, contenu d'accueil, livraison, pages, équipe, audit, profil | ✅ |
| 8 | Tests unitaires + SQL + fumée prod ; audit a11y/perf **statique** | ◐ voir FINAL-REPORT.md (pas de test navigateur) |

Les points 3, 5, 6 et 9 de la section 2 sont corrigés (voir FINAL-REPORT.md).
