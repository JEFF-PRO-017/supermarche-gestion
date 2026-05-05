// confirm-modal.component.ts
import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface ConfirmData {
  titre: string;
  message: string;
  labelOk?: string;      // défaut : "Confirmer"
  couleurOk?: string;    // défaut : "btn-danger"
}

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title fw-semibold">
          <i class="fa-solid fa-triangle-exclamation text-warning me-2"></i>
          {{ data.titre }}
        </h5>
      </div>
      <div class="modal-body">{{ data.message }}</div>
      <div class="modal-footer">
        <button class="btn btn-secondary" (click)="ref.close(false)">Annuler</button>
        <button class="btn {{ data.couleurOk ?? 'btn-danger' }}"
                (click)="ref.close(true)">
          {{ data.labelOk ?? 'Confirmer' }}
        </button>
      </div>
    </div>
  `,
})
export class ConfirmModalComponent {
  constructor(
    public ref: MatDialogRef<ConfirmModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmData
  ) {}
}
