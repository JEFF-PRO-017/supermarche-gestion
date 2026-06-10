// supermarche.models.ts — entités métier

export type Role = 'ADMIN' | 'GERANT' | 'CAISSIER';
export type TypeVente = 'DETAIL' | 'GROSSISTE';
export type TarifApplique = 'DETAIL' | 'GROSSISTE' | 'GROSSISTE_SEUIL_QTE';
export type TypeMouvement = 'ENTREE' | 'SORTIE_VENTE' | 'CORRECTION';

// ── Utilisateur ────────────────────────────────────────────────
export interface AppUser {
  id: string;
  username: string;
  mot_de_passe: string;  // hash ou plain selon impl.
  nom: string;
  role: Role;
}

// ── Article ────────────────────────────────────────────────────
export interface Article {
  code_article: string;   // 5 chiffres ex: "00142"
  nom: string;
  description: string;
  prix_achat: number;
  prix_detail: number;
  prix_grossiste: number;
  qte_min_grossiste: number;
  stock_actuel: number;
  stock_maximum: number;  // facultatif → 0 = non défini
  seuil_alerte: number;
}

// ── Ticket (stocké par mois) ───────────────────────────────────
export interface Ticket {
  id_ticket: string;      // ex: "TK-20260504-001"
  date_heure: string;     // ISO
  type_vente: TypeVente;
  montant_total: number;
  montant_recu: number;
  monnaie_rendue: number;
  id_caissier: string;
  nom_caissier: string;   // dénormalisé pour affichage rapide
}

// ── Ligne de vente (stockée par mois) ─────────────────────────
export interface LigneVente {
  id_ligne: string;
  id_ticket: string;
  code_article: string;
  nom_article: string;    // snapshot
  quantite: number;
  prix_unitaire_applique: number;  // snapshot prix au moment de la vente
  tarif_applique: TarifApplique;
  sous_total: number;
}

// ── Mouvement de stock (stocké par mois) ──────────────────────
export interface MouvementStock {
  id: string;
  code_article: string;
  type_mouvement: TypeMouvement;
  quantite: number;
  date: string;           // ISO
  id_utilisateur: string;
  reference: string;
  article?: Article      // id_ticket si SORTIE_VENTE
}

// ── Alerte stock (calculé en mémoire, pas de feuille dédiée) ──
export interface AlerteStock {
  code_article: string;
  nom: string;
  stock_actuel: number;
  seuil_alerte: number;
  niveau: 'CRITIQUE' | 'FAIBLE';  // CRITIQUE: stock<=seuil, FAIBLE: <=seuil*1.5
}

// ── Panier (état local caisse, jamais persisté) ────────────────
export interface LignePanier {
  article: Article;
  quantite: number;
  prix_unitaire: number;
  tarif: TarifApplique;
  sous_total: number;
}
