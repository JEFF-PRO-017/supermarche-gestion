// app.component.ts — shell principal PWA
import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './core/services/auth.service';
import { SheetsQueueServiceService } from './core/services/sheets-queue.service';
import { DataService } from './core/services/data.service';
import { ModalService } from '@shared/components/modal.service';
import { ConfirmModalComponent } from './shared/components/confirm-modal/confirm-modal.component';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  template: `
    @if (auth.isLoggedIn()) {

      <!-- ── NAVBAR SUPÉRIEURE ─────────────────────────────────────
           Blanche, bordure basse, collée en haut (sticky-top)
           Sur mobile : texte court "Étoile", nom user masqué
      ──────────────────────────────────────────────────────────── -->
      <nav class="navbar bg-white border-bottom sticky-top px-3" style="min-height:56px">

        <span class="navbar-brand mb-0 fw-semibold text-dark fs-6">
          <i class="fa-solid fa-store text-success me-2"></i>
          <span class="d-none d-sm-inline">{{ app_name }}</span>
          <span class="d-sm-none">{{ app_name_sm }}</span>
        </span>

        <div class="d-flex align-items-center gap-2">

          <!-- Hors-ligne -->
          @if (!online()) {
            <span class="badge bg-danger" title="Hors ligne">
              <i class="fa-solid fa-wifi-slash"></i>
            </span>
          }

          <!-- Queue en attente (cliquable pour vider) -->
          @if (queueSize() > 0) {
            <button class="btn btn-warning btn-sm" title="Opérations en attente" (click)="viderQueue()">
              <i class="fa-solid fa-clock-rotate-left me-1"></i>{{ queueSize() }}
            </button>
          }

          <!-- Nom + rôle — masqué sur très petit écran -->
          <div class="d-none d-sm-flex flex-column align-items-end lh-1">
            <small class="fw-semibold text-dark" style="font-size:12px">{{ auth.user()?.nom }}</small>
            <span class="badge mt-1" [ngClass]="roleBadgeClass()" style="font-size:10px">{{ auth.user()?.role }}</span>
          </div>

          <!-- Recharger depuis Sheets -->
          <button class="btn btn-outline-secondary btn-sm" title="Recharger" (click)="recharger()" [disabled]="reloading()">
            <i class="fa-solid fa-rotate" [class.fa-spin]="reloading()"></i>
          </button>

          <!-- Déconnexion -->
          <button class="btn btn-outline-danger btn-sm" title="Déconnexion" (click)="auth.logout()">
            <i class="fa-solid fa-right-from-bracket"></i>
          </button>

        </div>
      </nav>

      <!-- ── CONTENU PRINCIPAL ─────────────────────────────────────
           container-fluid sur mobile, container-md sur tablette+
           padding-bottom pour ne pas passer sous la navbar basse
      ──────────────────────────────────────────────────────────── -->
      <main class="container-fluid container-md py-3 px-3 mb-5" style="padding-bottom:80px">
        <router-outlet />
      </main>

      <!-- ── NAVBAR BASSE ──────────────────────────────────────────
           Fixée en bas, hauteur fixe 58px
           Onglet actif : texte vert + bordure verte en haut
      ──────────────────────────────────────────────────────────── -->
      <nav class="fixed-bottom bg-white border-top d-flex" style="height:58px">

        <a class="d-flex flex-column align-items-center justify-content-center flex-fill text-secondary text-decoration-none"
           routerLink="/caisse" routerLinkActive="text-success border-top border-success border-2">
          <i class="fa-solid fa-cash-register" style="font-size:18px"></i>
          <span style="font-size:10px;margin-top:2px">Caisse</span>
        </a>

        <a class="d-flex flex-column align-items-center justify-content-center flex-fill text-secondary text-decoration-none"
           routerLink="/catalogue" routerLinkActive="text-success border-top border-success border-2">
          <i class="fa-solid fa-box" style="font-size:18px"></i>
          <span style="font-size:10px;margin-top:2px">Articles</span>
        </a>

        <a class="d-flex flex-column align-items-center justify-content-center flex-fill text-secondary text-decoration-none"
           routerLink="/historique" routerLinkActive="text-success border-top border-success border-2">
          <i class="fa-solid fa-chart-bar" style="font-size:18px"></i>
          <span style="font-size:10px;margin-top:2px">Historique</span>
        </a>

        @if (auth.isAdmin()) {
          <a class="d-flex flex-column align-items-center justify-content-center flex-fill text-secondary text-decoration-none"
             routerLink="/users" routerLinkActive="text-success border-top border-success border-2">
            <i class="fa-solid fa-users" style="font-size:18px"></i>
            <span style="font-size:10px;margin-top:2px">Utilisateurs</span>
          </a>
        }

      </nav>

    } @else {
      <!-- Page login — sans navbar -->
      <router-outlet />
    }
  `,
})
export class AppComponent implements OnInit {

  auth    = inject(AuthService);
  private data  = inject(DataService);
  private queue = inject(SheetsQueueServiceService);
  private modal = inject(ModalService);
  app_name = environment.app_name;
  app_name_sm = environment.app_name_sm;

  reloading = signal(false);
  online    = signal(true);

  ngOnInit(): void {
    window.addEventListener('online',  () => this.online.set(true));
    window.addEventListener('offline', () => this.online.set(false));
  }

  // Badge couleur selon le rôle
  roleBadgeClass(): string {
    const map: Record<string, string> = {
      ADMIN:    'bg-danger',
      GERANT:   'bg-primary',
      CAISSIER: 'bg-success',
    };
    return map[this.auth.user()?.role ?? ''] ?? 'bg-secondary';
  }

  queueSize(): number { return this.queue.size(); }

  // Vide la file d'attente après confirmation
  async viderQueue(): Promise<void> {
    const ok = await this.modal.open(ConfirmModalComponent, {
      titre:   'Vider la file d\'attente',
      message: `Vider ${this.queue.size()} opération(s) en attente ? Ces modifications ne seront PAS envoyées à Google Sheets.`,
    });
    // if (ok) this.queue.clearQueue();
  }

  // Recharge depuis Sheets sans vider le cache
  async recharger(): Promise<void> {
    if (this.reloading()) return;
    this.reloading.set(true);
    try {
      await this.data.initAppData();
    } finally {
      this.reloading.set(false);
    }
  }

  // Vide le cache local puis recharge tout depuis Sheets
  async invaliderEtRecharger(): Promise<void> {
    const ok = await this.modal.open(ConfirmModalComponent, {
      titre:   'Recharger les données',
      message: 'Vider toutes les données locales et recharger depuis Google Sheets ?',
    });
    if (!ok) return;
    if (this.reloading()) return;
    this.reloading.set(true);
    try {
      this.data.invalidateCache();
      await this.data.initAppData();
    } finally {
      this.reloading.set(false);
    }
  }
}