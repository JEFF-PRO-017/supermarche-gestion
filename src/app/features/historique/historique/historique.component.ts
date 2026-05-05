// historique.component.ts
import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTabsModule } from '@angular/material/tabs';
import { CacheService } from '../../../core/services/cache.service';
import { DataService } from '../../../core/services/data.service';
import { AuthService } from '../../../core/services/auth.service';
import { Ticket, LigneVente } from '../../../core/models/supermarche.models';
import { TicketDetailModalComponent } from '../../../shared/components/ticket-detail-modal/ticket-detail-modal.component';

interface MoisOption { label: string; year: number; month: number; }

@Component({
  selector: 'app-historique',
  standalone: true,
  imports: [CommonModule, FormsModule, MatPaginatorModule, MatTabsModule],
  template: `
    <div class="container-fluid py-3">
      <div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <div>
          <h4 class="fw-bold mb-0">Historique des ventes</h4>
          <small class="text-muted">{{ labelPeriode }}</small>
        </div>
        <button class="btn btn-outline-secondary btn-sm">
          <i class="fa-solid fa-file-export me-1"></i> Exporter
        </button>
      </div>

      <!-- Sélecteur période -->
      <div class="d-flex gap-2 mb-3 flex-wrap">
        @for (m of moisDisponibles; track m.label) {
          <button class="btn btn-sm {{ moisActif === m.label ? 'btn-success' : 'btn-outline-secondary' }}"
                  (click)="chargerMois(m)">
            {{ m.label }}
          </button>
        }
      </div>

      <!-- Métriques -->
      <div class="row g-3 mb-3">
        <div class="col-6 col-md-3">
          <div class="card bg-light text-center py-2">
            <div class="text-muted small">Chiffre d'affaires</div>
            <div class="fw-bold fs-5">{{ ca() | number }} F</div>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="card bg-light text-center py-2">
            <div class="text-muted small">Tickets</div>
            <div class="fw-bold fs-5">{{ tickets().length }}</div>
            <small class="text-muted">dont {{ nbGrossiste() }} grossistes</small>
          </div>
        </div>
        <!-- Bénéfice : Admin uniquement -->
        @if (auth.isAdmin()) {
          <div class="col-6 col-md-3">
            <div class="card bg-light text-center py-2">
              <div class="text-muted small">Coût d'achat</div>
              <div class="fw-bold fs-5">{{ coutAchat() | number }} F</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="card text-center py-2"
                 style="background:#E1F5EE;border-color:#5DCAA5">
              <div class="text-muted small">Bénéfice brut</div>
              <div class="fw-bold fs-5 text-success">{{ benefice() | number }} F</div>
              <small class="text-success">{{ margePct() }}%</small>
            </div>
          </div>
        }
      </div>

      <!-- Répartition canal (toujours visible) -->
      <div class="card mb-3 p-3">
        <div class="small fw-semibold text-uppercase text-muted mb-2">Répartition canal</div>
        <div class="progress mb-2" style="height:10px">
          <div class="progress-bar bg-success" [style.width.%]="pctDetail()"></div>
          <div class="progress-bar bg-info"    [style.width.%]="pctGros()"></div>
        </div>
        <div class="d-flex gap-3 flex-wrap small">
          <span><span class="badge bg-success me-1"></span>Détail {{ pctDetail() }}%</span>
          <span><span class="badge bg-info me-1"></span>Grossiste {{ pctGros() }}%</span>
        </div>
      </div>

      <!-- Onglets : Par ticket / Par article -->
      <mat-tab-group>

        <!-- ── Onglet : Par ticket ── -->
        <mat-tab label="Par ticket">
          <div class="pt-3">
            <!-- Filtre -->
            <div class="d-flex gap-2 mb-2">
              <select class="form-select form-select-sm" style="max-width:160px"
                      [(ngModel)]="filtreType">
                <option value="">Tous les types</option>
                <option value="DETAIL">Détail</option>
                <option value="GROSSISTE">Grossiste</option>
              </select>
            </div>

            <div class="table-responsive rounded border">
              <table class="table table-hover table-sm align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Ticket</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Articles</th>
                    <th>Montant</th>
                    <th>Caissier</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (t of ticketsPagines(); track t.id_ticket) {
                    <tr>
                      <td><code class="small">{{ t.id_ticket }}</code></td>
                      <td class="small">{{ t.date_heure | date:'dd/MM HH:mm' }}</td>
                      <td>
                        <span class="badge {{ t.type_vente === 'GROSSISTE' ? 'bg-info text-dark' : 'bg-secondary' }}">
                          {{ t.type_vente }}
                        </span>
                      </td>
                      <td class="small text-muted">{{ nbLignes(t.id_ticket) }} art.</td>
                      <td class="fw-semibold small">{{ t.montant_total | number }} F</td>
                      <td class="small text-muted">{{ t.nom_caissier }}</td>
                      <td>
                        <button class="btn btn-sm btn-outline-secondary px-2"
                                (click)="voirTicket(t)">
                          <i class="fa-solid fa-eye"></i>
                        </button>
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="7" class="text-center text-muted py-3">
                        Aucun ticket trouvé
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <mat-paginator [length]="ticketsFiltres().length"
                           [pageSize]="pageSize"
                           [pageSizeOptions]="[10,20,50]"
                           (page)="onPageTicket($event)" showFirstLastButtons>
            </mat-paginator>
          </div>
        </mat-tab>

        <!-- ── Onglet : Par article ── -->
        <mat-tab label="Par article">
          <div class="pt-3">
            <div class="table-responsive rounded border">
              <table class="table table-hover table-sm align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Article</th>
                    <th>Code</th>
                    <th>Qté vendue</th>
                    <th>CA</th>
                    @if (auth.isAdmin()) {
                      <th>Coût</th>
                      <th>Bénéfice</th>
                    }
                    <th>Canal</th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of statsArticles(); track r.code) {
                    <tr>
                      <td class="fw-semibold small">{{ r.nom }}</td>
                      <td><code class="small">{{ r.code }}</code></td>
                      <td>{{ r.qte | number }}</td>
                      <td class="fw-semibold small">{{ r.ca | number }} F</td>
                      @if (auth.isAdmin()) {
                        <td class="text-muted small">{{ r.cout | number }} F</td>
                        <td class="text-success fw-semibold small">{{ r.benefice | number }} F</td>
                      }
                      <td>
                        <span class="badge {{ r.gros > 0 ? 'bg-info text-dark' : 'bg-secondary' }}">
                          {{ r.gros > 0 ? 'Mixte' : 'Détail' }}
                        </span>
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="7" class="text-center text-muted py-3">
                        Aucune vente sur cette période
                      </td>
                    </tr>
                  }
                </tbody>
                <!-- Totaux -->
                @if (statsArticles().length) {
                  <tfoot class="table-light fw-semibold">
                    <tr>
                      <td colspan="2">Total</td>
                      <td>{{ totalQte() | number }}</td>
                      <td>{{ ca() | number }} F</td>
                      @if (auth.isAdmin()) {
                        <td>{{ coutAchat() | number }} F</td>
                        <td class="text-success">{{ benefice() | number }} F</td>
                      }
                      <td></td>
                    </tr>
                  </tfoot>
                }
              </table>
            </div>
          </div>
        </mat-tab>

      </mat-tab-group>
    </div>
  `,
})
export class HistoriqueComponent {
  protected auth  = inject(AuthService);
  private cache   = inject(CacheService);
  private data$   = inject(DataService);
  private dialog  = inject(MatDialog);

  filtreType = '';
  pageTicket = 0;
  pageSize   = 10;

  // Mois disponibles : mois courant + 4 précédents
  moisDisponibles: MoisOption[] = this.buildMois();
  moisActif = this.moisDisponibles[0].label;

  private _tickets = signal<Ticket[]>([]);
  private _lignes  = signal<LigneVente[]>([]);

  // Charge les données du mois sélectionné
  async chargerMois(m: MoisOption): Promise<void> {
    this.moisActif = m.label;
    const now = new Date();
    if (m.year === now.getFullYear() && m.month === now.getMonth() + 1) {
      // Mois courant → depuis le cache
      this._tickets.set(this.cache.getTickets());
      this._lignes.set(this.cache.getLignes());
    } else {
      const res = await this.data$.loadMonth(m.year, m.month);
      this._tickets.set(res.tickets);
      this._lignes.set(res.lignes);
    }
    this.pageTicket = 0;
  }

  // Initialisation avec le mois courant
  ngOnInit() {
    this._tickets.set(this.cache.getTickets());
    this._lignes.set(this.cache.getLignes());
  }

  get labelPeriode(): string { return this.moisActif; }

  tickets = computed(() => this._tickets());

  ticketsFiltres = computed(() =>
    this._tickets().filter(t => !this.filtreType || t.type_vente === this.filtreType)
  );

  ticketsPagines = computed(() =>
    this.ticketsFiltres().slice(
      this.pageTicket * this.pageSize,
      (this.pageTicket + 1) * this.pageSize
    )
  );

  onPageTicket(e: PageEvent) {
    this.pageTicket = e.pageIndex;
    this.pageSize   = e.pageSize;
  }

  nbLignes(idTicket: string): number {
    return this._lignes().filter(l => l.id_ticket === idTicket).length;
  }

  nbGrossiste = computed(() =>
    this._tickets().filter(t => t.type_vente === 'GROSSISTE').length
  );

  // ── Statistiques ────────────────────────────────────────────────

  ca = computed(() => this._tickets().reduce((s, t) => s + +t.montant_total, 0));

  coutAchat = computed(() => {
    const arts = new Map(this.cache.getArticles().map(a => [a.code_article, a.prix_achat]));
    return this._lignes().reduce((s, l) => s + (+l.quantite * (arts.get(l.code_article) ?? 0)), 0);
  });

  benefice  = computed(() => this.ca() - this.coutAchat());
  margePct  = computed(() => this.ca() ? Math.round(this.benefice() / this.ca() * 1000) / 10 : 0);

  pctDetail = computed(() => {
    const tot = this.ca() || 1;
    const det = this._tickets()
      .filter(t => t.type_vente === 'DETAIL')
      .reduce((s, t) => s + +t.montant_total, 0);
    return Math.round(det / tot * 100);
  });

  pctGros = computed(() => 100 - this.pctDetail());

  totalQte = computed(() => this._lignes().reduce((s, l) => s + +l.quantite, 0));

  statsArticles = computed(() => {
    const arts   = new Map(this.cache.getArticles().map(a => [a.code_article, a]));
    const totals = new Map<string, { nom:string; qte:number; ca:number; cout:number; gros:number }>();

    for (const l of this._lignes()) {
      const art = arts.get(l.code_article);
      const cur = totals.get(l.code_article) ?? {
        nom: l.nom_article, qte: 0, ca: 0, cout: 0, gros: 0,
      };
      cur.qte += +l.quantite;
      cur.ca  += +l.sous_total;
      cur.cout += +l.quantite * (art?.prix_achat ?? 0);
      if (l.tarif_applique === 'GROSSISTE') cur.gros += +l.quantite;
      totals.set(l.code_article, cur);
    }

    return Array.from(totals.entries())
      .map(([code, v]) => ({ code, ...v, benefice: v.ca - v.cout }))
      .sort((a, b) => b.ca - a.ca);
  });

  voirTicket(ticket: Ticket): void {
    const lignes = this._lignes().filter(l => l.id_ticket === ticket.id_ticket);
    this.dialog.open(TicketDetailModalComponent, {
      width: '420px', maxWidth: '98vw',
      data: { ticket, lignes },
      panelClass: 'mat-dialog-no-padding',
    });
  }

  private buildMois(): MoisOption[] {
    const result: MoisOption[] = [];
    const now = new Date();
    for (let i = 0; i < 5; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      result.push({
        label: d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
        year:  d.getFullYear(),
        month: d.getMonth() + 1,
      });
    }
    return result;
  }
}
