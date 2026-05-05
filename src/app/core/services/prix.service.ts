// prix.service.ts — règles tarifaires centralisées
import { Injectable } from '@angular/core';
import { Article, TarifApplique, TypeVente } from '../models/supermarche.models';

@Injectable({ providedIn: 'root' })
export class PrixService {

  /**
   * Calcule le prix unitaire et le tarif appliqué.
   * Règles :
   *   DETAIL           → prix_detail toujours
   *   GROSSISTE + qte >= qte_min → prix_grossiste
   *   GROSSISTE + qte <  qte_min → prix_detail (seuil non atteint)
   */
  calculer(article: Article, qte: number, typeVente: TypeVente): {
    prix: number;
    tarif: TarifApplique;
  } {
    if (typeVente === 'DETAIL') {
      return { prix: article.prix_detail, tarif: 'DETAIL' };
    }
    // GROSSISTE
    if (qte >= article.qte_min_grossiste) {
      return { prix: article.prix_grossiste, tarif: 'GROSSISTE' };
    }
    // Grossiste mais seuil non atteint → détail
    return { prix: article.prix_detail, tarif: 'GROSSISTE_SEUIL_QTE' };
  }

  /** Marge brute en valeur */
  margeValeur(prixVente: number, prixAchat: number): number {
    return prixVente - prixAchat;
  }

  /** Taux de marge en % */
  margePct(prixVente: number, prixAchat: number): number {
    if (!prixVente) return 0;
    return Math.round((this.margeValeur(prixVente, prixAchat) / prixVente) * 1000) / 10;
  }
}
