// recu.component.ts
import { Component, inject, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CacheService } from '../../../core/services/cache.service';
import { environment } from 'src/environments/environment.prod';

@Component({
  selector: 'app-recu',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container py-4 d-flex justify-content-center">
      <!-- Boutons d'action -->
      <div style="width:100%;max-width:380px">
        <div class="d-flex gap-2 mb-3">
          <button class="btn btn-outline-secondary flex-fill" onclick="window.print()">
            <i class="fa-solid fa-print me-1"></i> Imprimer
          </button>
          <button class="btn btn-success flex-fill" (click)="nouvelleVente()">
            <i class="fa-solid fa-plus me-1"></i> Nouvelle vente
          </button>
        </div>

        @if (data(); as d) {
          <!-- Reçu -->
          <div class="card border" id="recu-print">
            <div class="card-body">
              <!-- En-tête -->
              <div class="text-center pb-3 border-bottom border-dashed mb-3">
                <h5 class="fw-bold mb-0">{{ app_name }}</h5>
                <small class="text-muted d-block">Douala, Cameroun · Tél : {{ app_tel }}</small>
                <div class="mt-2">
                  <code class="small">{{ d.ticket.id_ticket }}</code>
                </div>
                <small class="text-muted">
                  {{ d.ticket.date_heure | date:'dd/MM/yyyy HH:mm' }} ·
                  {{ d.ticket.nom_caissier }}
                </small>
                <div class="mt-1">
                  <span class="badge {{ d.ticket.type_vente === 'GROSSISTE' ? 'bg-info text-dark' : 'bg-secondary' }}">
                    Vente {{ d.ticket.type_vente }}
                  </span>
                </div>
              </div>

              <!-- Lignes -->
              @for (l of d.lignes; track l.id_ligne) {
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <div class="small fw-semibold">{{ l.nom_article }}</div>
                    <small class="text-muted">
                      {{ l.prix_unitaire_applique | number }} F × {{ l.quantite }}
                      <span class="badge ms-1"
                            [class]="l.tarif_applique === 'GROSSISTE'
                              ? 'bg-info text-dark' : 'bg-light text-secondary border'">
                        {{ l.tarif_applique === 'GROSSISTE' ? 'Gros' : 'Détail' }}
                      </span>
                    </small>
                  </div>
                  <strong class="small">{{ l.sous_total | number }} F</strong>
                </div>
              }

              <!-- Totaux -->
              <hr class="border-dashed my-2">
              <div class="d-flex justify-content-between small text-muted mb-1">
                <span>Sous-total</span>
                <span>{{ d.ticket.montant_total | number }} F</span>
              </div>
              <div class="d-flex justify-content-between small text-muted mb-1">
                <span>Paiement</span><span>Espèces</span>
              </div>
              <div class="d-flex justify-content-between small text-muted mb-1">
                <span>Montant reçu</span>
                <span>{{ d.ticket.montant_recu | number }} F</span>
              </div>
              <hr class="my-1">
              <div class="d-flex justify-content-between fw-bold">
                <span>TOTAL</span>
                <span>{{ d.ticket.montant_total | number }} F</span>
              </div>
              <div class="d-flex justify-content-between mt-1">
                <span class="text-muted small">Monnaie rendue</span>
                <span class="text-success fw-bold">{{ d.ticket.monnaie_rendue | number }} F</span>
              </div>

              <div class="text-center text-muted mt-3" style="font-size:11px">
                Merci pour votre achat !<br>Conservez ce reçu pour tout échange.
              </div>
            </div>
          </div>
        } @else {
          <div class="alert alert-warning">
            <i class="fa-solid fa-triangle-exclamation me-1"></i>
            Ticket introuvable
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    @media print {
      .btn { display: none !important; }
      #recu-print { border: none !important; box-shadow: none !important; }
    }
  `],
})
export class RecuComponent {
  private cache  = inject(CacheService);
  private route  = inject(ActivatedRoute);
  private router = inject(Router);
  app_name = environment.app_name;
  app_tel = environment.app_tel;

  // Ticket + lignes depuis le cache (déjà enregistrés par CaisseComponent)
  data = computed(() => {
    const idTicket = this.route.snapshot.paramMap.get('id');
    const ticket   = this.cache.getTickets().find(t => t.id_ticket === idTicket);
    if (!ticket) return null;
    const lignes   = this.cache.getLignes().filter(l => l.id_ticket === idTicket);
    return { ticket, lignes };
  });

  nouvelleVente(): void { this.router.navigate(['/caisse']); }
}
