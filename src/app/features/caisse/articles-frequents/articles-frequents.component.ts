// articles-frequents.component.ts
import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CacheService } from '../../../core/services/cache.service';
import { Article } from '../../../core/models/supermarche.models';

@Component({
  selector: 'app-articles-frequents',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div>
      <p class="small fw-semibold text-uppercase text-muted mb-2">
        Articles fréquents
      </p>
      <div class="row g-2">
        @for (a of articles(); track a.code_article) {
          <div class="col-6 col-sm-3 col-md-3">
            <button class="btn btn-outline-secondary w-100 text-start p-2 h-100"
                    (click)="selectionner.emit(a)">
              <!-- Avatar couleur basé sur le code -->
              <div class="d-flex align-items-center gap-2">
                <div class="rounded-2 d-flex align-items-center justify-content-center flex-shrink-0"
                     style="width:32px;height:32px;font-size:9px;font-weight:600"
                     [style.background]="couleur(a).bg"
                     [style.color]="couleur(a).tc">
                  {{ a.nom.substring(0,2).toUpperCase() }}
                </div>
                <div class="overflow-hidden">
                  <div class="small fw-semibold text-truncate">{{ a.nom }}</div>
                  <div class="text-muted" style="font-size:11px">{{ a.prix_detail | number }} F</div>
                </div>
              </div>
            </button>
          </div>
        }
      </div>
    </div>
  `,
})
export class ArticlesFrequentsComponent {
  private cache = inject(CacheService);

  // Émet l'article sélectionné vers le composant parent (caisse)
  selectionner = output<Article>();

  // 8 premiers articles du catalogue comme fréquents
  articles = () => this.cache.getArticles().slice(0, 8);

  // Palette de couleurs cyclique pour les avatars
  private PALETTES = [
    { bg: '#E1F5EE', tc: '#0F6E56' }, { bg: '#FAECE7', tc: '#993C1D' },
    { bg: '#E6F1FB', tc: '#185FA5' }, { bg: '#EAF3DE', tc: '#3B6D11' },
    { bg: '#FAEEDA', tc: '#854F0B' }, { bg: '#FBEAF0', tc: '#993556' },
    { bg: '#EEEDFE', tc: '#534AB7' }, { bg: '#FCEBEB', tc: '#A32D2D' },
  ];

  couleur(a: Article): { bg: string; tc: string } {
    const idx = parseInt(a.code_article, 10) % this.PALETTES.length;
    return this.PALETTES[idx] ?? this.PALETTES[0];
  }
}
