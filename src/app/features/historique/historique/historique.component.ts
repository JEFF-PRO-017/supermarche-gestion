import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CacheService } from '../../../core/services/cache.service';
import { DataService } from '../../../core/services/data.service';
import { AuthService } from '../../../core/services/auth.service';
import { Ticket, LigneVente, MouvementStock } from '../../../core/models/supermarche.models';
import { TicketDetailModalComponent } from '../../../shared/components/ticket-detail-modal/ticket-detail-modal.component';
import { ModalService } from '@shared/components/modal.service';
import { FilterBarComponent, FilterBarState, FilterBarConfig } from '@shared/FilterBarComponent';
import { PaginationComponent } from '@shared/PaginationComponent';

interface MoisOption { label: string; year: number; month: number; jour?: number; }

@Component({
  selector: 'app-historique',
  standalone: true,
  imports: [CommonModule, FilterBarComponent, PaginationComponent],
  template: `
    <div class="container-fluid py-3">

      <!-- Topbar -->
      <div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <div>
          <h4 class="fw-bold mb-0">Historique des ventes</h4>
          <small class="text-muted">{{ moisActif }}</small>
        </div>
        <button class="btn btn-outline-secondary btn-sm">
          <i class="fa-solid fa-file-export me-1"></i>Exporter
        </button>
      </div>

      <!-- Sélecteur période -->
      <div class="d-flex gap-2 mb-3 flex-wrap">
        <button class="btn btn-sm"
                [class]="moisActif === periodeAujourdhui.label ? 'btn-warning' : 'btn-outline-warning'"
                (click)="chargerMois(periodeAujourdhui)"
                [disabled]="loading()">
          <i class="fa-solid fa-calendar-day me-1"></i>Aujourd'hui
        </button>
        @for (m of moisDisponibles; track m.label) {
          <button class="btn btn-sm"
                  [class]="moisActif === m.label ? 'btn-success' : 'btn-outline-secondary'"
                  (click)="chargerMois(m)"
                  [disabled]="loading()">
            {{ m.label }}
          </button>
        }
      </div>

      <!-- ── LOADING ── -->
      @if (loading()) {
        <div class="d-flex align-items-center justify-content-center py-5 text-muted gap-2">
          <div class="spinner-border spinner-border-sm text-success"></div>
          <span>Chargement de la période...</span>
        </div>
      }

      @if (!loading()) {

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
          @if (auth.isAdmin()) {
            <div class="col-6 col-md-3">
              <div class="card bg-light text-center py-2">
                <div class="text-muted small">Coût d'achat</div>
                <div class="fw-bold fs-5">{{ coutAchat() | number }} F</div>
              </div>
            </div>
            <div class="col-6 col-md-3">
              <div class="card text-center py-2" style="background:#E1F5EE;border-color:#5DCAA5">
                <div class="text-muted small">Bénéfice brut</div>
                <div class="fw-bold fs-5 text-success">{{ benefice() | number }} F</div>
                <small class="text-success">{{ margePct() }}%</small>
              </div>
            </div>
          }
        </div>

        <!-- Répartition canal -->
        <div class="card mb-3 p-3">
          <div class="small fw-semibold text-uppercase text-muted mb-2">Répartition canal</div>
          <div class="progress mb-2" style="height:10px">
            <div class="progress-bar bg-success" [style.width.%]="pctDetail()"></div>
            <div class="progress-bar bg-info"    [style.width.%]="pctGros()"></div>
          </div>
          <div class="d-flex gap-3 flex-wrap small">
            <span><span class="badge bg-success me-1">&nbsp;</span>Détail {{ pctDetail() }}%</span>
            <span><span class="badge bg-info me-1">&nbsp;</span>Grossiste {{ pctGros() }}%</span>
          </div>
        </div>

        <!-- Onglets -->
        <ul class="nav nav-tabs mb-3">
          <li class="nav-item">
            <button class="nav-link" [class.active]="onglet === 'tickets'" (click)="onglet = 'tickets'">
              <i class="fa-solid fa-receipt me-1"></i>Par ticket
            </button>
          </li>
          <li class="nav-item">
            <button class="nav-link" [class.active]="onglet === 'articles'" (click)="onglet = 'articles'">
              <i class="fa-solid fa-box me-1"></i>Par article
            </button>
          </li>
          <li class="nav-item">
            <button class="nav-link" [class.active]="onglet === 'mouvements'" (click)="onglet = 'mouvements'">
              <i class="fa-solid fa-exchange-alt me-1"></i>Mouvements
            </button>
          </li>
        </ul>

        <!-- ── Onglet tickets ── -->
        @if (onglet === 'tickets') {
          <app-filter-bar
            [config]="filterConfigTickets"
            [totalAll]="tickets().length"
            [totalFiltered]="ticketsFiltres().length"
            [pageSize]="pag().pageSize"
            [pageSizeOptions]="[5, 10, 20, 50]"
            (filterChange)="onFilter($event)"
            (pageSizeChange)="onPageSize($event)"
          />
          <div class="table-responsive rounded border">
            <table class="table table-hover table-sm align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th>Ticket</th><th>Date</th><th>Type</th>
                  <th>Articles</th><th>Montant</th><th>Caissier</th><th></th>
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
                      <button class="btn btn-sm btn-outline-secondary px-2" (click)="voirTicket(t)">
                        <i class="fa-solid fa-eye"></i>
                      </button>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="7" class="text-center text-muted py-3">Aucun ticket trouvé</td></tr>
                }
              </tbody>
              @if (ticketsFiltres().length) {
                <tfoot class="table-light fw-semibold">
                  <tr>
                    <td colspan="3">Total période</td><td></td>
                    <td>{{ ca() | number }} F</td><td colspan="2"></td>
                  </tr>
                </tfoot>
              }
            </table>
          </div>
          <app-pagination [page]="pag().page" [total]="ticketsFiltres().length"
            [pageSize]="pag().pageSize" (pageChange)="onPageTicket($event)" />
        }

        <!-- ── Onglet articles ── -->
        @if (onglet === 'articles') {
          <app-filter-bar
            [config]="filterConfigArticles"
            [totalAll]="statsArticles().length"
            [totalFiltered]="statsArticlesFiltres().length"
            [pageSize]="pagArt().pageSize"
            [pageSizeOptions]="[5, 10, 20, 50]"
            (filterChange)="onFilterArt($event)"
            (pageSizeChange)="onPageSizeArt($event)"
          />
          <div class="table-responsive rounded border">
            <table class="table table-hover table-sm align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th>Article</th><th>Code</th><th>Qté vendue</th><th>CA</th>
                  @if (auth.isAdmin()) { <th>Coût</th><th>Bénéfice</th> }
                  <th>Canal</th>
                </tr>
              </thead>
              <tbody>
                @for (r of statsArticlesPagines(); track r.code) {
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
                  <tr><td colspan="7" class="text-center text-muted py-3">Aucune vente sur cette période</td></tr>
                }
              </tbody>
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
          <app-pagination [page]="pagArt().page" [total]="statsArticlesFiltres().length"
            [pageSize]="pagArt().pageSize" (pageChange)="onPageArt($event)" />
        }

        <!-- ── Onglet mouvements ── -->
        @if (onglet === 'mouvements') {
          <app-filter-bar
            [config]="filterConfigMouvements"
            [totalAll]="mouvements().length"
            [totalFiltered]="mouvementsFiltres().length"
            [pageSize]="pagMouv().pageSize"
            [pageSizeOptions]="[5, 10, 20, 50]"
            (filterChange)="onFilterMouvement($event)"
            (pageSizeChange)="onPageSizeMouvement($event)"
          />
          <div class="table-responsive rounded border">
            <table class="table table-hover table-sm align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th>N° Mouvement</th><th>Date</th><th>Article</th>
                  <th>Type</th><th>Quantité</th>
                </tr>
              </thead>
              <tbody>
                @for (m of mouvementsPagines(); track m.id) {
                  <tr>
                    <td><code class="small">{{ m.id }}</code></td>
                    <td class="small">{{ m.date | date:'dd/MM HH:mm' }}</td>
                    <!-- BUG 3 corrigé : on résout le nom via le cache articles -->
                    <td class="small">{{ nomArticle(m.code_article) }}</td>
                    <td>
                      <span class="badge {{ m.type_mouvement === 'ENTREE' ? 'bg-success' : 'bg-secondary' }}">
                        {{ m.type_mouvement }}
                      </span>
                    </td>
                    <td class="small">{{ m.quantite }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="5" class="text-center text-muted py-3">Aucun mouvement sur cette période</td></tr>
                }
              </tbody>
            </table>
          </div>
          <!-- BUG 4 corrigé : pageChange → onPageMouvement, pageSizeChange → onPageSizeMouvement -->
          <app-pagination [page]="pagMouv().page" [total]="mouvementsFiltres().length"
            [pageSize]="pagMouv().pageSize" (pageChange)="onPageMouvement($event)" />
        }

      }<!-- fin @if(!loading) -->

    </div>
  `,
  styles: `
    .nav-tabs .nav-link { font-size: 0.9rem; }
    .table thead th { vertical-align: middle; }
  `
})
export class HistoriqueComponent implements OnInit {
  private cache = inject(CacheService);
  private data$ = inject(DataService);
  auth = inject(AuthService);
  dialog = inject(ModalService);

  onglet: 'tickets' | 'articles' | 'mouvements' = 'tickets';

  // ── Loading ───────────────────────────────────────────────────────────────
  loading = signal(false); // true pendant le chargement d'une période

  // ── Pagination ────────────────────────────────────────────────────────────
  pag = signal({ page: 0, pageSize: 10 });
  pagArt = signal({ page: 0, pageSize: 10 });
  pagMouv = signal({ page: 0, pageSize: 10 });

  // ── Filtres séparés par onglet ─────────────────────────────────────────────
  // BUG 1 corrigé : chaque onglet a son propre signal de filtre
  private filterTickets = signal<FilterBarState>({ search: '', select: '' });
  private filterArt = signal<FilterBarState>({ search: '', select: '' });
  private filterMouvements = signal<FilterBarState>({ search: '', select: '' });

  // ── Données brutes ────────────────────────────────────────────────────────
  private _tickets = signal<Ticket[]>([]);
  private _lignes = signal<LigneVente[]>([]);
  private _mouvements = signal<MouvementStock[]>([]);

  // ── Période Aujourd'hui ───────────────────────────────────────────────────
  readonly periodeAujourdhui: MoisOption = (() => {
    const now = new Date();
    return {
      label: "Aujourd'hui · " + now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' }),
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      jour: now.getDate(),
    };
  })();

  moisDisponibles: MoisOption[] = this.buildMois();
  moisActif = this.periodeAujourdhui.label;

  // ── Configs filtres ───────────────────────────────────────────────────────
  readonly filterConfigTickets: FilterBarConfig = {
    searchPlaceholder: 'N° ticket ou caissier...',
    selectOptions: [
      { value: 'DETAIL', label: 'Détail', icon: 'fa-user' },
      { value: 'GROSSISTE', label: 'Grossiste', icon: 'fa-truck' },
    ],
    selectPlaceholder: 'Tous',
  };

  readonly filterConfigArticles: FilterBarConfig = {
    searchPlaceholder: 'Nom ou code article...',
    selectOptions: [
      { value: 'Mixte', label: 'Mixte', icon: 'fa-shuffle' },
      { value: 'Detail', label: 'Détail', icon: 'fa-user' },
    ],
    selectPlaceholder: 'Tous',
  };

  readonly filterConfigMouvements: FilterBarConfig = {
    searchPlaceholder: 'N° mouvement ou article...',
    selectOptions: [
      { value: 'ENTREE', label: 'Entrée', icon: 'fa-arrow-down' },
      { value: 'SORTIE', label: 'Sortie', icon: 'fa-arrow-up' },
    ],
    selectPlaceholder: 'Tous',
  };

  // ── Cycle de vie ──────────────────────────────────────────────────────────
  ngOnInit(): void { this.chargerMois(this.periodeAujourdhui); }

  // ── Chargement période ────────────────────────────────────────────────────
  async chargerMois(m: MoisOption): Promise<void> {
    this.moisActif = m.label;
    this.loading.set(true); // affiche le spinner
    this.pag.set({ page: 0, pageSize: this.pag().pageSize });
    this.pagArt.set({ page: 0, pageSize: this.pagArt().pageSize });
    this.pagMouv.set({ page: 0, pageSize: this.pagMouv().pageSize });

    try {
      const now = new Date();
      const estMoisCourant = m.year === now.getFullYear() && m.month === now.getMonth() + 1;

      if (estMoisCourant) {
        let tickets = this.cache.getTickets();
        let lignes = this.cache.getLignes();
        let mouvements = this.cache.getMouvements();

        // Filtre "Aujourd'hui" si un jour précis est demandé
        if (m.jour) {
          const dateStr = `${m.year}-${String(m.month).padStart(2, '0')}-${String(m.jour).padStart(2, '0')}`;
          tickets = tickets.filter(t => t.date_heure.startsWith(dateStr));
          const ids = new Set(tickets.map(t => t.id_ticket));
          lignes = lignes.filter(l => ids.has(l.id_ticket));
          mouvements = mouvements.filter(mv => mv.date.startsWith(dateStr));
        }

        this._tickets.set(tickets);
        this._lignes.set(lignes);
        this._mouvements.set(mouvements);

      } else {
        const res = await this.data$.loadMonth(m.year, m.month);
        this._tickets.set(res.tickets);
        this._lignes.set(res.lignes);
        this._mouvements.set(res.mouvements); 
      }
    } catch (error:any) {
      console.error('Erreur chargement période', error?.message);
      this._tickets.set([]);
      this._lignes.set([]);
      this._mouvements.set([]); 
    }
    finally {
      this.loading.set(false); // cache le spinner dans tous les cas
    }
  }

  // ── Handlers pagination / filtre ──────────────────────────────────────────
  // BUG 1 corrigé : chaque onglet écrit dans son propre signal de filtre
  onFilter(s: FilterBarState) { this.filterTickets.set(s); this.pag.update(p => ({ ...p, page: 0 })); }
  onPageSize(size: number) { this.pag.set({ page: 0, pageSize: size }); }
  onPageTicket(page: number) { this.pag.update(p => ({ ...p, page })); }

  onFilterArt(s: FilterBarState) { this.filterArt.set(s); this.pagArt.update(p => ({ ...p, page: 0 })); }
  onPageSizeArt(size: number) { this.pagArt.set({ page: 0, pageSize: size }); }
  onPageArt(page: number) { this.pagArt.update(p => ({ ...p, page })); }

  // BUG 1 et 4 corrigés : filtre et pagination mouvements bien séparés
  onFilterMouvement(s: FilterBarState) { this.filterMouvements.set(s); this.pagMouv.update(p => ({ ...p, page: 0 })); }
  onPageSizeMouvement(size: number) { this.pagMouv.set({ page: 0, pageSize: size }); }
  onPageMouvement(page: number) { this.pagMouv.update(p => ({ ...p, page })); }

  // ── Computeds tickets ─────────────────────────────────────────────────────
  tickets = computed(() => this._tickets());

  ticketsFiltres = computed(() => {
    const { search, select } = this.filterTickets();
    const q = search.toLowerCase();
    return this._tickets().filter(t => {
      const matchQ = !q || t.id_ticket.toLowerCase().includes(q) || t.nom_caissier.toLowerCase().includes(q);
      const matchS = !select || t.type_vente === select;
      return matchQ && matchS;
    });
  });

  ticketsPagines = computed(() => {
    const { page, pageSize } = this.pag();
    return this.ticketsFiltres().slice(page * pageSize, (page + 1) * pageSize);
  });

  // ── Computeds articles ────────────────────────────────────────────────────
  statsArticles = computed(() => {
    const arts = new Map(this.cache.getArticles().map(a => [a.code_article, a]));
    const totals = new Map<string, { nom: string; qte: number; ca: number; cout: number; gros: number }>();
    for (const l of this._lignes()) {
      const art = arts.get(l.code_article);
      const cur = totals.get(l.code_article) ?? { nom: l.nom_article, qte: 0, ca: 0, cout: 0, gros: 0 };
      cur.qte += +l.quantite;
      cur.ca += +l.sous_total;
      cur.cout += +l.quantite * (art?.prix_achat ?? 0);
      if (l.tarif_applique === 'GROSSISTE') cur.gros += +l.quantite;
      totals.set(l.code_article, cur);
    }
    return Array.from(totals.entries())
      .map(([code, v]) => ({ code, ...v, benefice: v.ca - v.cout }))
      .sort((a, b) => b.ca - a.ca);
  });

  statsArticlesFiltres = computed(() => {
    const { search, select } = this.filterArt();
    const q = search.toLowerCase();
    return this.statsArticles().filter(r => {
      const matchQ = !q || r.nom.toLowerCase().includes(q) || r.code.toLowerCase().includes(q);
      const canal = r.gros > 0 ? 'Mixte' : 'Detail';
      const matchS = !select || canal === select;
      return matchQ && matchS;
    });
  });

  statsArticlesPagines = computed(() => {
    const { page, pageSize } = this.pagArt();
    return this.statsArticlesFiltres().slice(page * pageSize, (page + 1) * pageSize);
  });

  // ── Computeds mouvements ──────────────────────────────────────────────────
  mouvements = computed(() => this._mouvements());

  mouvementsFiltres = computed(() => {
    // BUG 1 corrigé : utilise filterMouvements et non filterTickets
    const { search, select } = this.filterMouvements();
    const q = search.toLowerCase();
    return this._mouvements().filter(m => {
      const matchQ = !q || m.code_article.toLowerCase().includes(q) || m.reference.toLowerCase().includes(q);
      // Filtre par type : ENTREE ou SORTIE (SORTIE_VENTE contient "SORTIE")
      const matchS = !select || m.type_mouvement.includes(select);
      return matchQ && matchS;
    });
  });

  mouvementsPagines = computed(() => {
    const { page, pageSize } = this.pagMouv();
    return this.mouvementsFiltres().slice(page * pageSize, (page + 1) * pageSize);
  });

  // ── Métriques ─────────────────────────────────────────────────────────────
  nbLignes(id: string) { return this._lignes().filter(l => l.id_ticket === id).length; }
  nbGrossiste = computed(() => this._tickets().filter(t => t.type_vente === 'GROSSISTE').length);
  ca = computed(() => this._tickets().reduce((s, t) => s + +t.montant_total, 0));
  totalQte = computed(() => this._lignes().reduce((s, l) => s + +l.quantite, 0));
  coutAchat = computed(() => {
    const arts = new Map(this.cache.getArticles().map(a => [a.code_article, a.prix_achat]));
    return this._lignes().reduce((s, l) => s + (+l.quantite * (arts.get(l.code_article) ?? 0)), 0);
  });
  benefice = computed(() => this.ca() - this.coutAchat());
  margePct = computed(() => this.ca() ? Math.round(this.benefice() / this.ca() * 1000) / 10 : 0);
  pctDetail = computed(() => {
    const tot = this.ca() || 1;
    const det = this._tickets().filter(t => t.type_vente === 'DETAIL').reduce((s, t) => s + +t.montant_total, 0);
    return Math.round(det / tot * 100);
  });
  pctGros = computed(() => 100 - this.pctDetail());

  // BUG 3 corrigé : résout le nom via le cache au lieu de m.article?.nom (champ inexistant)
  nomArticle(code: string): string {
    return this.cache.getArticles().find(a => a.code_article === code)?.nom ?? code;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  voirTicket(ticket: Ticket): void {
    const lignes = this._lignes().filter(l => l.id_ticket === ticket.id_ticket);
    this.dialog.open(TicketDetailModalComponent, { ticket, lignes });
  }

  private buildMois(): MoisOption[] {
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1);
      return {
        label: d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
        year: d.getFullYear(),
        month: d.getMonth() + 1,
      };
    });
  }
}


