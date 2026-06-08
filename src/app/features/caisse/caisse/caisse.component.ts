// caisse.component.ts
import { Component, inject, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CacheService } from '../../../core/services/cache.service';
import { DataService } from '../../../core/services/data.service';
import { AuthService } from '../../../core/services/auth.service';
import { BeepService } from '../../../core/services/beep.service';
import { PrixService } from '../../../core/services/prix.service';
import { ArticlesFrequentsComponent } from '../articles-frequents/articles-frequents.component';
import {
  Article, LignePanier, Ticket, LigneVente, TypeVente
} from '../../../core/models/supermarche.models';

import { OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { BarcodeScannerComponent } from "../components/BarcodeScannerComponent";
import { ScanService } from '../../../core/services/ScanService';


@Component({
  selector: 'app-caisse',
  standalone: true,
  // ✅ FIX 1 : MatTooltipModule supprimé (Angular Material retiré du projet)
  //            Remplacé par title= natif HTML dans le template
  imports: [CommonModule, FormsModule, ArticlesFrequentsComponent, BarcodeScannerComponent],
  template: `
    <div class="container-fluid py-3">
      <!-- En-tête -->
      <div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <div>
          <h4 class="fw-bold mb-0">Caisse</h4>
          <small class="text-muted">
            Ticket #{{ numeroTicket() }} · {{ auth.user()?.nom }}
          </small>
        </div>
        <!-- Indicateur scanner actif -->
        <div class="d-flex align-items-center gap-2">
          <span class="d-flex align-items-center gap-2 small {{ scanSv.modeColor() }}">
            <span class="badge rounded-pill"
                  [class.bg-success]="scanSv.mode() === 'camera'"
                  [class.bg-info]="scanSv.mode() === 'usb'"
                  style="width:10px;height:10px;padding:0;animation:pulse 1.2s infinite"></span>
            {{ scanSv.modeLabel() }}
          </span>
          <button class="btn btn-sm btn-outline-secondary py-0 px-2"
                  title="Forcer le mode caméra"
                  (click)="scanSv.forceMode('camera')">
            <i class="fa-solid fa-camera" style="font-size:11px"></i>
          </button>
        </div>

      </div>

      <div class="row g-3">
        <!-- Colonne gauche : scan + panier -->
        <div class="col-lg-8">

          <!-- Type de vente -->
          <div class="btn-group w-100 mb-3" role="group">
            <input type="radio" class="btn-check" id="det" value="DETAIL"
                   [(ngModel)]="typeVente" (change)="recalculerPanier()" />
            <label class="btn btn-outline-success fw-semibold" for="det">
              <i class="fa-solid fa-user me-1"></i> Vente Détail
            </label>
            <input type="radio" class="btn-check" id="gros" value="GROSSISTE"
                   [(ngModel)]="typeVente" (change)="recalculerPanier()" />
            <label class="btn btn-outline-info fw-semibold" for="gros">
              <i class="fa-solid fa-truck me-1"></i> Vente Grossiste
            </label>
          </div>

          <!-- Info seuil grossiste -->
          @if (typeVente === 'GROSSISTE') {
            <div class="alert alert-info py-2 small mb-3">
              <i class="fa-solid fa-circle-info me-1"></i>
              Tarif grossiste appliqué si qté ≥ seuil minimum par article
            </div>
          }

          <!-- Barre de scan -->
          <!-- ✅ FIX 2 : matTooltip remplacé par title= natif -->
           <div class="input-group mb-2">
            <input #scanInput type="text" class="form-control form-control-lg"
                   [(ngModel)]="saisie"
                   placeholder="Code (5 chiffres) ou nom article..."
                   (keyup.enter)="ajouterParSaisie()"
                   autocomplete="off" />
            <button class="btn btn-success px-3" (click)="ajouterParSaisie()"
                    title="Ajouter l'article">
              <i class="fa-solid fa-plus"></i>
            </button>
            <button class="btn btn-outline-secondary px-3"
                     title="Forcer le mode caméra"
                    (click)="scanSv.forceMode('camera')">
              <i class="fa-solid fa-camera"></i>
            </button>
          </div> 

          <!-- Quantité pré-scan -->
          <div class="d-flex align-items-center gap-3 mb-3 p-2 bg-light rounded">
            <label class="small fw-semibold mb-0">Quantité :</label>
            <input type="number" class="form-control form-control-sm" style="width:80px"
                   [(ngModel)]="quantite" min="1" />
            <span class="small text-muted">Modifiable avant chaque scan</span>
          </div>
          @if (scanSv.mode() === 'camera') {
            <!-- <div class="mb-3">
              <app-barcode-scanner />
            </div> -->
          }
          <!-- Notif ajout -->
          @if (notif()) {
            <div class="alert py-2 mb-2 small fw-semibold"
                 [class.alert-success]="!notifErreur()"
                 [class.alert-danger]="notifErreur()">
              <i class="fa-solid {{ notifErreur() ? 'fa-circle-xmark' : 'fa-check' }} me-1"></i>
              {{ notif() }}
            </div>
          }

          <!-- Articles fréquents -->
          <!-- <div class="mb-3">
            <app-articles-frequents (selectionner)="ajouterArticle($event)" />
          </div> -->

          <!-- Panier -->
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="fw-semibold">Panier
              <span class="badge bg-secondary ms-1">{{ panier().length }}</span>
            </span>
            @if (panier().length) {
              <button class="btn btn-sm btn-outline-danger" (click)="vider()">
                <i class="fa-solid fa-trash me-1"></i> Vider
              </button>
            }
          </div>

          @if (!panier().length) {
            <div class="border rounded p-4 text-center text-muted">
              <i class="fa-solid fa-cart-shopping fa-2x mb-2 d-block opacity-25"></i>
              Panier vide — scannez ou sélectionnez un article
            </div>
          } @else {
            <div class="border rounded overflow-hidden">
              @for (l of panier(); track l.article.code_article) {
                <div class="d-flex align-items-center gap-2 p-2 border-bottom">
                  <!-- Avatar -->
                  <div class="rounded-2 d-flex align-items-center justify-content-center flex-shrink-0"
                       style="width:32px;height:32px;font-size:9px;font-weight:600;background:#E1F5EE;color:#0F6E56">
                    {{ l.article.nom.substring(0,2).toUpperCase() }}
                  </div>
                  <!-- Nom + tarif -->
                  <div class="flex-grow-1 min-width-0">
                    <div class="small fw-semibold text-truncate">{{ l.article.nom }}</div>
                    <span class="badge {{ l.tarif === 'GROSSISTE' ? 'bg-info text-dark' : 'bg-secondary' }}"
                          style="font-size:10px">
                      {{ l.prix_unitaire | number }} F ·
                      {{ l.tarif === 'GROSSISTE' ? 'Gros' : 'Détail' }}
                    </span>
                  </div>
                  <!-- Contrôle quantité -->
                  <div class="d-flex align-items-center gap-1">
                    <button class="btn btn-sm btn-outline-secondary px-2"
                            (click)="changerQte(l, -1)">−</button>
                    <span class="fw-semibold" style="min-width:26px;text-align:center">
                      {{ l.quantite }}
                    </span>
                    <button class="btn btn-sm btn-outline-secondary px-2"
                            (click)="changerQte(l, 1)">+</button>
                  </div>
                  <div class="fw-semibold small" style="min-width:80px;text-align:right">
                    {{ l.sous_total | number }} F
                  </div>
                  <button class="btn btn-sm btn-outline-danger px-2"
                          (click)="supprimer(l)">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
              }
            </div>
          }
        </div>

        <!-- Colonne droite : totaux + validation -->
        <div class="col-lg-4">
          <!-- Résumé type vente -->
          <div class="card mb-3">
            <div class="card-body py-2">
              <div class="small text-muted">Type de vente</div>
              <div class="fw-bold" [class.text-success]="typeVente==='DETAIL'"
                                   [class.text-info]="typeVente==='GROSSISTE'">
                {{ typeVente }}
              </div>
            </div>
          </div>

          <!-- Totaux -->
          <div class="card bg-light mb-3">
            <div class="card-body">
              <div class="d-flex justify-content-between small text-muted mb-1">
                <span>Sous-total</span><span>{{ total() | number }} F</span>
              </div>
              <hr class="my-2">
              <div class="d-flex justify-content-between fw-bold fs-5">
                <span>Total</span><span>{{ total() | number }} F</span>
              </div>
            </div>
          </div>

          <!-- Montant reçu + monnaie -->
          <!-- ✅ FIX 3 : montantRecu est un signal → [(ngModel)] remplacé par
               [ngModel] + (ngModelChange) pour mettre à jour le signal         -->
          <div class="card mb-3">
            <div class="card-body">
              <label class="form-label small fw-semibold">Montant reçu (F)</label>
              <input type="number" class="form-control form-control-lg"
                     [ngModel]="montantRecu()"
                     (ngModelChange)="setMontantRecu($event)"
                     min="0" />
              @if (montantRecu() > 0) {
                <div class="mt-2 d-flex justify-content-between small">
                  <span class="text-muted">Monnaie à rendre</span>
                  <span class="fw-bold" [class.text-success]="monnaie() >= 0"
                                        [class.text-danger]="monnaie() < 0">
                    {{ monnaie() | number }} F
                  </span>
                </div>
              }
            </div>
          </div>

          <!-- Bouton valider -->
          <button class="btn btn-success btn-lg w-100 fw-semibold"
                  [disabled]="!panier().length || saving()"
                  (click)="valider()">
            @if (saving()) {
              <span class="spinner-border spinner-border-sm me-2"></span>
            }
            <i class="fa-solid fa-check me-2"></i>Valider la vente
          </button>
          <button class="btn btn-outline-danger w-100 mt-2" (click)="vider()">
            Annuler
          </button>
        </div>
      </div>
    </div>

    <style>
      @keyframes pulse {
        0%,100% { opacity:1; transform:scale(1); }
        50%      { opacity:.4; transform:scale(1.4); }
      }
    </style>
  `,
})
export class CaisseComponent implements OnInit, OnDestroy {
  protected auth = inject(AuthService);
  private cache = inject(CacheService);
  private data$ = inject(DataService);
  private beep = inject(BeepService);
  private prixSv = inject(PrixService);
  private router = inject(Router);
  protected scanSv = inject(ScanService);
  private _scanSub!: Subscription;

  @ViewChild('scanInput') scanInput!: ElementRef<HTMLInputElement>;

  saisie = '';
  quantite = 1;
  typeVente: TypeVente = 'DETAIL';

  ngOnInit(): void {
    this._scanSub = this.scanSv.scan$.subscribe(code => {
      this.saisie = code;
      this.ajouterParSaisie();
    });
  }

  ngOnDestroy(): void {
    this._scanSub?.unsubscribe();
  }
  // ✅ FIX 3 : montantRecu devient un signal pour que monnaie() computed
  //            se réévalue automatiquement à chaque saisie
  montantRecu = signal(0);

  saving = signal(false);
  notif = signal('');
  notifErreur = signal(false);

  private _panier = signal<LignePanier[]>([]);
  panier = this._panier.asReadonly();

  total = computed(() => this._panier().reduce((s, l) => s + l.sous_total, 0));

  // ✅ FIX 3 suite : monnaie() lit montantRecu() → réactif automatiquement
  monnaie = computed(() => this.montantRecu() - this.total());

  numeroTicket = computed(() => {
    const t = this.cache.getTickets();
    return String(t.length + 1).padStart(5, '0');
  });

  // ✅ FIX 3 suite : setter appelé par (ngModelChange) dans le template
  setMontantRecu(val: number): void {
    this.montantRecu.set(val ?? 0);
  }


  // Ajouter depuis la barre de saisie (code 5 chiffres ou nom)
  // REMPLACER ajouterParSaisie() dans caisse.component.ts

  ajouterParSaisie(): void {
    const raw = this.saisie.trim();
    if (!raw) return;

    const q = raw.toLowerCase();

    const article = this.cache.getArticles().find(
      a => a.code_article.toLowerCase() === q          // ← toLowerCase() des deux côtés
        || a.nom.toLowerCase().includes(q)
    );

    if (!article) {
      this.afficherNotif(`❌ Article introuvable : "${raw}"`, true);
      // Sélectionner le texte pour resaisie rapide
      this.scanInput?.nativeElement.select();
      return;
    }

    this.ajouterArticle(article);
    this.saisie = '';
    setTimeout(() => this.scanInput?.nativeElement.focus(), 50);
  }
  // Ajouter depuis les articles fréquents ou scan validé
  ajouterArticle(article: Article): void {
    const qte = this.quantite || 1;
    const prix = this.prixSv.calculer(article, qte, this.typeVente);
    const exist = this._panier().findIndex(l => l.article.code_article === article.code_article);

    if (exist >= 0) {
      this._panier.update(p => p.map((l, i) => {
        if (i !== exist) return l;
        const newQte = l.quantite + qte;
        const newPrix = this.prixSv.calculer(article, newQte, this.typeVente);
        return {
          ...l, quantite: newQte, prix_unitaire: newPrix.prix,
          tarif: newPrix.tarif, sous_total: newPrix.prix * newQte
        };
      }));
    } else {
      this._panier.update(p => [...p, {
        article, quantite: qte,
        prix_unitaire: prix.prix, tarif: prix.tarif,
        sous_total: prix.prix * qte,
      }]);
    }

    this.beep.beep();
    this.afficherNotif(`+${qte} × ${article.nom}`);
    this.quantite = 1;
  }

  changerQte(ligne: LignePanier, delta: number): void {
    const newQte = ligne.quantite + delta;
    if (newQte <= 0) { this.supprimer(ligne); return; }
    const prix = this.prixSv.calculer(ligne.article, newQte, this.typeVente);
    this._panier.update(p => p.map(l =>
      l.article.code_article === ligne.article.code_article
        ? {
          ...l, quantite: newQte, prix_unitaire: prix.prix,
          tarif: prix.tarif, sous_total: prix.prix * newQte
        }
        : l
    ));
  }

  supprimer(ligne: LignePanier): void {
    this._panier.update(p => p.filter(l => l.article.code_article !== ligne.article.code_article));
  }

  vider(): void {
    this._panier.set([]);
    // ✅ FIX 3 : reset du signal, pas d'une variable simple
    this.montantRecu.set(0);
  }

  recalculerPanier(): void {
    this._panier.update(p => p.map(l => {
      const prix = this.prixSv.calculer(l.article, l.quantite, this.typeVente);
      return {
        ...l, prix_unitaire: prix.prix, tarif: prix.tarif,
        sous_total: prix.prix * l.quantite
      };
    }));
  }

  async valider(): Promise<void> {
    if (!this._panier().length) return;
    this.saving.set(true);

    const now = new Date().toISOString();
    const idCaissier = this.auth.user()!.id;
    const idTicket = `TK-${Date.now()}`;

    const ticket: Ticket = {
      id_ticket: idTicket,
      date_heure: now,
      type_vente: this.typeVente,
      montant_total: this.total(),
      // ✅ FIX 3 : lire le signal avec ()
      montant_recu: this.montantRecu() || this.total(),
      monnaie_rendue: Math.max(0, this.monnaie()),
      id_caissier: idCaissier,
      nom_caissier: this.auth.user()!.nom,
    };

    const lignes: LigneVente[] = this._panier().map((l, i) => ({
      id_ligne: `LG-${idTicket}-${i}`,
      id_ticket: idTicket,
      code_article: l.article.code_article,
      nom_article: l.article.nom,
      quantite: l.quantite,
      prix_unitaire_applique: l.prix_unitaire,
      tarif_applique: l.tarif,
      sous_total: l.sous_total,
    }));

    this.data$.enregistrerVente(ticket, lignes);

    this.saving.set(false);
    this.vider();
    // this.router.navigate(['/recu', idTicket]);
  }

  private notifTimer: any;
  private afficherNotif(msg: string, erreur = false): void {
    this.notif.set(msg);
    this.notifErreur.set(erreur);
    clearTimeout(this.notifTimer);
    this.notifTimer = setTimeout(() => this.notif.set(''), 2000);
  }
}