import { Component, Input, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../../core/services/data.service';
import { AuthService } from '../../../core/services/auth.service';
import { Article } from '../../../core/models/supermarche.models';

export interface ReapproData { article: Article; }

@Component({
  selector: 'app-reappro-modal',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="modal fade" tabindex="-1">
      <div class="modal-dialog" style="max-width:380px">
        <div class="modal-content">

          <div class="modal-header">
            <h5 class="modal-title fw-semibold">
              <i class="fa-solid fa-arrow-up text-success me-2"></i>
              Réapprovisionner
            </h5>
            <button type="button" class="btn-close" (click)="closeModal()"></button>
          </div>

          <div class="modal-body">
            <p class="text-muted mb-3">
              Article : <strong>{{ data.article.nom }}</strong><br>
              Stock actuel : <strong>{{ data.article.stock_actuel }}</strong>
            </p>
            <label class="form-label small fw-semibold">Quantité à ajouter</label>
            <input type="number" class="form-control" [(ngModel)]="qte" min="1" />
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModal()">Annuler</button>
            <button class="btn btn-success" [disabled]="!qte || qte < 1"
                    (click)="confirmer()">
              <i class="fa-solid fa-check me-1"></i> Valider
            </button>
          </div>

        </div>
      </div>
    </div>
  `,
})
export class ReapproModalComponent {
  @Input() data!: ReapproData;
  @Input() closeModal!: (result?: any) => void;

  private data$ = inject(DataService);
  private auth  = inject(AuthService);

  qte = 1;

  async confirmer() {
    if (!this.qte || this.qte < 1) return;
    await this.data$.reapprovisionner(
      this.data.article.code_article,
      this.qte,
      this.auth.user()?.id ?? ''
    );
    this.closeModal(true);
  }
}