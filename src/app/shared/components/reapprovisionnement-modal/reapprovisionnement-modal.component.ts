// reapprovisionnement-modal.component.ts
import { Component, Inject, inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../../core/services/data.service';
import { AuthService } from '../../../core/services/auth.service';
import { Article } from '../../../core/models/supermarche.models';

export interface ReapproData { article: Article; }

@Component({
  selector: 'app-reappro-modal',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, FormsModule],
  template: `
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title fw-semibold">
          <i class="fa-solid fa-arrow-up text-success me-2"></i>
          Réapprovisionner
        </h5>
      </div>
      <div class="modal-body">
        <p class="text-muted mb-3">
          Article : <strong>{{ data.article.nom }}</strong><br>
          Stock actuel : <strong>{{ data.article.stock_actuel }}</strong>
        </p>
        <mat-form-field class="w-100" appearance="outline">
          <mat-label>Quantité à ajouter</mat-label>
          <input matInput type="number" [(ngModel)]="qte" min="1" />
        </mat-form-field>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" (click)="ref.close()">Annuler</button>
        <button class="btn btn-success" [disabled]="!qte || qte < 1"
                (click)="confirmer()">
          <i class="fa-solid fa-check me-1"></i> Valider
        </button>
      </div>
    </div>
  `,
})
export class ReapproModalComponent {
  private data$ = inject(DataService);
  private auth  = inject(AuthService);

  qte = 1;

  constructor(
    public ref: MatDialogRef<ReapproModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ReapproData
  ) {}

  async confirmer(): Promise<void> {
    if (!this.qte || this.qte < 1) return;
    await this.data$.reapprovisionner(
      this.data.article.code_article,
      this.qte,
      this.auth.user()?.id ?? ''
    );
    this.ref.close(true);
  }
}
