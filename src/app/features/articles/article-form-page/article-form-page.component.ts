// article-form-page.component.ts
// Page dédiée création/modification article — 3 boutons d'action ergonomiques
import { Component, inject, signal, OnInit } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DataService } from '../../../core/services/data.service';
import { CacheService } from '../../../core/services/cache.service';
import { PrixService } from '../../../core/services/prix.service';
import { Article } from '../../../core/models/supermarche.models';

@Component({
  selector: 'app-article-form-page',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
  template: `
    <div>

      <!-- Topbar -->
      <div class="sm-topbar">
        <div>
          <h2 class="sm-page-title">
            {{ isEdit ? 'Modifier l\'article' : 'Nouvel article' }}
          </h2>
          <p class="sm-page-sub">* champs obligatoires</p>
        </div>
        <a routerLink="/catalogue" class="btn-sm-outline" style="font-size:12px;padding:7px 12px;text-decoration:none">
          <i class="fa-solid fa-arrow-left" style="margin-right:5px;font-size:11px"></i>Retour
        </a>
      </div>

      <!-- Message retour (enregistrement réussi) -->
      @if (messageRetour()) {
        <div style="background:var(--sm-primary-lt);color:var(--sm-primary-dk);
                    border-radius:8px;padding:.625rem .875rem;margin-bottom:.875rem;font-size:13px">
          <i class="fa-solid fa-check" style="margin-right:6px"></i>
          {{ messageRetour() }}
        </div>
      }

      <form [formGroup]="form">

        <!-- Section identification -->
        <div class="sm-section">
          <div class="sm-section-title">Identification</div>
          <div class="sm-g2 mb-3">
            <div>
              <label class="form-label">Code article *</label>
              <div class="d-flex gap-2">
                <input type="text" class="form-control" formControlName="code_article"
                       placeholder="00142" maxlength="5" style="flex:1"
                       [class.is-invalid]="estInvalide('code_article')" />
                @if (!isEdit) {
                  <button type="button" class="btn-icon" style="flex-shrink:0"
                          title="Générer un code aléatoire" (click)="genCode()">
                    <i class="fa-solid fa-wand-magic-sparkles" style="font-size:12px"></i>
                  </button>
                }
              </div>
              <div class="form-text">5 chiffres — ex: 00142</div>
            </div>
            <div>
              <label class="form-label">Nom *</label>
              <input type="text" class="form-control" formControlName="nom"
                     placeholder="ex: Huile végétale 1L"
                     [class.is-invalid]="estInvalide('nom')" />
            </div>
          </div>
          <div>
            <label class="form-label">Description</label>
            <input type="text" class="form-control" formControlName="description"
                   placeholder="Description courte (facultatif)" />
          </div>
        </div>

        <!-- Section tarification -->
        <div class="sm-section">
          <div class="sm-section-title">Tarification</div>
          <div class="mb-3">
            <label class="form-label">
              Prix d'achat (F) *
              <span class="form-text ms-1">— confidentiel Admin</span>
            </label>
            <input type="number" class="form-control" formControlName="prix_achat"
                   placeholder="0" (input)="calcMarge()"
                   [class.is-invalid]="estInvalide('prix_achat')" />
          </div>

          <div class="sm-g2 mb-2">
            <!-- Tarif détail -->
            <div style="background:var(--sm-primary-lt);border-radius:8px;padding:.875rem">
              <div style="font-size:11px;font-weight:500;color:var(--sm-primary-dk);margin-bottom:.625rem">
                Tarif détail
              </div>
              <label class="form-label">Prix vente (F) *</label>
              <input type="number" class="form-control form-control-sm"
                     formControlName="prix_detail" placeholder="0"
                     (input)="calcMarge()" />
              <!-- Marge détail calculée -->
              @if (margeDetail() !== null) {
                <div class="form-text mt-1" [style.color]="margeDetail()! >= 0 ? \'var(--sm-primary-dk)\' : \'var(--sm-danger)\'">
                  Marge : {{ margeDetail() | number }} F ({{ margePctDetail() }}%)
                </div>
              }
            </div>

            <!-- Tarif grossiste -->
            <div style="background:var(--sm-info-lt);border-radius:8px;padding:.875rem">
              <div style="font-size:11px;font-weight:500;color:#0C447C;margin-bottom:.625rem">
                Tarif grossiste
              </div>
              <label class="form-label">Prix vente (F) *</label>
              <input type="number" class="form-control form-control-sm"
                     formControlName="prix_grossiste" placeholder="0"
                     (input)="calcMarge()" />
              @if (margeGros() !== null) {
                <div class="form-text mt-1" [style.color]="margeGros()! >= 0 ? \'#0C447C\' : \'var(--sm-danger)\'">
                  Marge : {{ margeGros() | number }} F ({{ margePctGros() }}%)
                </div>
              }
              <label class="form-label mt-2">Qté min. grossiste *</label>
              <input type="number" class="form-control form-control-sm"
                     formControlName="qte_min_grossiste" placeholder="ex: 12" />
              <div class="form-text">Seuil pour appliquer le tarif gros</div>
            </div>
          </div>
        </div>

        <!-- Section stock -->
        <div class="sm-section">
          <div class="sm-section-title">Stock</div>
          <div class="sm-g3">
            <div>
              <label class="form-label">Stock initial *</label>
              <input type="number" class="form-control" formControlName="stock_actuel" placeholder="0" />
            </div>
            <div>
              <label class="form-label">Seuil alerte *</label>
              <input type="number" class="form-control" formControlName="seuil_alerte" placeholder="10" />
            </div>
            <div>
              <label class="form-label">
                Stock max
                <span class="form-text" style="font-size:10px"> (opt.)</span>
              </label>
              <input type="number" class="form-control" formControlName="stock_maximum" placeholder="—" />
            </div>
          </div>
        </div>

        <!-- 3 boutons d'action ergonomiques -->
        <div class="sm-action-btns">

          <!-- Bouton 1 : enregistrer et retourner au catalogue -->
          <button type="button" class="btn-sm-primary"
                  [disabled]="form.invalid || saving()"
                  (click)="sauvegarder('catalogue')">
            @if (saving() === 'catalogue') {
              <span class="spinner-border spinner-border-sm me-1"></span>
            } @else {
              <i class="fa-solid fa-check" style="font-size:11px;margin-right:4px"></i>
            }
            Enregistrer
          </button>

          <!-- Bouton 2 : enregistrer et vider le formulaire (nouvel article) -->
          <button type="button" class="btn-sm-outline"
                  [disabled]="form.invalid || saving() === 'nouveau'"
                  (click)="sauvegarder('nouveau')">
            @if (saving() === 'nouveau') {
              <span class="spinner-border spinner-border-sm me-1"></span>
            } @else {
              <i class="fa-solid fa-plus" style="font-size:11px;margin-right:4px"></i>
            }
            Enr. + Nouveau
          </button>

          <!-- Bouton 3 : enregistrer et rester sur la page (continuer à modifier) -->
          <button type="button" class="btn-sm-ghost"
                  [disabled]="form.invalid || saving() === 'rester'"
                  (click)="sauvegarder('rester')">
            @if (saving() === 'rester') {
              <span class="spinner-border spinner-border-sm me-1"></span>
            } @else {
              <i class="fa-solid fa-pen" style="font-size:11px;margin-right:4px"></i>
            }
            Enr. + Modifier
          </button>

        </div>

      </form>
    </div>
  `,
})
export class ArticleFormPageComponent implements OnInit {
  private data$  = inject(DataService);
  private cache  = inject(CacheService);
  private prixSv = inject(PrixService);
  private fb     = inject(FormBuilder);
  private router = inject(Router);
  private route  = inject(ActivatedRoute);

  isEdit       = false;
  saving       = signal<string>('');       // 'catalogue' | 'nouveau' | 'rester' | ''
  messageRetour = signal('');

  margeDetail    = signal<number | null>(null);
  margeGros      = signal<number | null>(null);
  margePctDetail = signal<number | null>(null);
  margePctGros   = signal<number | null>(null);

  form = this.fb.group({
    code_article:      ['', [Validators.required, Validators.pattern(/^\d{5}$/)]],
    nom:               ['', Validators.required],
    description:       [''],
    prix_achat:        [0, [Validators.required, Validators.min(0)]],
    prix_detail:       [0, [Validators.required, Validators.min(1)]],
    prix_grossiste:    [0, [Validators.required, Validators.min(1)]],
    qte_min_grossiste: [1, [Validators.required, Validators.min(1)]],
    stock_actuel:      [0, Validators.required],
    seuil_alerte:      [10, [Validators.required, Validators.min(1)]],
    stock_maximum:     [0],
  });

  ngOnInit(): void {
    const code = this.route.snapshot.paramMap.get('code');
    if (code) {
      this.isEdit = true;
      const article = this.cache.getArticles().find(a => a.code_article === code);
      if (article) {
        this.form.patchValue(article);
        this.form.get('code_article')?.disable(); // code non modifiable en édition
        this.calcMarge();
      }
    }
  }

  genCode(): void {
    this.form.get('code_article')?.setValue(
      String(Math.floor(Math.random() * 90000) + 10000)
    );
  }

  estInvalide(champ: string): boolean {
    const ctrl = this.form.get(champ);
    return !!(ctrl?.invalid && ctrl?.touched);
  }

  calcMarge(): void {
    const pa = +this.form.value.prix_achat!  || 0;
    const pd = +this.form.value.prix_detail!  || 0;
    const pg = +this.form.value.prix_grossiste! || 0;
    if (pa > 0 && pd > 0) {
      this.margeDetail.set(this.prixSv.margeValeur(pd, pa));
      this.margePctDetail.set(this.prixSv.margePct(pd, pa));
    }
    if (pa > 0 && pg > 0) {
      this.margeGros.set(this.prixSv.margeValeur(pg, pa));
      this.margePctGros.set(this.prixSv.margePct(pg, pa));
    }
  }

  async sauvegarder(action: 'catalogue' | 'nouveau' | 'rester'): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(action);

    const val = { ...this.form.getRawValue() } as Article;
    // Convertir les valeurs numériques (inputs retournent des strings)
    val.prix_achat        = +val.prix_achat;
    val.prix_detail       = +val.prix_detail;
    val.prix_grossiste    = +val.prix_grossiste;
    val.qte_min_grossiste = +val.qte_min_grossiste;
    val.stock_actuel      = +val.stock_actuel;
    val.seuil_alerte      = +val.seuil_alerte;
    val.stock_maximum     = +val.stock_maximum || 0;

    if (this.isEdit) await this.data$.updateArticle(val);
    else             await this.data$.addArticle(val);

    this.saving.set('');

    if (action === 'catalogue') {
      this.router.navigate(['/catalogue']);
    } else if (action === 'nouveau') {
      // Vider le formulaire pour saisir un nouvel article
      this.form.reset({ prix_achat:0, prix_detail:0, prix_grossiste:0, qte_min_grossiste:1, stock_actuel:0, seuil_alerte:10, stock_maximum:0 });
      this.form.get('code_article')?.enable();
      this.isEdit = false;
      this.margeDetail.set(null); this.margeGros.set(null);
      this.messageRetour.set(`Article « ${val.nom} » enregistré. Saisissez le suivant.`);
      setTimeout(() => this.messageRetour.set(''), 3000);
    } else {
      // Rester sur la page en mode modification
      this.isEdit = true;
      this.form.get('code_article')?.disable();
      this.messageRetour.set(`Modifications de « ${val.nom} » enregistrées.`);
      setTimeout(() => this.messageRetour.set(''), 3000);
    }
  }
}
