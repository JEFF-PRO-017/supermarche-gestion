// seed.component.ts — page de chargement des données de test
// Accessible sur http://localhost:4200/seed (admin uniquement)
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../../core/services/data.service';
import { ARTICLES_TEST, USERS_TEST } from '../../../seed-test';
import { hash } from 'bcryptjs';
import { UsersListComponent } from '@features/users/users-list/users-list.component';

@Component({
  selector: 'app-seed',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="sm-container" style="padding-top:2rem">
      <div class="sm-card">
        <h2 class="sm-page-title mb-3">Chargement données de test</h2>

        @if (log().length) {
          <div style="background:var(--sm-bg2);border-radius:8px;
                      padding:.875rem;font-size:12px;font-family:monospace;
                      max-height:300px;overflow-y:auto;margin-bottom:1rem">
            @for (line of log(); track $index) {
              <div [style.color]="line.startsWith('✓') ? 'var(--sm-primary-dk)' : 'var(--sm-text-2)'">
                {{ line }}
              </div>
            }
          </div>
        }

        <div class="d-flex gap-2 flex-wrap">
          <button class="btn-sm-primary" [disabled]="loading()"
                  (click)="lancerSeed()">
            @if (loading()) {
              <span class="spinner-border spinner-border-sm me-2"></span>
              Chargement...
            } @else {
              <i class="fa-solid fa-database me-2"></i>
              Charger les données de test
            }
          </button>
          <button class="btn-sm-outline" routerLink="/catalogue">
            Voir le catalogue
          </button>
        </div>
      </div>
    </div>
  `,
})
export class SeedComponent {
  private data$ = inject(DataService);
  loading = signal(false);
  log = signal<string[]>([]);

  async lancerSeed(): Promise<void> {
    this.loading.set(true);
    this.log.set(['Démarrage...']);

    await this.data$.initAppData();
    this.addLog('Sheets initialisées');

    // Charger les articles
    for (const a of ARTICLES_TEST) {
      await this.data$.addArticle(a as any);
      this.addLog(`✓ Article ${a.code_article} — ${a.nom}`);
    }

    // Charger les utilisateurs de test
    for (const u of USERS_TEST) {
      const user =  { ...u, mot_de_passe: await hash(u.mot_de_passe, 5) };
      this.data$.addUser(user as any);
      this.addLog(`✓ Utilisateur ${u.username} (${u.role})`);
    }

    this.addLog('--- Terminé ---');
    this.loading.set(false);
  }

  private addLog(msg: string): void {
    this.log.update(l => [...l, msg]);
  }
}