# Supermarché Étoile — PWA Angular 18

## Stack technique
| Outil | Usage |
|---|---|
| Angular 18 | Framework (standalone + signals) |
| Bootstrap 5 | Layout, tables, badges, navbar |
| Angular Material | MatDialog, MatPaginator, MatTabs, MatTooltip |
| Font Awesome 6 | Icônes (via CDN) |
| @angular/pwa | PWA installable Android/tablette, rotation libre |
| Google Sheets | Base de données via GoogleSheetsService |

---

## Installation

```bash
# 1. Créer le projet Angular
ng new supermarche-etoile --routing --style=scss --standalone
cd supermarche-etoile

# 2. Dépendances
npm install @angular/material @angular/cdk bootstrap

# 3. PWA
ng add @angular/pwa

# 4. Copier les fichiers src/ de ce dossier dans votre projet
# 5. Brancher GoogleSheetsService et SheetsQueueServiceService
#    → remplacer les stubs dans src/app/core/services/
```

---

## Arborescence complète

```
supermarche-etoile/
├── angular.json
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── ngsw-config.json            ← Service Worker PWA
│
└── src/
    ├── index.html              ← Bootstrap CDN + Font Awesome CDN
    ├── main.ts                 ← bootstrapApplication
    ├── styles.scss             ← Bootstrap + Material + styles globaux
    ├── manifest.webmanifest    ← PWA manifest (orientation: any)
    │
    ├── environments/
    │   ├── environment.ts
    │   └── environment.prod.ts
    │
    └── app/
        ├── app.component.ts    ← Shell : navbar Bootstrap + router-outlet
        ├── app.routes.ts       ← Routes lazy-loaded + guards
        ├── app.config.ts       ← Providers Angular 18
        │
        ├── core/
        │   ├── models/
        │   │   └── supermarche.models.ts     ← Article, Ticket, LigneVente, User…
        │   ├── services/
        │   │   ├── cache.service.ts          ← Signaux + computed (alertes, tickets enrichis)
        │   │   ├── data.service.ts           ← CRUD Sheets + stockage mensuel
        │   │   ├── auth.service.ts           ← Login, rôle, session
        │   │   ├── beep.service.ts           ← Son scan Web Audio API
        │   │   ├── prix.service.ts           ← Calcul tarif détail/grossiste/seuil
        │   │   ├── sheets-queue.service.ts   ← STUB → brancher votre impl.
        │   │   └── @google-sheets/
        │   │       └── google-sheets.service.ts  ← STUB → brancher votre impl.
        │   └── guards/
        │       └── auth.guard.ts             ← authGuard + adminGuard
        │
        ├── shared/
        │   └── components/
        │       ├── confirm-modal/            ← MatDialog confirmation suppression
        │       ├── reapprovisionnement-modal/← MatDialog réappro stock
        │       └── ticket-detail-modal/      ← MatDialog détail ticket + lignes
        │
        └── features/
            ├── auth/
            │   └── login/                    ← Page connexion (id + mdp)
            ├── articles/
            │   ├── catalogue/                ← Liste articles, alertes, icônes actions
            │   └── article-form-modal/       ← Créer/modifier article via MatDialog
            ├── caisse/
            │   ├── caisse/                   ← Scan + panier + type vente + bip
            │   ├── articles-frequents/       ← Raccourcis 8 articles fréquents
            │   └── recu/                     ← Reçu imprimable après validation
            ├── historique/
            │   └── historique/               ← Ventes par période, par ticket, par article
            └── users/
                ├── users-list/               ← Liste utilisateurs (Admin)
                └── user-form-modal/          ← Créer/modifier user via MatDialog
```

---

## Stockage Google Sheets

| Feuille | Type | Création |
|---|---|---|
| `SM_ARTICLES` | Catalogue | Permanent |
| `SM_USERS` | Utilisateurs | Permanent |
| `SM_TICKETS_2026_05` | Tickets | Mensuel auto |
| `SM_LIGNES_2026_05` | Lignes vente | Mensuel auto |
| `SM_MOUVEMENTS_2026_05` | Mouvements stock | Mensuel auto |

Les feuilles mensuelles sont créées automatiquement par `ensureSheets()` au démarrage.

---

## Règles tarifaires (PrixService)

```
DETAIL             → prix_detail (toujours)
GROSSISTE + qte ≥ qte_min_grossiste → prix_grossiste
GROSSISTE + qte <  qte_min_grossiste → prix_detail
```

---

## Rôles et droits

| Fonctionnalité | CAISSIER | GERANT | ADMIN |
|---|---|---|---|
| Enregistrer une vente | ✅ | ✅ | ✅ |
| Voir catalogue | ✅ (lecture) | ✅ | ✅ |
| Créer/modifier articles | ❌ | ✅ | ✅ |
| Réapprovisionner | ❌ | ✅ | ✅ |
| Voir historique | ✅ (sans bénéfices) | ✅ (sans bénéfices) | ✅ (tout) |
| Voir bénéfices | ❌ | ❌ | ✅ |
| Gérer utilisateurs | ❌ | ❌ | ✅ |

---

## À brancher

Remplacez les deux stubs dans `core/services/` :

```typescript
// sheets-queue.service.ts  → votre SheetsQueueServiceService
// @google-sheets/google-sheets.service.ts → votre GoogleSheetsService
```

Les signatures des méthodes sont documentées dans les stubs.
