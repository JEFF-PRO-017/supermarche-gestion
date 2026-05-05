// data.service.ts — supermarché
import { Injectable, inject } from '@angular/core';
import { CacheService } from './cache.service';
import { SheetsQueueServiceService } from './sheets-queue.service';
import { GoogleSheetsService } from './@google-sheets/google-sheets.service';
import {
  Article, AppUser, Ticket, LigneVente,
  MouvementStock, TypeMouvement
} from '../models/supermarche.models';
import { ADMIN_TEST } from './auth.service';

// ── Feuilles permanentes ──────────────────────────────────────
export const SHEET = {
  articles:  'SM_ARTICLES',
  users:     'SM_USERS',
} as const;

// ── Feuilles mensuelles : nom dynamique ───────────────────────
// Format : SM_TICKETS_2026_05
export function sheetMonth(prefix: string, date = new Date()): string {
  return `${prefix}_${date.getFullYear()}_${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// ── En-têtes des feuilles ─────────────────────────────────────
export const H = {
  articles: [
    'code_article', 'nom', 'description',
    'prix_achat', 'prix_detail', 'prix_grossiste',
    'qte_min_grossiste', 'stock_actuel', 'stock_maximum', 'seuil_alerte',
  ],
  users: ['id', 'username', 'mot_de_passe', 'nom', 'role'],
  tickets: [
    'id_ticket', 'date_heure', 'type_vente',
    'montant_total', 'montant_recu', 'monnaie_rendue',
    'id_caissier', 'nom_caissier',
  ],
  lignes: [
    'id_ligne', 'id_ticket', 'code_article', 'nom_article',
    'quantite', 'prix_unitaire_applique', 'tarif_applique', 'sous_total',
  ],
  mouvements: [
    'id', 'code_article', 'type_mouvement',
    'quantite', 'date', 'id_utilisateur', 'reference',
  ],
} as const;

@Injectable({ providedIn: 'root' })
export class DataService {

  private cache  = inject(CacheService);
  private queue  = inject(SheetsQueueServiceService);
  private sheets = inject(GoogleSheetsService);

  // ── Init ───────────────────────────────────────────────────────
  // Appelé une seule fois au démarrage (app.component ou auth guard)
  async initAppData(): Promise<void> {
    await this.ensureSheets();

    // Données permanentes
    const [rawArt, rawUsers] = await this.batchFetch([
      `${SHEET.articles}!A:J`,
      `${SHEET.users}!A:E`,
    ]);
    this.cache.setArticles(this.parse<Article>(rawArt, H.articles));
    this.cache.setUsers(this.parse<AppUser>(rawUsers, H.users));

    // Si aucun utilisateur dans Sheets, créer l'admin de test automatiquement
    await this.ensureAdminTest();

    // Données du mois courant (tickets + lignes + mouvements)
    await this.loadCurrentMonth();
  }

  // Charge tickets, lignes, mouvements du mois courant
  async loadCurrentMonth(): Promise<void> {
    const [rawT, rawL, rawM] = await this.batchFetch([
      `${sheetMonth('SM_TICKETS')}!A:H`,
      `${sheetMonth('SM_LIGNES')}!A:H`,
      `${sheetMonth('SM_MOUVEMENTS')}!A:G`,
    ]);
    this.cache.setTickets(this.parse<Ticket>(rawT, H.tickets));
    this.cache.setLignes(this.parse<LigneVente>(rawL, H.lignes));
    this.cache.setMouvements(this.parse<MouvementStock>(rawM, H.mouvements));
  }

  // Charge un mois précis (historique) — ex: 2026, 4 = avril 2026
  async loadMonth(year: number, month: number): Promise<{
    tickets: Ticket[]; lignes: LigneVente[];
  }> {
    const d = new Date(year, month - 1);
    const [rawT, rawL] = await this.batchFetch([
      `${sheetMonth('SM_TICKETS', d)}!A:H`,
      `${sheetMonth('SM_LIGNES', d)}!A:H`,
    ]);
    return {
      tickets: this.parse<Ticket>(rawT, H.tickets),
      lignes:  this.parse<LigneVente>(rawL, H.lignes),
    };
  }

  // ── Articles ───────────────────────────────────────────────────

  async addArticle(a: Article): Promise<void> {
    this.cache.upsertArticle(a);
    this.queue.enqueue(
      { sheetName: SHEET.articles, rowData: this.toRow(a, H.articles) },
      'addRow'
    );
  }

  async updateArticle(a: Article): Promise<void> {
    this.cache.upsertArticle(a);
    const row = await this.sheets.findRowById(SHEET.articles, a.code_article);
    if (row === -1) return this.addArticle(a);
    this.queue.enqueue(
      { sheetName: SHEET.articles, row, col: 1, values: this.toRow(a, H.articles) },
      'updateRow'
    );
  }

  async deleteArticle(code: string): Promise<void> {
    this.cache.removeArticle(code);
    const row = await this.sheets.findRowById(SHEET.articles, code);
    if (row === -1) return;
    this.queue.enqueue({ sheetName: SHEET.articles, rowIndex: row - 1 }, 'deleteRow');
  }

  // Réapprovisionner : met à jour stock + crée mouvement ENTREE
  async reapprovisionner(code: string, qte: number, idUser: string): Promise<void> {
    const article = this.cache.getArticles().find(a => a.code_article === code);
    if (!article) return;

    const updated = { ...article, stock_actuel: article.stock_actuel + qte };
    await this.updateArticle(updated);
    this.cache.incrementStock(code, qte);

    const mouvement: MouvementStock = {
      id: `MV-${Date.now()}`,
      code_article: code,
      type_mouvement: 'ENTREE',
      quantite: qte,
      date: new Date().toISOString(),
      id_utilisateur: idUser,
      reference: 'REAPPRO',
    };
    this.addMouvement(mouvement);
  }

  // ── Vente complète (ticket + lignes + mouvements stock) ────────
  async enregistrerVente(ticket: Ticket, lignes: LigneVente[]): Promise<void> {
    const sheetT = sheetMonth('SM_TICKETS');
    const sheetL = sheetMonth('SM_LIGNES');
    const sheetMv = sheetMonth('SM_MOUVEMENTS');

    // 1. Ticket
    this.cache.addTicket(ticket);
    this.queue.enqueue(
      { sheetName: sheetT, rowData: this.toRow(ticket, H.tickets) },
      'addRow'
    );

    // 2. Lignes + décréments stock
    for (const l of lignes) {
      this.cache.addLignes([l]);
      this.queue.enqueue(
        { sheetName: sheetL, rowData: this.toRow(l, H.lignes) },
        'addRow'
      );

      // Décrément stock article
      const art = this.cache.getArticles().find(a => a.code_article === l.code_article);
      if (art) {
        const updated = { ...art, stock_actuel: Math.max(0, art.stock_actuel - l.quantite) };
        this.cache.upsertArticle(updated);
        this.queue.enqueue(
          { sheetName: SHEET.articles,
            row: -1, // findRowById appelé par updateArticle
            col: 1, values: this.toRow(updated, H.articles) },
          'updateRow'
        );

        // Mouvement SORTIE_VENTE
        const mv: MouvementStock = {
          id: `MV-${Date.now()}-${l.code_article}`,
          code_article: l.code_article,
          type_mouvement: 'SORTIE_VENTE',
          quantite: l.quantite,
          date: ticket.date_heure,
          id_utilisateur: ticket.id_caissier,
          reference: ticket.id_ticket,
        };
        this.cache.addMouvement(mv);
        this.queue.enqueue(
          { sheetName: sheetMv, rowData: this.toRow(mv, H.mouvements) },
          'addRow'
        );
      }
    }
  }

  // ── Users ──────────────────────────────────────────────────────

  addUser(u: AppUser): void {
    this.cache.upsertUser(u);
    this.queue.enqueue(
      { sheetName: SHEET.users, rowData: this.toRow(u, H.users) },
      'addRow'
    );
  }

  updateUser(u: AppUser): void {
    this.cache.upsertUser(u);
    this.sheets.findRowById(SHEET.users, u.id).then(row => {
      if (row === -1) return this.addUser(u);
      this.queue.enqueue(
        { sheetName: SHEET.users, row, col: 1, values: this.toRow(u, H.users) },
        'updateRow'
      );
    });
  }

  deleteUser(id: string): void {
    this.cache.removeUser(id);
    this.sheets.findRowById(SHEET.users, id).then(row => {
      if (row === -1) return;
      this.queue.enqueue({ sheetName: SHEET.users, rowIndex: row - 1 }, 'deleteRow');
    });
  }

  // ── Helpers privés ─────────────────────────────────────────────

  // Si la feuille SM_USERS est vide, insère l'admin de test dans Sheets et le cache.
  // Cela garantit qu'on peut toujours se connecter lors du premier démarrage.
  private async ensureAdminTest(): Promise<void> {
    if (this.cache.getUsers().length > 0) return; // des users existent déjà — rien à faire
    this.cache.upsertUser(ADMIN_TEST);
    this.queue.enqueue(
      { sheetName: SHEET.users, rowData: this.toRow(ADMIN_TEST, H.users) },
      'addRow'
    );
  }

  private addMouvement(m: MouvementStock): void {
    this.cache.addMouvement(m);
    this.queue.enqueue(
      { sheetName: sheetMonth('SM_MOUVEMENTS'), rowData: this.toRow(m, H.mouvements) },
      'addRow'
    );
  }

  private toRow(obj: any, headers: readonly string[]): any[] {
    return headers.map(k => obj[k] ?? '');
  }

  private parse<T>(rows: any[][], headers: readonly string[]): T[] {
    if (!rows?.length) return [];
    return rows.slice(1)
      .filter(r => r.length && r[0])
      .map(row => {
        const obj: any = {};
        headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });
        return obj as T;
      });
  }

  private async batchFetch(ranges: string[]): Promise<any[][][]> {
    const res = await this.sheets.batchGet(ranges);
    // batchGet retourne [data, meta, data, meta…] — on garde les data
    return res.filter((_, i) => i % 2 === 0);
  }

  // Crée toutes les feuilles nécessaires si elles n'existent pas
  async ensureSheets(): Promise<void> {
    debugger
    const tasks = [
      { sheetName: SHEET.articles,             headers: [...H.articles] },
      { sheetName: SHEET.users,                headers: [...H.users] },
      { sheetName: sheetMonth('SM_TICKETS'),   headers: [...H.tickets] },
      { sheetName: sheetMonth('SM_LIGNES'),    headers: [...H.lignes] },
      { sheetName: sheetMonth('SM_MOUVEMENTS'),headers: [...H.mouvements] },
    ];
    await Promise.all(tasks.map(t => this.sheets.createSheet(t)));
  }
}
