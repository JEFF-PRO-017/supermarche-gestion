// catalogue.component.ts
import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { RouterLink } from '@angular/router';
import { CacheService } from '../../../core/services/cache.service';
import { DataService } from '../../../core/services/data.service';
import { AuthService } from '../../../core/services/auth.service';
import { Article } from '../../../core/models/supermarche.models';
import { ArticleFormModalComponent } from '../article-form-modal/article-form-modal.component';
import { ReapproModalComponent } from '../../../shared/components/reapprovisionnement-modal/reapprovisionnement-modal.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { ModalService } from '@shared/components/modal.service';

@Component({
  selector: 'app-catalogue',
  standalone: true,
  imports: [CommonModule, FormsModule, MatPaginatorModule, RouterLink],
  template: `
    <div>

      <!-- Topbar -->
      <div class="sm-topbar">
        <div>
          <h2 class="sm-page-title">Articles</h2>
          <p class="sm-page-sub">
            {{ tous().length }} articles
            @if (alertes().length) {
              · <span style="color:var(--sm-danger)">{{ alertes().length }} en alerte</span>
            }
          </p>
        </div>
        @if (auth.isGerant()) {
          <a routerLink="/articles/nouveau" class="btn-sm-primary"
             style="font-size:12px;padding:7px 12px;text-decoration:none"
             title="Créer un nouvel article">
            <i class="fa-solid fa-plus" style="margin-right:5px;font-size:11px"></i>Nouveau
          </a>
        }
      </div>

      <!-- Alerte stock globale -->
      @if (alertes().length) {
        <div style="background:var(--sm-danger-lt);border-radius:8px;padding:.625rem .875rem;
                    margin-bottom:.875rem;font-size:13px;color:var(--sm-danger)">
          <i class="fa-solid fa-triangle-exclamation" style="margin-right:6px"></i>
          <strong>{{ alertes().length }} article(s) nécessitent un réapprovisionnement</strong>
        </div>
      }

      <!-- Filtres -->
      <div class="d-flex gap-2 mb-3" style="flex-wrap:wrap">
        <input type="search" class="form-control" style="flex:1;min-width:140px"
               placeholder="Code ou nom..." [(ngModel)]="recherche"
               (ngModelChange)="page=0" />
        <select class="form-select" style="max-width:140px"
                [(ngModel)]="filtreStock" (ngModelChange)="page=0">
          <option value="">Tous stocks</option>
          <option value="alerte">En alerte</option>
          <option value="ok">Stock OK</option>
        </select>
      </div>

      <!-- Tableau -->
      <div class="sm-card-flush mb-2">
        <table class="sm-table">
          <thead>
            <tr>
              <th style="padding-left:12px">Article</th>
              <th>Prix det.</th>
              <th>Prix gros</th>
              <th>Stock</th>
              <th style="text-align:center">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (a of pagines(); track a.code_article) {
              <tr [style.background]="niveauAlerte(a) === 'CRITIQUE' ? '#FFF8F8' : niveauAlerte(a) === 'FAIBLE' ? '#FFFCF5' : ''">
                <td style="padding-left:12px">
                  <div class="d-flex align-items-center gap-2">
                    <div class="sm-avatar"
                         [style.background]="couleur(a).bg"
                         [style.color]="couleur(a).tc">
                      {{ a.nom.substring(0,2).toUpperCase() }}
                    </div>
                    <div>
                      <div style="font-weight:500;font-size:13px">{{ a.nom }}</div>
                      <span class="sm-badge {{ badgeClass(a) }}" style="font-size:10px">
                        {{ badgeLabel(a) }}
                      </span>
                    </div>
                  </div>
                </td>
                <td style="font-size:13px;white-space:nowrap">{{ a.prix_detail | number }} F</td>
                <td style="font-size:13px;color:var(--sm-info);white-space:nowrap">{{ a.prix_grossiste | number }} F</td>
                <td>
                  <div class="d-flex align-items-center gap-1">
                    <div class="sm-stock-bar">
                      <div class="sm-stock-fill" [style.width.%]="stockPct(a)"
                           [style.background]="niveauAlerte(a) === 'CRITIQUE' ? 'var(--sm-danger)' :
                                               niveauAlerte(a) === 'FAIBLE'   ? 'var(--sm-warn)'   : 'var(--sm-primary)'">
                      </div>
                    </div>
                    <small [style.color]="niveauAlerte(a) === 'CRITIQUE' ? 'var(--sm-danger)' :
                                          niveauAlerte(a) === 'FAIBLE'   ? 'var(--sm-warn)'   : 'var(--sm-text)'">
                      {{ a.stock_actuel }}
                    </small>
                  </div>
                </td>
                <td>
                  <div class="d-flex justify-content-center gap-1">
                    @if (auth.isGerant()) {
                      <button class="btn-icon"
                              [style.background]="niveauAlerte(a) ? 'var(--sm-primary-lt)' : ''"
                              title="Réapprovisionner le stock"
                              (click)="ouvrirReappro(a)">
                        <i class="fa-solid fa-arrow-up" style="font-size:12px"
                           [style.color]="niveauAlerte(a) ? 'var(--sm-primary-dk)' : ''"></i>
                      </button>
                      <button class="btn-icon"
                              title="Modifier cet article"
                              (click)="ouvrirFormulaire(a)">
                        <i class="fa-solid fa-pen" style="font-size:12px"></i>
                      </button>
                    }
                    @if (auth.isAdmin()) {
                      <button class="btn-icon" style="color:var(--sm-danger)"
                              title="Supprimer cet article"
                              (click)="supprimer(a)">
                        <i class="fa-solid fa-trash" style="font-size:12px"></i>
                      </button>
                    }
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="text-center py-4" style="color:var(--sm-text-3)">
                  <i class="fa-solid fa-box-open fa-lg d-block mb-2 opacity-50"></i>
                  Aucun article trouvé
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <mat-paginator
        [length]="filtres().length"
        [pageSize]="pageSize"
        [pageSizeOptions]="[10, 20, 50]"
        (page)="onPage($event)"
        showFirstLastButtons>
      </mat-paginator>

    </div>
  `,
})
export class CatalogueComponent {
  protected cache = inject(CacheService);
  protected data$ = inject(DataService);
  protected auth  = inject(AuthService);
  private modal   = inject(ModalService);

  recherche   = '';
  filtreStock = '';
  page        = 0;
  pageSize    = 10;

  tous    = () => this.cache.getArticles();
  alertes = this.cache.alertes;

  filtres = computed(() => {
    const q = this.recherche.toLowerCase();
    return this.cache.getArticles().filter(a => {
      const mQ = !q || a.nom.toLowerCase().includes(q) || a.code_article.includes(q);
      const mS = !this.filtreStock
        || (this.filtreStock === 'alerte' &&  this.niveauAlerte(a))
        || (this.filtreStock === 'ok'     && !this.niveauAlerte(a));
      return mQ && mS;
    });
  });

  pagines = computed(() =>
    this.filtres().slice(this.page * this.pageSize, (this.page + 1) * this.pageSize)
  );

  onPage(e: PageEvent) { this.page = e.pageIndex; this.pageSize = e.pageSize; }

  niveauAlerte(a: Article): 'CRITIQUE' | 'FAIBLE' | null {
    if (a.stock_actuel <= a.seuil_alerte)       return 'CRITIQUE';
    if (a.stock_actuel <= a.seuil_alerte * 1.5) return 'FAIBLE';
    return null;
  }

  stockPct(a: Article): number {
    return Math.min(100, Math.round(a.stock_actuel / (a.seuil_alerte * 8) * 100));
  }

  badgeClass(a: Article): string {
    const n = this.niveauAlerte(a);
    return n === 'CRITIQUE' ? 'sm-badge-red' : n === 'FAIBLE' ? 'sm-badge-warn' : 'sm-badge-green';
  }

  badgeLabel(a: Article): string {
    const n = this.niveauAlerte(a);
    return n === 'CRITIQUE' ? 'Rupture imminente' : n === 'FAIBLE' ? 'Stock faible' : 'En stock';
  }

  private PALETTES = [
    { bg:'#E1F5EE', tc:'#0F6E56' }, { bg:'#FAECE7', tc:'#993C1D' },
    { bg:'#E6F1FB', tc:'#185FA5' }, { bg:'#EAF3DE', tc:'#3B6D11' },
    { bg:'#FAEEDA', tc:'#854F0B' }, { bg:'#FBEAF0', tc:'#993556' },
    { bg:'#EEEDFE', tc:'#534AB7' }, { bg:'#FCEBEB', tc:'#A32D2D' },
  ];

  couleur(a: Article): { bg: string; tc: string } {
    return this.PALETTES[parseInt(a.code_article) % this.PALETTES.length] ?? this.PALETTES[0];
  }

  ouvrirFormulaire(article?: Article) {
    this.modal.open(ArticleFormModalComponent, { article });
  }

  ouvrirReappro(article: Article) {
    this.modal.open(ReapproModalComponent, { article });
  }

  async supprimer(article: Article) {
    const ok = await this.modal.open(ConfirmModalComponent, {
      titre:   'Supprimer un article',
      message: `Supprimer définitivement « ${article.nom} » ?`,
    });
    if (ok) this.data$.deleteArticle(article.code_article);
  }
}