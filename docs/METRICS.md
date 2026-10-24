# Définitions des métriques (Admin → Analytics / Aperçu)

Toutes les valeurs financières viennent de la table `orders` / `order_items` via la fonction SQL `admin_analytics(from, to)` (agrégation en base, aucun tableau téléchargé dans le navigateur).

**Période** : jours calendaires **Africa/Algiers** (UTC+1, sans heure d'été), bornes incluses, 400 jours max. Une commande appartient au jour de sa **création**.

| Métrique | Formule |
|---|---|
| Commandes passées | Nombre de commandes créées sur la période, tous statuts. |
| Ventes brutes | Σ `subtotal` (prix × quantités, **avant remise, hors livraison**), tous statuts. |
| Remises | Σ `discount_amount`. |
| Ventes nettes | Σ (`subtotal − discount_amount`) des commandes **ni annulées ni retournées**. |
| Revenu encaissé (livré) | Σ (`subtotal − discount_amount`) des commandes au statut **Livrée**. En paiement à la livraison, c'est le seul chiffre « encaissé ». |
| Panier moyen | Ventes nettes ÷ nombre de commandes ni annulées ni retournées. |
| Taux d'annulation | Annulées ÷ passées. |
| Taux de retour | Retournées ÷ (livrées + retournées). |
| Nouveaux / récurrents | Une commande est « récurrente » si le client (téléphone) a une commande **antérieure** ; « nouveau » sinon. |
| Meilleurs produits / catégories | Σ `line_total` des lignes de commandes non annulées/retournées. |
| Acquisition / campagnes | `utm_source` / `utm_campaign` stockés sur la commande (« direct / inconnu » si absent). |
| Entonnoir | Sessions **distinctes** par événement (`PageView`, `ViewContent`, `AddToCart`, `InitiateCheckout`, `Lead`), **uniquement pour les visiteurs ayant consenti à la mesure**. |
| Commande abandonnée | Session avec `InitiateCheckout` mais sans `Lead` sur la période. Aucune donnée personnelle : on ne peut pas relancer ces visiteurs. |
| Taux ajout au panier | `AddToCart` ÷ `ViewContent` par produit (événements consentis). |

## Limites à connaître
- L'entonnoir et les vues produit **sous-estiment** le trafic réel (refus de consentement, bloqueurs de publicité, navigation privée). Les commandes, elles, sont exhaustives.
- Pas d'attribution multi-touch ni multi-appareil : l'attribution = dernière source UTM/fbclid vue dans la session (ou première visite si consentement), copiée sur la commande.
- Les événements Meta/GA4/TikTok/Ads sont des **copies envoyées aux plateformes** ; les chiffres de ces plateformes différeront des vôtres (fenêtres d'attribution, consentement, dédoublonnage).
- **Lead = commande passée** (pas un revenu). **Purchase = commande livrée** : envoyé une seule fois, côté serveur, à Meta (API Conversions) si `META_ACCESS_TOKEN` est défini, si l'événement est activé et si le client avait accepté le marketing. GA4/TikTok/Ads ne reçoivent pas de Purchase (pas de navigateur au moment de la livraison).
- Pas de remboursement partiel : une commande est annulée ou retournée en entier.
