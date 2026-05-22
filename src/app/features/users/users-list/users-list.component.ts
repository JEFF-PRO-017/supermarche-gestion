// users-list.component.ts
import { Component, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { DataService } from '../../../core/services/data.service';
import { AppUser, Role } from '../../../core/models/supermarche.models';

declare const bootstrap: any;

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="container-fluid py-3">

      <!-- En-tête -->
      <div class="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h4 class="fw-bold mb-0">Utilisateurs</h4>
          <small class="text-muted">{{ users().length }} comptes</small>
        </div>
        <button class="btn btn-primary" (click)="ouvrir()">
          <i class="fa-solid fa-user-plus me-1"></i> Nouvel utilisateur
        </button>
      </div>

      <!-- Liste -->
      <div class="card">
        <div class="list-group list-group-flush">
          @for (u of users(); track u.id) {
            <div class="list-group-item d-flex align-items-center gap-3 py-3">
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
              <span class="badge rounded-pill {{ roleBadge(u.role) }}">{{ u.role }}</span>
              <div class="d-flex gap-2">
                <button class="btn btn-sm btn-outline-secondary px-2" title="Modifier" (click)="ouvrir(u)">
                  <i class="fa-solid fa-pen"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger px-2" title="Supprimer" (click)="confirmerSuppression(u)">
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

    <!-- ── Modal formulaire ── -->
    <div class="modal fade" id="userFormModal" tabindex="-1" #userModal>
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content" [formGroup]="form">
          <div class="modal-header">
            <h5 class="modal-title fw-semibold">
              <i class="fa-solid {{ isEdit ? 'fa-user-pen' : 'fa-user-plus' }} me-2 text-primary"></i>
              {{ isEdit ? 'Modifier' : 'Nouvel' }} utilisateur
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="row g-3">
              <div class="col-6">
                <label class="form-label small fw-semibold">Nom complet *</label>
                <input type="text" class="form-control form-control-sm"
                       formControlName="nom" placeholder="ex: Jean Kamga" />
              </div>
              <div class="col-6">
                <label class="form-label small fw-semibold">Identifiant *</label>
                <input type="text" class="form-control form-control-sm"
                       formControlName="username" placeholder="ex: jean.kamga" />
              </div>
              <div class="col-6">
                <label class="form-label small fw-semibold">
                  Mot de passe {{ isEdit ? '(vide = inchangé)' : '*' }}
                </label>
                <input type="password" class="form-control form-control-sm"
                       formControlName="mot_de_passe" placeholder="••••••••" />
              </div>
              <div class="col-6">
                <label class="form-label small fw-semibold">Rôle *</label>
                <select class="form-select form-select-sm" formControlName="role">
                  <option value="CAISSIER">Caissier</option>
                  <option value="GERANT">Gérant</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <div class="form-text">Admin : accès total · Gérant : articles + ventes · Caissier : ventes</div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-bs-dismiss="modal">Annuler</button>
            <button class="btn btn-primary" [disabled]="form.invalid || saving()" (click)="sauvegarder()">
              @if (saving()) { <span class="spinner-border spinner-border-sm me-1"></span> }
              <i class="fa-solid fa-check me-1"></i>
              {{ isEdit ? 'Mettre à jour' : 'Créer' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Modal confirmation suppression ── -->
    <div class="modal fade" id="confirmModal" tabindex="-1" #confirmModal>
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content">
          <div class="modal-header border-0 pb-0">
            <h5 class="modal-title fw-semibold text-danger">
              <i class="fa-solid fa-triangle-exclamation me-2"></i>Supprimer
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body pt-1">
            <p class="mb-0 text-muted small">
              Supprimer le compte de <strong>{{ userASupprimer()?.nom }}</strong> ?
              Cette action est irréversible.
            </p>
          </div>
          <div class="modal-footer border-0 pt-0">
            <button class="btn btn-sm btn-secondary" data-bs-dismiss="modal">Annuler</button>
            <button class="btn btn-sm btn-danger" (click)="supprimerConfirme()">
              <i class="fa-solid fa-trash me-1"></i>Supprimer
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class UsersListComponent {
  private data$ = inject(DataService);
  private fb    = inject(FormBuilder);

  @ViewChild('userModal')   private userModalEl!: ElementRef;
  @ViewChild('confirmModal') private confirmModalEl!: ElementRef;

  users = () => this.data$.getUsers();
  saving = signal(false);
  isEdit = false;
  userASupprimer = signal<AppUser | undefined>(undefined);

  private editingId: string | null = null;
  private editingPassword = '';

  form = this.fb.group({
    nom:          ['', Validators.required],
    username:     ['', Validators.required],
    mot_de_passe: [''],
    role:         ['CAISSIER' as Role, Validators.required],
  });

  // ── Ouvre le modal formulaire ──
  ouvrir(user?: AppUser): void {
    this.isEdit = !!user;
    this.editingId = user?.id ?? null;
    this.editingPassword = user?.mot_de_passe ?? '';

    this.form.reset({ nom: '', username: '', mot_de_passe: '', role: 'CAISSIER' });

    const pwCtrl = this.form.get('mot_de_passe')!;
    if (user) {
      this.form.patchValue(user);
      pwCtrl.clearValidators();
    } else {
      pwCtrl.setValidators(Validators.required);
    }
    pwCtrl.updateValueAndValidity();

    new bootstrap.Modal(this.userModalEl.nativeElement).show();
  }

  sauvegarder(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.value;
    const user: AppUser = {
      id:           this.editingId ?? `USR-${Date.now()}`,
      nom:          v.nom!,
      username:     v.username!,
      mot_de_passe: v.mot_de_passe || this.editingPassword,
      role:         v.role as Role,
    };
    if (this.isEdit) this.data$.updateUser(user);
    else             this.data$.addUser(user);
    this.saving.set(false);
    bootstrap.Modal.getInstance(this.userModalEl.nativeElement)?.hide();
  }

  // ── Ouvre le modal confirmation ──
  confirmerSuppression(u: AppUser): void {
    this.userASupprimer.set(u);
    new bootstrap.Modal(this.confirmModalEl.nativeElement).show();
  }

  supprimerConfirme(): void {
    const u = this.userASupprimer();
    if (u) this.data$.deleteUser(u.id);
    bootstrap.Modal.getInstance(this.confirmModalEl.nativeElement)?.hide();
  }

  // ── Helpers ──
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