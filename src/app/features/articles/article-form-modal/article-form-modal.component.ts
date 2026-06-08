import { Component, Input, OnInit, signal, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DataService } from '../../../core/services/data.service';
import { PrixService } from '../../../core/services/prix.service';
import { Article } from '../../../core/models/supermarche.models';

export interface ArticleFormData { article?: Article; }

@Component({
  selector: 'app-article-form-modal',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  template: `
    <div class="modal fade" tabindex="-1">
      <div class="modal-dialog modal-dialog-scrollable" style="max-width:560px">
        <div class="modal-content">

          <div class="modal-header">
            <h5 class="modal-title fw-semibold">
              <i class="fa-solid {{ isEdit ? 'fa-pen' : 'fa-plus' }} me-2 text-success"></i>
              {{ isEdit ? 'Modifier' : 'Nouvel' }} article
            </h5>
            <button type="button" class="btn-close" (click)="closeModal()"></button>
          </div>

          <div class="modal-body" [formGroup]="form">
            <p class="fw-semibold small text-uppercase text-muted mb-2">Identification</p>
            <div class="row g-2 mb-3">
              <div class="col-6">
                <label class="form-label small fw-semibold">Code article *</label>
                <div class="input-group input-group-sm">
                  <input type="text" class="form-control" formControlName="code_article"
                         placeholder="00142" maxlength="5" />
                  @if (!isEdit) {
                    <button class="btn btn-outline-secondary" type="button"
                            (click)="genCode()" title="Générer un code">
                      <i class="fa-solid fa-wand-magic-sparkles"></i>
                    </button>
                  }
                </div>
                <div class="form-text">5 chiffres, ex: 00142</div>
              </div>
              <div class="col-6">
                <label class="form-label small fw-semibold">Nom *</label>
                <input type="text" class="form-control form-control-sm"
                       formControlName="nom" placeholder="ex: Huile végétale 1L" />
              </div>
              <div class="col-12">
                <label class="form-label small fw-semibold">Description</label>
                <input type="text" class="form-control form-control-sm"
                       formControlName="description" placeholder="Description courte (facultatif)" />
              </div>
            </div>

            <p class="fw-semibold small text-uppercase text-muted mb-2">Tarification</p>
            <div class="row g-2 mb-2">
              <div class="col-12">
                <label class="form-label small fw-semibold">
                  Prix d'achat (F) *
                  <i class="fa-solid fa-eye-slash text-muted ms-1"
                     title="Visible Admin uniquement"></i>
                </label>
                <input type="number" class="form-control form-control-sm"
                       formControlName="prix_achat" min="0" (input)="calcMarge()" />
              </div>
              <div class="col-6">
                <label class="form-label small fw-semibold">
                  <span class="badge bg-success bg-opacity-10 text-success me-1">Détail</span>
                  Prix vente (F) *
                </label>
                <input type="number" class="form-control form-control-sm"
                       formControlName="prix_detail" min="0" (input)="calcMarge()" />
                @if (margeDetail() !== null) {
                  <div class="form-text" [class.text-success]="margeDetail()! >= 0"
                                         [class.text-danger]="margeDetail()! < 0">
                    Marge : {{ margeDetail() }} F ({{ margePctDetail() }}%)
                  </div>
                }
              </div>
              <div class="col-6">
                <label class="form-label small fw-semibold">
                  <span class="badge bg-info bg-opacity-10 text-info me-1">Gros</span>
                  Prix vente (F) *
                </label>
                <input type="number" class="form-control form-control-sm"
                       formControlName="prix_grossiste" min="0" (input)="calcMarge()" />
                @if (margeGros() !== null) {
                  <div class="form-text" [class.text-success]="margeGros()! >= 0"
                                         [class.text-danger]="margeGros()! < 0">
                    Marge : {{ margeGros() }} F ({{ margePctGros() }}%)
                  </div>
                }
              </div>
              <div class="col-6">
                <label class="form-label small fw-semibold">Qté min. grossiste *</label>
                <input type="number" class="form-control form-control-sm"
                       formControlName="qte_min_grossiste" min="1" />
                <div class="form-text">Seuil pour appliquer tarif gros</div>
              </div>
            </div>

            <p class="fw-semibold small text-uppercase text-muted mb-2 mt-3">Stock</p>
            <div class="row g-2">
              <div class="col-4">
                <label class="form-label small fw-semibold">Stock initial *</label>
                <input type="number" class="form-control form-control-sm"
                       formControlName="stock_actuel" min="0" />
              </div>
              <div class="col-4">
                <label class="form-label small fw-semibold">Seuil alerte *</label>
                <input type="number" class="form-control form-control-sm"
                       formControlName="seuil_alerte" min="1" />
              </div>
              <div class="col-4">
                <label class="form-label small fw-semibold">
                  Stock max <span class="text-muted fw-normal">(facultatif)</span>
                </label>
                <input type="number" class="form-control form-control-sm"
                       formControlName="stock_maximum" min="0" />
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModal()">Annuler</button>
            <button class="btn btn-success" [disabled]="form.invalid || saving()"
                    (click)="sauvegarder()">
              @if (saving()) { <span class="spinner-border spinner-border-sm me-1"></span> }
              <i class="fa-solid fa-check me-1"></i>
              {{ isEdit ? 'Mettre à jour' : 'Enregistrer' }}
            </button>
          </div>

        </div>
      </div>
    </div>
  `,
})
export class ArticleFormModalComponent implements OnInit {
  @Input() data!: ArticleFormData;
  @Input() closeModal!: (result?: any) => void;

  private data$ = inject(DataService);
  private prixSv = inject(PrixService);
  private fb = inject(FormBuilder);

  saving         = signal(false);
  margeDetail    = signal<number | null>(null);
  margeGros      = signal<number | null>(null);
  margePctDetail = signal<number | null>(null);
  margePctGros   = signal<number | null>(null);

  get isEdit() { return !!this.data?.article; }

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

  ngOnInit() {
    if (this.data?.article) {
      this.form.patchValue(this.data.article);
      this.form.get('code_article')?.disable();
      this.calcMarge();
    }
  }

  genCode() {
    this.form.get('code_article')?.setValue(
      String(Math.floor(Math.random() * 90000) + 10000)
    );
  }

  calcMarge() {
    const pa = +this.form.value.prix_achat! || 0;
    const pd = +this.form.value.prix_detail! || 0;
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

   sauvegarder() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const val = { ...this.form.getRawValue() } as Article;
    val.prix_achat        = +val.prix_achat;
    val.prix_detail       = +val.prix_detail;
    val.prix_grossiste    = +val.prix_grossiste;
    val.qte_min_grossiste = +val.qte_min_grossiste;
    val.stock_actuel      = +val.stock_actuel;
    val.seuil_alerte      = +val.seuil_alerte;
    val.stock_maximum     = +val.stock_maximum || 0;
    this.isEdit ?  this.data$.updateArticle(val) :  this.data$.addArticle(val);
    this.saving.set(false);
    this.closeModal(true);
  }
}