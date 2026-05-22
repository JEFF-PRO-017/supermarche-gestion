// app.component.ts — shell principal PWA
import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  template: `
    @if (auth.isLoggedIn()) {

      <!-- Barre supérieure -->
      <header class="sm-navbar">
        <div class="sm-navbar-brand">
          <i class="fa-solid fa-store"></i>
          Supermarché Étoile
        </div>
        <div class="d-flex align-items-center gap-2">
          <span class="sm-badge sm-badge-gray">{{ auth.user()?.nom }}</span>
          <span class="sm-badge {{ roleBadge() }}" style="font-size:10px">{{ auth.user()?.role }}</span>
          <button class="btn-icon" (click)="auth.logout()" title="Se déconnecter">
            <i class="fa-solid fa-right-from-bracket" style="font-size:13px"></i>
          </button>
        </div>
      </header>

      <!-- Contenu principal centré max 640px -->
      <main class="container">
        <div class="page-content mt-2 mb-5">
          <router-outlet />
        </div>
      </main>

      <!-- Navbar basse tablette/Android -->
      <nav class="sm-bottom-nav">
        <a class="sm-nav-item" routerLink="/caisse" routerLinkActive="active">
          <i class="fa-solid fa-cash-register"></i>Caisse
        </a>
        <a class="sm-nav-item" routerLink="/catalogue" routerLinkActive="active">
          <i class="fa-solid fa-box"></i>Articles
        </a>
        <a class="sm-nav-item" routerLink="/historique" routerLinkActive="active">
          <i class="fa-solid fa-chart-bar"></i>Historique
        </a>
        @if (auth.isAdmin()) {
          <a class="sm-nav-item" routerLink="/users" routerLinkActive="active">
            <i class="fa-solid fa-users"></i>Utilisateurs
          </a>
        }
      </nav>

    } @else {
      <!-- Page login sans navbar -->
      <router-outlet />
    }
  `,
})
export class AppComponent {
  auth = inject(AuthService);

  roleBadge(): string {
    const map: Record<string, string> = {
      ADMIN: 'sm-badge-admin', GERANT: 'sm-badge-gerant', CAISSIER: 'sm-badge-green',
    };
    return map[this.auth.user()?.role ?? ''] ?? 'sm-badge-gray';
  }
}
