// login.component.ts
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService, ADMIN_TEST } from '../../../core/services/auth.service';
import { DataService } from '../../../core/services/data.service';
import { CacheService } from '../../../core/services/cache.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  template: `
    <div class="min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <div class="card shadow-sm" style="width:100%;max-width:400px">
        <div class="card-body p-4">

          <!-- Logo et titre -->
          <div class="text-center mb-4">
            <div class="rounded-3 bg-success bg-opacity-10 d-inline-flex
                        align-items-center justify-content-center mb-3"
                 style="width:60px;height:60px">
              <i class="fa-solid fa-store text-success fa-xl"></i>
            </div>
            <h5 class="fw-bold mb-0">Supermarché Étoile</h5>
            <small class="text-muted">Système de gestion</small>
          </div>

          <!-- Encart admin de test — visible uniquement si Sheets est vide -->
          @if (afficherAdminTest()) {
            <div class="alert alert-info py-2 mb-3 small">
              <div class="fw-semibold mb-1">
                <i class="fa-solid fa-circle-info me-1"></i>
                Compte de test disponible
              </div>
              <div>
                Identifiant : <code class="user-select-all">{{ adminTest.username }}</code>
              </div>
              <div>
                Mot de passe : <code class="user-select-all">{{ adminTest.mot_de_passe }}</code>
              </div>
              <div class="text-muted mt-1" style="font-size:10px">
                Visible uniquement si aucun utilisateur n'est enregistré dans Sheets.
                Créez un vrai admin via la page Utilisateurs puis désactivez ce compte.
              </div>
            </div>
          }

          <!-- Message d'erreur identifiants invalides -->
          @if (erreur()) {
            <div class="alert alert-danger py-2 small">
              <i class="fa-solid fa-circle-xmark me-1"></i>
              Identifiant ou mot de passe incorrect
            </div>
          }

          <!-- Champ identifiant -->
          <div class="mb-3">
            <label class="form-label fw-semibold small">Identifiant</label>
            <div class="input-group">
              <span class="input-group-text">
                <i class="fa-solid fa-user text-muted"></i>
              </span>
              <input type="text"
                     class="form-control form-control-lg"
                     [(ngModel)]="username"
                     placeholder="ex: admin"
                     (keyup.enter)="login()"
                     autocomplete="username" />
            </div>
          </div>

          <!-- Champ mot de passe avec bascule affichage -->
          <div class="mb-4">
            <label class="form-label fw-semibold small">Mot de passe</label>
            <div class="input-group">
              <span class="input-group-text">
                <i class="fa-solid fa-lock text-muted"></i>
              </span>
              <input [type]="afficherPwd() ? 'text' : 'password'"
                     class="form-control form-control-lg"
                     [(ngModel)]="password"
                     placeholder="••••••••"
                     (keyup.enter)="login()"
                     autocomplete="current-password" />
              <!-- Bouton afficher/masquer le mot de passe -->
              <button class="btn btn-outline-secondary"
                      type="button"
                      (click)="afficherPwd.set(!afficherPwd())"
                      title="Afficher ou masquer le mot de passe">
                <i class="fa-solid"
                   [class.fa-eye]="!afficherPwd()"
                   [class.fa-eye-slash]="afficherPwd()"></i>
              </button>
            </div>
          </div>

          <!-- Bouton connexion -->
          <button class="btn btn-success btn-lg w-100 fw-semibold"
                  [disabled]="chargement()"
                  (click)="login()">
            @if (chargement()) {
              <!-- Indicateur de chargement pendant l'appel Sheets -->
              <span class="spinner-border spinner-border-sm me-2"></span>
              Connexion en cours...
            } @else {
              <i class="fa-solid fa-right-to-bracket me-2"></i>
              Se connecter
            }
          </button>

        </div>
      </div>
    </div>
  `,
})
export class LoginComponent implements OnInit {

  private auth   = inject(AuthService);
  private data$  = inject(DataService);
  private cache  = inject(CacheService);
  private router = inject(Router);

  username    = '';
  password    = '';
  erreur      = signal(false);
  chargement  = signal(false);
  afficherPwd = signal(false);

  readonly adminTest = ADMIN_TEST;

  // Encart de test visible uniquement si aucun utilisateur dans Sheets
  afficherAdminTest = computed(() => this.cache.getUsers().length === 0);

  // ── Cycle de vie ─────────────────────────────────────────────
  // ngOnInit s'exécute après le rendu DOM — crypto.subtle est disponible ici.
  // ensureSheets tourne en arrière-plan sans bloquer l'affichage du formulaire.
  ngOnInit(): void {
    setTimeout(() => this.data$.ensureSheets(), 6000);
  }

  // ── Connexion ────────────────────────────────────────────────
  async login(): Promise<void> {
    if (!this.username.trim() || !this.password) return;

    this.chargement.set(true);
    this.erreur.set(false);

    // Chargement des données depuis Sheets (crée aussi l'admin de test si Sheets est vide)
    await this.data$.initAppData();

    const succes = this.auth.login(this.username.trim(), this.password);

    this.chargement.set(false);

    if (succes) {
      // Redirection vers la caisse après connexion réussie
      this.router.navigate(['/caisse']);
    } else {
      this.erreur.set(true);
    }
  }
}