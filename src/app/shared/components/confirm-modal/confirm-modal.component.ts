import { Component, Input } from '@angular/core';

export interface ConfirmData {
  titre: string;
  message: string;
  labelOk?: string;
  couleurOk?: string;
}

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  template: `
    <div class="modal fade" tabindex="-1">
      <div class="modal-dialog" style="max-width:380px">
        <div class="modal-content">

          <div class="modal-header">
            <h5 class="modal-title fw-semibold">
              <i class="fa-solid fa-triangle-exclamation text-warning me-2"></i>
              {{ data.titre }}
            </h5>
            <button type="button" class="btn-close" (click)="closeModal(false)"></button>
          </div>

          <div class="modal-body">{{ data.message }}</div>

          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModal(false)">Annuler</button>
            <button class="btn {{ data.couleurOk ?? 'btn-danger' }}"
                    (click)="closeModal(true)">
              {{ data.labelOk ?? 'Confirmer' }}
            </button>
          </div>

        </div>
      </div>
    </div>
  `,
})
export class ConfirmModalComponent {
  @Input() data!: ConfirmData;
  @Input() closeModal!: (result?: any) => void;
}