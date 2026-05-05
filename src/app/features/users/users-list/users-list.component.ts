// users-list.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CacheService } from '../../../core/services/cache.service';
import { DataService } from '../../../core/services/data.service';
import { AppUser } from '../../../core/models/supermarche.models';
import { UserFormModalComponent } from '../user-form-modal/user-form-modal.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [CommonModule, MatTooltipModule],
  template: `
    <div class="container-fluid py-3">
      <div class="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h4 class="fw-bold mb-0">Utilisateurs</h4>
          <small class="text-muted">{{ users().length }} comptes</small>
        </div>
        <button class="btn btn-primary" (click)="ouvrir()">
          <i class="fa-solid fa-user-plus me-1"></i> Nouvel utilisateur
        </button>
      </div>

      <div class="card">
        <div class="list-group list-group-flush">
          @for (u of users(); track u.id) {
            <div class="list-group-item d-flex align-items-center gap-3 py-3">
              <!-- Avatar initiales -->
              <div class="rounded-circle d-flex align-items-center justify-content-center fw-semibold flex-shrink-0"
                   style="width:42px;height:42px;font-size:13px"
                   [style.background]="roleColor(u.role).bg"
                   [style.color]="roleColor(u.role).tc">
                {{ u.nom.substring(0,2).toUpperCase() }}
              </div>

              <div class="flex-grow-1">
                <div class="fw-semibold">{{ u.nom }}</div>
                <small class="text-muted">{{ u.username }}</small>
              </div>

              <!-- Badge rôle -->
              <span class="badge rounded-pill {{ roleBadge(u.role) }}">
                {{ u.role }}
              </span>

              <!-- Actions -->
              <div class="d-flex gap-2">
                <button class="btn btn-sm btn-outline-secondary px-2"
                        matTooltip="Modifier cet utilisateur" (click)="ouvrir(u)">
                  <i class="fa-solid fa-pen"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger px-2"
                        matTooltip="Supprimer cet utilisateur" (click)="supprimer(u)">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </div>
          } @empty {
            <div class="list-group-item text-center text-muted py-4">
              <i class="fa-solid fa-users-slash fa-2x mb-2 d-block opacity-25"></i>
              Aucun utilisateur
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class UsersListComponent {
  private cache  = inject(CacheService);
  private data$  = inject(DataService);
  private dialog = inject(MatDialog);

  users = () => this.cache.getUsers();

  ouvrir(user?: AppUser): void {
    this.dialog.open(UserFormModalComponent, {
      width: '480px', maxWidth: '98vw',
      data: { user },
      panelClass: 'mat-dialog-no-padding',
    });
  }

  supprimer(u: AppUser): void {
    const ref = this.dialog.open(ConfirmModalComponent, {
      width: '360px',
      data: {
        titre: 'Supprimer l\'utilisateur',
        message: `Supprimer le compte de « ${u.nom} » ?`,
      },
    });
    ref.afterClosed().subscribe(ok => { if (ok) this.data$.deleteUser(u.id); });
  }

  roleColor(role: string): { bg: string; tc: string } {
    const map: Record<string, { bg: string; tc: string }> = {
      ADMIN:    { bg: '#FCEBEB', tc: '#A32D2D' },
      GERANT:   { bg: '#EEEDFE', tc: '#3C3489' },
      CAISSIER: { bg: '#E1F5EE', tc: '#085041' },
    };
    return map[role] ?? { bg: '#f0f0f0', tc: '#555' };
  }

  roleBadge(role: string): string {
    const map: Record<string, string> = {
      ADMIN:    'bg-danger',
      GERANT:   'bg-primary',
      CAISSIER: 'bg-success',
    };
    return map[role] ?? 'bg-secondary';
  }
}
