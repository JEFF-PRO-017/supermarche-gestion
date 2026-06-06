// shared/components/pagination/pagination.component.ts
import {
  Component, Input, Output, EventEmitter,
  OnChanges, SimpleChanges, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (totalPages > 1) {
      <div class="d-flex flex-column align-items-center gap-1 mt-3 pt-2 border-top">

        <ul class="pagination pagination-sm mb-0">

          <li class="page-item" [class.disabled]="page === 0">
            <button class="page-link" (click)="goTo(0)" aria-label="Première page">
              <i class="fa-solid fa-angles-left"></i>
            </button>
          </li>
          <li class="page-item" [class.disabled]="page === 0">
            <button class="page-link" (click)="goTo(page - 1)" aria-label="Page précédente">
              <i class="fa-solid fa-angle-left"></i>
            </button>
          </li>

          @for (p of visiblePages; track p) {
            @if (p === -1) {
              <li class="page-item disabled"><span class="page-link">…</span></li>
            } @else {
              <li class="page-item" [class.active]="p === page">
                <button class="page-link" (click)="goTo(p)"
                        [attr.aria-current]="p === page ? 'page' : null">
                  {{ p + 1 }}
                </button>
              </li>
            }
          }

          <li class="page-item" [class.disabled]="page >= totalPages - 1">
            <button class="page-link" (click)="goTo(page + 1)" aria-label="Page suivante">
              <i class="fa-solid fa-angle-right"></i>
            </button>
          </li>
          <li class="page-item" [class.disabled]="page >= totalPages - 1">
            <button class="page-link" (click)="goTo(totalPages - 1)" aria-label="Dernière page">
              <i class="fa-solid fa-angles-right"></i>
            </button>
          </li>

        </ul>

        <small class="text-muted">
          Page {{ page + 1 }} sur {{ totalPages }}
          &nbsp;·&nbsp;
          lignes {{ startItem }}–{{ endItem }}
        </small>

      </div>
    }
  `
})
export class PaginationComponent implements OnChanges {

  /** Page courante (0-indexed) */
  @Input() page = 0;

  /** Nombre total d'éléments filtrés */
  @Input() total = 0;

  /** Taille de page courante */
  @Input() pageSize = 10;

  /** Émet le numéro de page (0-indexed) */
  @Output() pageChange = new EventEmitter<number>();

  get totalPages() { return Math.max(1, Math.ceil(this.total / this.pageSize)); }
  get startItem()  { return this.total === 0 ? 0 : this.page * this.pageSize + 1; }
  get endItem()    { return Math.min(this.total, (this.page + 1) * this.pageSize); }

  get visiblePages(): number[] {
    const total = this.totalPages, cur = this.page;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i);
    const pages: number[] = [0];
    if (cur > 2)          pages.push(-1);
    for (let i = Math.max(1, cur - 1); i <= Math.min(total - 2, cur + 1); i++) pages.push(i);
    if (cur < total - 3)  pages.push(-1);
    pages.push(total - 1);
    return pages;
  }

  ngOnChanges(c: SimpleChanges) {
    // Si total réduit et page hors limite → revenir à 0
    if ((c['total'] || c['pageSize']) && this.page >= this.totalPages)
      this.pageChange.emit(0);
  }

  goTo(p: number) {
    if (p < 0 || p >= this.totalPages || p === this.page) return;
    this.pageChange.emit(p);
  }
}