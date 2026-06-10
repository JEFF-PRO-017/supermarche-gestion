// auth.service.ts
import { Injectable, inject, signal, computed, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { CacheService } from './cache.service';
import { AppUser, Role } from '../models/supermarche.models';
import { DataService } from './data.service';
import { compare } from 'bcryptjs';

const SESSION_KEY = 'sm_user';
// private readonly STORAGE_LAST_ACTIVITY = 'sm_last_activity';

// ── Délais d'inactivité ───────────────────────────────────────
const DELAI_PROD = 20 * 60 * 1000; // 20 minutes en production
const DELAI_TEST = 2 * 60 * 1000; //  2 minutes pour les tests
const DELAI = DELAI_PROD;            // ← changer en DELAI_PROD pour la prod

// ── Événements qui prouvent que l'utilisateur est actif ───────
const EVENEMENTS_ACTIVITE = ['click', 'keydown', 'touchstart', 'scroll'] as const;

export const ADMIN_TEST: AppUser = {
  id: 'USR-ADMIN-TEST-2',
  username: 'admin',
  mot_de_passe: '$2b$05$QUbszWX6GvpwzIP/HFW.KuOr5Yr3NYwuVpu4.9BgRYe5puIiuip4u',
  nom: 'Administrateur Test',
  role: 'ADMIN',
};

@Injectable({ providedIn: 'root' })
export class AuthService {

  private router = inject(Router);
  private zone = inject(NgZone);
  private $data = inject(DataService);

  private _user = signal<AppUser | null>(this.restaurerSession());
  private timer: any;

  readonly user = this._user.asReadonly();
  readonly role = computed<Role | null>(() => this._user()?.role ?? null);
  readonly isAdmin = computed(() => this._user()?.role === 'ADMIN');
  readonly isGerant = computed(() =>
    this._user()?.role === 'ADMIN' || this._user()?.role === 'GERANT'
  );

  isLoggedIn(): boolean { return this._user() !== null; }

  // ── Connexion ──────────────────────────────────────────────────
  async login(username: string, password: string): Promise<boolean> {
    try {
      const u = this.$data.getUsers().find(x => x.username === username);
      if (u) {
        const ok = await compare(password, u.mot_de_passe);
        if (ok) {
          await this.$data.initAppData();
          this.ouvrirSession(u);
          return true;
        }
      }
      if (username === ADMIN_TEST.username
        && await compare(password, ADMIN_TEST.mot_de_passe)
      ) {
        await this.$data.initAppData();
        this.ouvrirSession(ADMIN_TEST);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  // ── Déconnexion ────────────────────────────────────────────────
  logout(): void {
    this.arreterSurveillance();
    this._user.set(null);
    this.$data.invalidateCache()
    sessionStorage.removeItem(SESSION_KEY);
    this.router.navigate(['/login']);
  }

  // ── Inactivité — démarre la surveillance après connexion ───────
  // On sort de la zone Angular pour que mousemove/scroll ne déclenchent
  // pas la détection de changements à chaque événement (perf mobile++)
  private demarrerSurveillance(): void {
    console.log('[AuthService] Démarrage de la surveillance d\'inactivité');
    this.zone.runOutsideAngular(() => {
      EVENEMENTS_ACTIVITE.forEach(e =>
        window.addEventListener(e, this.onActivite, { passive: true })
      );
      this.resetTimer();
    });
  }

  // Nettoie les listeners et le timer à la déconnexion
  private arreterSurveillance(): void {
    clearTimeout(this.timer);
    EVENEMENTS_ACTIVITE.forEach(e =>
      window.removeEventListener(e, this.onActivite)
    );
  }

  // Réinitialise le timer à chaque signe d'activité
  // Défini en arrow function pour conserver le contexte `this` dans removeEventListener
  private onActivite = (): void => {
    this.resetTimer();
  };

  private resetTimer(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      // On rentre dans la zone Angular pour que le router et les signals fonctionnent
      this.zone.run(() => {
        console.info('[AuthService] Déconnexion pour inactivité');
        this.logout();
      });
    }, DELAI);
  }

  // ── Helpers privés ─────────────────────────────────────────────

  private ouvrirSession(user: AppUser): void {
    this._user.set(user);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    this.demarrerSurveillance(); // démarre la surveillance dès la connexion
  }

  private restaurerSession(): AppUser | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      // Session restaurée (F5 / retour PWA) → relance la surveillance
      setTimeout(() => this.demarrerSurveillance());
      return JSON.parse(raw) as AppUser;
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
  }
}