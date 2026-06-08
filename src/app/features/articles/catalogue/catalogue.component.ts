// catalogue.component.ts
import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CacheService } from '../../../core/services/cache.service';
import { DataService } from '../../../core/services/data.service';
import { AuthService } from '../../../core/services/auth.service';
import { Article } from '../../../core/models/supermarche.models';
import { ArticleFormModalComponent } from '../article-form-modal/article-form-modal.component';
import { ReapproModalComponent } from '../../../shared/components/reapprovisionnement-modal/reapprovisionnement-modal.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { ModalService } from '@shared/components/modal.service';
import { FilterBarComponent, FilterBarState, FilterBarConfig } from '@shared/FilterBarComponent';
import { PaginationComponent } from '@shared/PaginationComponent';
import { downloadBarcodeSVG, downloadAllBarcodesWord } from '../../../core/services/ScanService';

@Component({
  selector: 'app-catalogue',
  standalone: true,
  imports: [CommonModule, RouterLink, FilterBarComponent, PaginationComponent],
  template: `
    <div>

      <!-- Topbar -->
      <div class="sm-topbar">
        <div>
          <h2 class="sm-page-title">Articles</h2>
          <p class="sm-page-sub">
            {{ cache.getArticles().length }} articles
            @if (cache.alertes().length) {
              · <span class="text-danger">{{ cache.alertes().length }} en alerte</span>
            }
          </p>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-secondary"
                  title="Exporter tous les codes-barres Word"
                  [disabled]="exportingWord()"
                  (click)="telechargerTousWord()">
            @if (exportingWord()) {
              <span class="spinner-border spinner-border-sm me-1"></span>
            } @else {
              <i class="fa-solid fa-file-word me-1"></i>
            }
            Export Word
          </button>
          @if (auth.isGerant()) {
            <a routerLink="/articles/nouveau" class="btn btn-sm btn-primary" title="Créer un nouvel article">
              <i class="fa-solid fa-plus me-1"></i>Nouveau
            </a>
          }
        </div>
      </div>

      <!-- Alerte stock -->
      @if (cache.alertes().length) {
        <div class="alert alert-danger py-2 mb-3" role="alert">
          <i class="fa-solid fa-triangle-exclamation me-2"></i>
          <strong>{{ cache.alertes().length }} article(s) nécessitent un réapprovisionnement</strong>
        </div>
      }

      <!-- Filtre -->
      <app-filter-bar
        [config]="filterConfig"
        [totalAll]="cache.getArticles().length"
        [totalFiltered]="articlesFiltres().length"
        [pageSize]="pag().pageSize"
        [pageSizeOptions]="[5,10, 20, 50]"
        (filterChange)="onFilter($event)"
        (pageSizeChange)="onPageSize($event)"
      />

      <!-- Tableau -->
      <div class="table-responsive sm-card-flush mb-0">
        <table class="table table-hover table-sm align-middle mb-0 sm-table">
          <thead class="table-light">
            <tr>
              <th>Article</th>
              <th>Prix det.</th>
              <th>Prix gros</th>
              <th>Stock</th>
              <th class="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (a of articlesPagines(); track a.code_article) {
              <tr [class]="niveauAlerte(a) === 'CRITIQUE' ? 'table-danger'
                          : niveauAlerte(a) === 'FAIBLE'  ? 'table-warning' : ''">
                <td>
                  <div class="d-flex align-items-center gap-2">
                    <div class="sm-avatar" [style.background]="couleur(a).bg" [style.color]="couleur(a).tc">
                      {{ a.nom.substring(0,2).toUpperCase() }}
                    </div>
                    <div>
                      <div class="fw-medium small">{{ a.nom }}</div>
                      <span class="badge {{ badgeClass(a) }}" style="font-size:10px">{{ badgeLabel(a) }}</span>
                    </div>
                  </div>
                </td>
                <td class="small text-nowrap">{{ a.prix_detail | number }} F</td>
                <td class="small text-nowrap text-primary">{{ a.prix_grossiste | number }} F</td>
                <td>
                  <div class="d-flex align-items-center gap-1">
                    <div class="progress" style="width:48px;height:5px">
                      <div class="progress-bar"
                           [class]="niveauAlerte(a) === 'CRITIQUE' ? 'bg-danger'
                                  : niveauAlerte(a) === 'FAIBLE'   ? 'bg-warning' : 'bg-primary'"
                           [style.width.%]="stockPct(a)">
                      </div>
                    </div>
                    <small [class]="niveauAlerte(a) === 'CRITIQUE' ? 'text-danger'
                                  : niveauAlerte(a) === 'FAIBLE'   ? 'text-warning' : 'text-muted'">
                      {{ a.stock_actuel }}
                    </small>
                  </div>
                </td>
                <td class="text-center">
                  <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-dark btn-sm"
                            title="Télécharger code-barres SVG"
                            (click)="telechargerBarcode(a)">
                      <i class="fa-solid fa-barcode"></i>
                    </button>
                    @if (auth.isGerant()) {
                      <button class="btn btn-outline-primary btn-sm" title="Réapprovisionner" (click)="ouvrirReappro(a)">
                        <i class="fa-solid fa-arrow-up"></i>
                      </button>
                      <button class="btn btn-outline-secondary btn-sm" title="Modifier" (click)="ouvrirFormulaire(a)">
                        <i class="fa-solid fa-pen"></i>
                      </button>
                    }
                    @if (auth.isAdmin()) {
                      <button class="btn btn-outline-danger btn-sm" title="Supprimer" (click)="supprimer(a)">
                        <i class="fa-solid fa-trash"></i>
                      </button>
                    }
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="text-center py-4 text-muted">
                  <i class="fa-solid fa-box-open fa-lg d-block mb-2 opacity-50"></i>
                  Aucun article trouvé
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <app-pagination
        [page]="pag().page"
        [total]="articlesFiltres().length"
        [pageSize]="pag().pageSize"
        (pageChange)="onPage($event)"
      />

    </div>
  `
})
export class CatalogueComponent {
  protected cache = inject(CacheService);
  protected data$ = inject(DataService);
  protected auth  = inject(AuthService);
  private modal   = inject(ModalService);

  pag           = signal({ page: 0, pageSize: 10 });
  exportingWord = signal(false);
  private filter = signal<FilterBarState>({ search: '', select: '' });

  readonly filterConfig: FilterBarConfig = {
    searchPlaceholder: 'Code ou nom...',
    selectOptions: [
      { value: 'alerte', label: 'En alerte',  icon: 'fa-triangle-exclamation' },
      { value: 'ok',     label: 'Stock OK',   icon: 'fa-circle-check' },
    ],
    selectPlaceholder: 'Tous',
  };

  onPage(page: number)     { this.pag.update(p => ({ ...p, page })); }
  onPageSize(size: number) { this.pag.set({ page: 0, pageSize: size }); }
  onFilter(state: FilterBarState) {
    this.filter.set(state);
    this.pag.update(p => ({ ...p, page: 0 }));
  }

  articlesFiltres = computed(() => {
    const { search, select } = this.filter();
    const q = search.toLowerCase();
    return this.cache.getArticles().filter(a => {
      const matchQ = !q || a.nom.toLowerCase().includes(q) || a.code_article.toLowerCase().includes(q);
      const matchS = !select
        || (select === 'alerte' && !!this.niveauAlerte(a))
        || (select === 'ok'    && !this.niveauAlerte(a));
      return matchQ && matchS;
    });
  });

  articlesPagines = computed(() => {
    const { page, pageSize } = this.pag();
    return this.articlesFiltres().slice(page * pageSize, (page + 1) * pageSize);
  });

  // ── Codes-barres ────────────────────────────────────────────────────────────

  telechargerBarcode(article: Article): void {
    downloadBarcodeSVG(article);
  }

  async telechargerTousWord(): Promise<void> {
    this.exportingWord.set(true);
    try {
      await downloadAllBarcodesWord(this.articlesPagines());
    } finally {
      this.exportingWord.set(false);
    }
  }

  // ── Helpers affichage ───────────────────────────────────────────────────────

  niveauAlerte(a: Article): 'CRITIQUE' | 'FAIBLE' | null {
    if (a.stock_actuel <= a.seuil_alerte)        return 'CRITIQUE';
    if (a.stock_actuel <= a.seuil_alerte * 1.5)  return 'FAIBLE';
    return null;
  }

  stockPct(a: Article) {
    return Math.min(100, Math.round(a.stock_actuel / (a.seuil_alerte * 8) * 100));
  }

  badgeClass(a: Article) {
    const n = this.niveauAlerte(a);
    return n === 'CRITIQUE' ? 'bg-danger' : n === 'FAIBLE' ? 'bg-warning text-dark' : 'bg-success';
  }

  badgeLabel(a: Article) {
    const n = this.niveauAlerte(a);
    return n === 'CRITIQUE' ? 'Rupture imminente' : n === 'FAIBLE' ? 'Stock faible' : 'En stock';
  }

  private PALETTES = [
    { bg: '#E1F5EE', tc: '#0F6E56' }, { bg: '#FAECE7', tc: '#993C1D' },
    { bg: '#E6F1FB', tc: '#185FA5' }, { bg: '#EAF3DE', tc: '#3B6D11' },
    { bg: '#FAEEDA', tc: '#854F0B' }, { bg: '#FBEAF0', tc: '#993556' },
    { bg: '#EEEDFE', tc: '#534AB7' }, { bg: '#FCEBEB', tc: '#A32D2D' },
  ];
  couleur(a: Article) {
    return this.PALETTES[parseInt(a.code_article) % this.PALETTES.length] ?? this.PALETTES[0];
  }

  // ── Modals ──────────────────────────────────────────────────────────────────

  ouvrirFormulaire(article?: Article) { this.modal.open(ArticleFormModalComponent, { article }); }
  ouvrirReappro(article: Article)     { this.modal.open(ReapproModalComponent, { article }); }

  async supprimer(article: Article) {
    const ok = await this.modal.open(ConfirmModalComponent, {
      titre:   'Supprimer un article',
      message: `Supprimer définitivement « ${article.nom} » ?`,
    });
    if (ok) this.data$.deleteArticle(article.code_article);
  }
}