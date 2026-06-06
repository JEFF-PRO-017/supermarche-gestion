// shared/components/filter-bar/filter-bar.component.ts
import {
  Component, Input, Output, EventEmitter,
  ChangeDetectionStrategy, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface FilterBarConfig {
  searchPlaceholder?: string;
  selectOptions?: { value: string; label: string; icon?: string }[];
  selectPlaceholder?: string;
}

export interface FilterBarState {
  search: string;
  select: string;
}

@Component({
  selector: 'app-filter-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="d-flex flex-wrap align-items-center gap-2 mb-3">

      <!-- Recherche -->
      <div class="input-group input-group-sm flex-grow-1" style="max-width:320px">
        <span class="input-group-text bg-white border-end-0">
          <i class="fa-solid fa-magnifying-glass text-muted" style="font-size:11px"></i>
        </span>
        <input type="search"
               class="form-control border-start-0 ps-0"
               [placeholder]="config.searchPlaceholder ?? 'Rechercher...'"
               [(ngModel)]="state.search"
               (ngModelChange)="emit()"
               autocomplete="off"
               aria-label="Rechercher" />
        @if (state.search) {
          <button class="btn btn-outline-secondary border-start-0" type="button"
                  (click)="clear()" aria-label="Effacer">
            <i class="fa-solid fa-xmark" style="font-size:11px"></i>
          </button>
        }
      </div>

      <!-- Chips de filtre select -->
      @if (config.selectOptions?.length) {
        <div class="d-flex flex-wrap gap-1" role="group" aria-label="Filtres">

          <!-- Chip "Tous" -->
          <button type="button"
                  class="btn btn-sm rounded-pill px-3"
                  [class]="state.select === '' ? 'btn-dark' : 'btn-outline-secondary'"
                  (click)="setSelect('')">
            {{ config.selectPlaceholder ?? 'Tous' }}
          </button>

          <!-- Chips options -->
          @for (opt of config.selectOptions; track opt.value) {
            <button type="button"
                    class="btn btn-sm rounded-pill px-3"
                    [class]="state.select === opt.value ? activeClass(opt.value) : 'btn-outline-secondary'"
                    (click)="setSelect(opt.value)">
              @if (opt.icon) {
                <i class="fa-solid {{ opt.icon }} me-1" style="font-size:10px"></i>
              }
              {{ opt.label }}
            </button>
          }

        </div>
      }

      <!-- Slot droite : compteur résultats -->
      <div class="ms-auto d-flex align-items-center gap-2">
        @if (totalFiltered !== undefined) {
          <span class="badge bg-light text-dark border small fw-normal">
            <i class="fa-solid fa-list me-1 text-muted" style="font-size:10px"></i>
            @if (totalFiltered !== totalAll) {
              <span class="text-primary fw-semibold">{{ totalFiltered }}</span>&nbsp;/&nbsp;
            }
            {{ totalAll }} résultat{{ totalAll! > 1 ? 's' : '' }}
          </span>
        }

        <!-- Taille de page -->
        @if (showPageSize) {
          <div class="d-flex align-items-center gap-1">
            <span class="text-muted small text-nowrap">Voir</span>
            <select class="form-select form-select-sm"
                    style="width:68px"
                    [(ngModel)]="pageSize"
                    (ngModelChange)="pageSizeChange.emit(pageSize)"
                    aria-label="Lignes par page">
              @for (s of pageSizeOptions; track s) {
                <option [value]="s">{{ s }}</option>
              }
            </select>
          </div>
        }
      </div>

    </div>
  `
})
export class FilterBarComponent {
  @Input() config: FilterBarConfig = {};
  @Input() totalAll?: number;
  @Input() totalFiltered?: number;
  @Input() showPageSize = true;
  @Input() pageSizeOptions: number[] = [5,10, 20, 50];
  @Input() pageSize = 5;

  @Output() filterChange  = new EventEmitter<FilterBarState>();
  @Output() pageSizeChange = new EventEmitter<number>();

  state: FilterBarState = { search: '', select: '' };

  setSelect(v: string) { this.state = { ...this.state, select: v }; this.emit(); }
  clear()              { this.state = { ...this.state, search: '' }; this.emit(); }
  emit()               { this.filterChange.emit({ ...this.state }); }

  /** Couleur active selon la valeur du chip */
  activeClass(value: string): string {
    const map: Record<string, string> = {
      alerte:    'btn-danger',
      ok:        'btn-success',
      GROSSISTE: 'btn-info text-dark',
      DETAIL:    'btn-secondary',
    };
    return map[value] ?? 'btn-primary';
  }
}