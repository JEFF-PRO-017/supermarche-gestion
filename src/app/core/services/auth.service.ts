// auth.service.ts
import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CacheService } from './cache.service';
import { AppUser, Role } from '../models/supermarche.models';

// ── Clé session navigateur ────────────────────────────────────
const SESSION_KEY = 'sm_user';

// ── Compte admin de test ──────────────────────────────────────
// Utilisé comme fallback si Sheets ne retourne aucun utilisateur.
// IMPORTANT : désactiver en production une fois le vrai admin créé dans Sheets.
export const ADMIN_TEST: AppUser = {
  id:           'USR-ADMIN-TEST',
  username:     'admin',
  mot_de_passe: 'admin123',
  nom:          'Administrateur Test',
  role:         'ADMIN',
};

@Injectable({ providedIn: 'root' })
export class AuthService {

  private cache  = inject(CacheService);
  private router = inject(Router);

  // Signal : utilisateur connecté — restauré depuis sessionStorage au démarrage
  private _user = signal<AppUser | null>(this.restaurerSession());

  // Signaux publics en lecture seule
  readonly user = this._user.asReadonly();
  readonly role = computed<Role | null>(() => this._user()?.role ?? null);

  // Vrai si le rôle est ADMIN (accès total : bénéfices, utilisateurs, suppression)
  readonly isAdmin = computed(() => this._user()?.role === 'ADMIN');

  // Vrai si le rôle est ADMIN ou GERANT (gestion articles, réappro, historique complet)
  readonly isGerant = computed(() =>
    this._user()?.role === 'ADMIN' || this._user()?.role === 'GERANT'
  );

  // Vrai si une session est ouverte (peu importe le rôle)
  isLoggedIn(): boolean { return this._user() !== null; }

  // ── Connexion ──────────────────────────────────────────────────
  // 1. Cherche dans le cache (utilisateurs chargés depuis Sheets)
  // 2. Si le cache est vide (Sheets non branché), accepte le compte ADMIN_TEST
  // Retourne true si les identifiants sont valides, false sinon.
  login(username: string, password: string): boolean {
    const usersSheets = this.cache.getUsers();

    // Recherche dans les comptes Sheets
    const trouve = usersSheets.find(
      u => u.username.trim() === username.trim()
        && u.mot_de_passe   === password
    );

    if (trouve) {
      this.ouvrirSession(trouve);
      return true;
    }

    // Fallback admin de test — actif uniquement si Sheets est vide
    if (
      usersSheets.length === 0
      && username === ADMIN_TEST.username
      && password === ADMIN_TEST.mot_de_passe
    ) {
      this.ouvrirSession(ADMIN_TEST);
      return true;
    }

    return false;
  }

  // ── Déconnexion ────────────────────────────────────────────────
  logout(): void {
    this._user.set(null);
    sessionStorage.removeItem(SESSION_KEY);
    this.router.navigate(['/login']);
  }

  // ── Helpers privés ─────────────────────────────────────────────

  // Met à jour le signal et persiste la session dans sessionStorage
  private ouvrirSession(user: AppUser): void {
    this._user.set(user);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }

  // Restaure la session au rechargement de page (F5, retour PWA)
  private restaurerSession(): AppUser | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as AppUser) : null;
    } catch {
      // JSON corrompu — nettoyage propre
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
  }
}
