import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Ticket, LigneVente } from '../../../core/models/supermarche.models';

export interface TicketDetailData {
  ticket: Ticket;
  lignes: LigneVente[];
}

@Component({
  selector: 'app-ticket-detail-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal fade" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">

          <div class="modal-header text-center d-block border-bottom-0 pb-0">
            <h5 class="fw-bold mb-0">Supermarché Étoile</h5>
            <small class="text-muted">Yaoundé, Cameroun</small>
            <div class="mt-2 d-flex justify-content-between align-items-center px-2">
              <span class="badge {{ data.ticket.type_vente === 'GROSSISTE' ? 'bg-info' : 'bg-secondary' }}">
                {{ data.ticket.type_vente }}
              </span>
              <small class="text-muted">
                {{ data.ticket.id_ticket }} · {{ data.ticket.date_heure | date:'dd/MM/yyyy HH:mm' }}
              </small>
            </div>
            <small class="text-muted">Caissier : {{ data.ticket.nom_caissier }}</small>
          </div>

          <div class="modal-body py-2">
            <hr class="border-dashed my-2">
            @for (l of data.lignes; track l.id_ligne) {
              <div class="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <div class="fw-semibold small">{{ l.nom_article }}</div>
                  <small class="text-muted">
                    {{ l.prix_unitaire_applique | number }} F × {{ l.quantite }}
                    <span class="badge ms-1"
                      [class]="l.tarif_applique === 'GROSSISTE' ? 'bg-info text-dark' : 'bg-light text-secondary border'">
                      {{ l.tarif_applique === 'GROSSISTE' ? 'Gros' : 'Détail' }}
                    </span>
                  </small>
                </div>
                <strong class="small">{{ l.sous_total | number }} F</strong>
              </div>
            }
            <hr class="border-dashed my-2">
            <div class="d-flex justify-content-between">
              <span class="text-muted small">Total</span>
              <strong>{{ data.ticket.montant_total | number }} F</strong>
            </div>
            <div class="d-flex justify-content-between">
              <span class="text-muted small">Reçu</span>
              <span>{{ data.ticket.montant_recu | number }} F</span>
            </div>
            <div class="d-flex justify-content-between">
              <span class="text-muted small">Monnaie rendue</span>
              <span class="text-success fw-semibold">{{ data.ticket.monnaie_rendue | number }} F</span>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-outline-secondary btn-sm">
              <i class="fa-solid fa-print me-1"></i> Imprimer
            </button>
            <button class="btn btn-secondary" (click)="closeModal()">Fermer</button>
          </div>

        </div>
      </div>
    </div>
  `,
})
export class TicketDetailModalComponent implements OnInit{
  @Input() data!: TicketDetailData;
  @Input() closeModal!: (result?: any) => void;

  ngOnInit() {
  console.log(this.data)
    // if (this.data?.article) {
    //   this.form.patchValue(this.data.article);
    //   this.form.get('code_article')?.disable();
    //   this.calcMarge();
    // }
  }
}