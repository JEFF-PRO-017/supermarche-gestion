// user-form-modal.component.ts
import { Component, Inject, inject, signal } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DataService } from '../../../core/services/data.service';
import { AppUser, Role } from '../../../core/models/supermarche.models';

export interface UserFormData { user?: AppUser; }

@Component({
  selector: 'app-user-form-modal',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, ReactiveFormsModule, CommonModule],
  template: `
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title fw-semibold">
          <i class="fa-solid {{ isEdit ? 'fa-user-pen' : 'fa-user-plus' }} me-2 text-primary"></i>
          {{ isEdit ? 'Modifier' : 'Nouvel' }} utilisateur
        </h5>
        <button type="button" class="btn-close" (click)="ref.close()"></button>
      </div>

      <div class="modal-body" [formGroup]="form">
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
              Mot de passe {{ isEdit ? '(laisser vide = inchangé)' : '*' }}
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
            <div class="form-text">
              Admin : accès total · Gérant : articles + ventes · Caissier : ventes
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" (click)="ref.close()">Annuler</button>
        <button class="btn btn-primary" [disabled]="form.invalid || saving()"
                (click)="sauvegarder()">
          @if (saving()) { <span class="spinner-border spinner-border-sm me-1"></span> }
          <i class="fa-solid fa-check me-1"></i>
          {{ isEdit ? 'Mettre à jour' : 'Créer' }}
        </button>
      </div>
    </div>
  `,
})
export class UserFormModalComponent {
  private data$ = inject(DataService);
  private fb    = inject(FormBuilder);

  saving = signal(false);
  isEdit: boolean;

  form = this.fb.group({
    nom:          ['', Validators.required],
    username:     ['', Validators.required],
    mot_de_passe: [''],
    role:         ['CAISSIER' as Role, Validators.required],
  });

  constructor(
    public ref: MatDialogRef<UserFormModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: UserFormData
  ) {
    this.isEdit = !!data.user;
    if (data.user) {
      this.form.patchValue(data.user);
      // Mot de passe non obligatoire en modification
      this.form.get('mot_de_passe')?.clearValidators();
      this.form.get('mot_de_passe')?.updateValueAndValidity();
    } else {
      this.form.get('mot_de_passe')?.setValidators(Validators.required);
    }
  }

  sauvegarder(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.value;
    const user: AppUser = {
      id:           this.data.user?.id ?? `USR-${Date.now()}`,
      nom:          v.nom!,
      username:     v.username!,
      mot_de_passe: v.mot_de_passe || this.data.user?.mot_de_passe || '',
      role:         v.role as Role,
    };
    if (this.isEdit) this.data$.updateUser(user);
    else             this.data$.addUser(user);
    this.saving.set(false);
    this.ref.close(true);
  }
}
