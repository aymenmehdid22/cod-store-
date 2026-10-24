# Rapport final — cod-store (Next.js 14 + Supabase)

## 1. Mise en route Supabase (dans l'ordre)
1. **Avant tout**, en production : `select policyname, roles from pg_policies where tablename='orders';`. Une policy permissive pour `authenticated` signifie que les commandes étaient lisibles par tout compte inscrit — la migration 002 la supprime, mais vérifiez si des données ont pu fuiter.
2. Appliquer dans l'ordre `supabase/migrations/002_commerce_core.sql`, `003_seed_existing_product.sql`, `004_storefront_analytics_admin.sql` (`supabase db push` ou SQL Editor). Elles sont rétro-compatibles et ne recréent pas `orders` (backfill des clients, lignes de commande, historique).
3. Créer le **premier propriétaire** : Auth → Users → créer l'utilisateur, puis SQL Editor :
   `insert into public.admin_users (user_id, role, display_name) values ('<uuid auth.users>', 'owner', 'Votre nom');`
4. Auth → Providers → Email : **désactiver « Allow new users to sign up »** (déjà `enable_signup=false` en local). Les invitations d'équipe fonctionnent quand même (clé service-role) mais nécessitent un SMTP configuré.
5. Copier les images actuelles dans `public/images/products/paris-vintage-cap/` (absentes de l'archive) **ou** les ré-uploader depuis Admin → Produits.
6. Admin → Inventaire : saisir le stock réel (le seed met 5 par couleur).
7. Admin → **Marketing & Tracking** : ressaisir votre Pixel ID (la variable `NEXT_PUBLIC_META_PIXEL_ID` n'est plus lue). Définir `META_ACCESS_TOKEN` pour l'API Conversions.
8. Admin → Livraison : saisir les tarifs par wilaya (sinon 0 DA) ; Admin → Pages : **relire les textes modèles** (livraison, retours, FAQ, confidentialité, CGV).
9. `NEXT_PUBLIC_SITE_URL` en production (canonical, sitemap, Open Graph).

## 2. Variables d'environnement
Voir `.env.example`. Serveur uniquement : `SUPABASE_SERVICE_ROLE_KEY`, `META_ACCESS_TOKEN`, `GOOGLE_*`. La clé service-role n'est utilisée que par `/api/orders`, `/api/quote`, `/api/events` et l'invitation d'équipe ; **toutes les autres opérations admin passent par la session de l'utilisateur et la RLS**.

## 3. Routes
**Boutique** : `/` (accueil ; redirige vers l'unique produit tant que l'option est cochée), `/shop` (recherche `?q=`, tri, pagination), `/category/[slug]`, `/[product]` (fiche, inchangée visuellement), `/cart`, `/checkout`, `/order-confirmation?n=`, `/p/[slug]` (pages d'information), `/sitemap.xml`, `/robots.txt`, 404, erreur globale.
**Admin** : `/admin` (aperçu), `/admin/analytics`, `/admin/orders[/id]`, `/admin/customers[/id]`, `/admin/discounts`, `/admin/products[/new|/id]`, `/admin/categories`, `/admin/inventory`, `/admin/marketing`, `/admin/content`, `/admin/pages`, `/admin/shipping`, `/admin/settings`, `/admin/team`, `/admin/audit`, `/admin/profile`, `/admin/login`.
**API publiques** : `POST /api/orders` (commande atomique, idempotente), `POST /api/quote`, `POST /api/events` (analytics first-party anonymes, après consentement). **Supprimé** : `/api/meta-conversion` (permettait d'injecter des événements arbitraires). **API admin** : 26 routes sous `/api/admin/*`, toutes derrière rôle + RLS.

## 4. Sécurité — ce qui a changé
- Accès admin = présence dans `admin_users` (middleware + layout + chaque API + RLS). Rôles : propriétaire / gestionnaire / opérateur commandes ; jamais dérivés de métadonnées client. Impossible de retirer ou rétrograder le dernier propriétaire (trigger).
- RLS sur toutes les tables ; `place_order`, `quote_order` : `service_role` uniquement ; écritures sensibles via RPC `SECURITY DEFINER` contrôlant le rôle ; audit automatique (triggers) + audit explicite (RPC) ; exports CSV audités et protégés contre l'injection de formules.
- Prix, stock, remises, livraison et totaux calculés en base ; stock décrémenté atomiquement (testé : 5 commandes simultanées pour 1 unité → 1 succès) ; commande idempotente ; annulation/retour = restock exactement une fois.
- Tracking : identifiants validés par regex (côté formulaire, API **et** contrainte SQL), aucun script libre ; scripts chargés uniquement après consentement par catégorie, jamais deux fois ; payloads filtrés (pas de nom/téléphone/email/adresse) ; CAPI limitée à un hash du n° de commande ; `Purchase` = commande livrée, une seule fois, uniquement si le client avait consenti au marketing.
- `next/image` limité au Storage Supabase (plus de proxy d'images ouvert) ; en-têtes de sécurité ; JSON-LD échappé ; textes d'administration rendus sans HTML.

## 5. Tests réalisés
| Suite | Résultat |
|---|---|
| SQL `security_and_rpc.sql` (anon / inscrit non-admin / opérateur / propriétaire, stock, idempotence, remises, transitions, audit) | **59 / 59** |
| SQL `cart_analytics_crm.sql` (panier multi-lignes, devis, livraison, seuil gratuit, analytics, CRM, dernier propriétaire, slugs réservés) | **43 / 43** |
| Concurrence réelle (5 clients, 1 unité) | 1 succès, 4 refus, stock 0 |
| Vitest (permissions, parité TS↔SQL des transitions/regex/slugs, consentement et dédoublonnage du tracking, hygiène PII, Purchase unique, panier, CSV, plages de dates, schémas) | **41 / 41** |
| Contrat zod ↔ RPC `admin_save_product` | OK |
| `tsc`, `next build` (lint + types, 55 routes) | OK |
| Fumée sur build de production : 26 routes API admin sans session | **26 × 401** ; pages admin → redirection login ; `Purchase` navigateur refusé (400) ; en-têtes présents |

Les tests ont fait corriger 2 défauts réels pendant le développement : revalidation du stock après décrémentation dans `place_order`, et double chargement de `gtag.js` (GA4 + Ads). Une 3ᵉ régression (code injecté par erreur dans `getVariantImages`) a été trouvée à la relecture.

## 6. Non testé / limites honnêtes
- **Aucun test contre un vrai projet Supabase** (PostgREST, Auth, Storage, SMTP) ni **dans un navigateur** : rendu visuel, responsive, upload d'images, bannière de consentement, chargement réel des pixels, lecteur d'écran. Postgres local avec stubs `auth`/`storage` ≠ Supabase : faites un cycle complet (créer produit → publier → commander → annuler → livrer) sur votre projet.
- Accessibilité : pratiques appliquées (labels, `aria-*`, tableaux avec `scope`, lien d'évitement ; contrastes, ordre de focus et `prefers-reduced-motion` **non vérifiés**), **mais aucun audit automatisé (axe/Lighthouse) n'a pu être exécuté**.
- Performance : index sur les chemins chauds, agrégations en base, `next/image` ; aucune mesure Lighthouse. Le rate-limit reste **en mémoire** (inefficace en serverless multi-instances) : brancher Upstash/Redis avant un pic de trafic.
- Pas implémentés : avis clients, comptes clients/historique côté client (modèle COD sans compte), remboursements partiels, relance des paniers abandonnés (comptage anonyme seulement), notifications de commande (e-mail/Telegram), GA4/TikTok/Ads Purchase côté serveur, formulaire de contact (coordonnées affichées), paiement en ligne (hors modèle COD).
- Fichiers uploadés puis abandonnés sans enregistrer restent dans le bucket (nettoyage périodique à prévoir).
- L'attribution UTM est maintenant stockée en `sessionStorage` (et promue en `localStorage` seulement après consentement) : moins de ré-attribution entre visites qu'avant, par conformité.
- Les ajustements de seed (5 unités/couleur) et les textes de pages sont des **valeurs initiales**, pas des données réelles.
