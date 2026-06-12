// data.service.ts — supermarché
// Stratégie : charge 100 lignes à la fois en arrière-plan jusqu'à tout avoir

import { Injectable, inject } from '@angular/core';
import { CacheService } from './cache.service';
import { SheetsQueueServiceService } from './sheets-queue.service';
import { GoogleSheetsService } from './@google-sheets/google-sheets.service';
import {
  Article, AppUser, Ticket, LigneVente, MouvementStock
} from '../models/supermarche.models';
import { ADMIN_TEST } from './auth.service';

// ── Noms des feuilles permanentes ─────────────────────────────
export const SHEET = {
  articles: 'SM_ARTICLES',
  users: 'SM_USERS',
} as const;

// ── Nom dynamique des feuilles mensuelles ─────────────────────
// Exemple : SM_TICKETS_2026_05
export function sheetMonth(prefix: string, date = new Date()): string {
  return `${prefix}_${date.getFullYear()}_${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// ── En-têtes des feuilles ─────────────────────────────────────
export const H = {
  articles: ['code_article', 'nom', 'description', 'prix_achat', 'prix_detail', 'prix_grossiste', 'qte_min_grossiste', 'stock_actuel', 'stock_maximum', 'seuil_alerte'],
  users: ['id', 'username', 'mot_de_passe', 'nom', 'role'],
  tickets: ['id_ticket', 'date_heure', 'type_vente', 'montant_total', 'montant_recu', 'monnaie_rendue', 'id_caissier', 'nom_caissier'],
  lignes: ['id_ligne', 'id_ticket', 'code_article', 'nom_article', 'quantite', 'prix_unitaire_applique', 'tarif_applique', 'sous_total'],
  mouvements: ['id', 'code_article', 'type_mouvement', 'quantite', 'date', 'id_utilisateur', 'reference'],
} as const;

// ── Taille d'un bloc de chargement ────────────────────────────
const BLOC = 100;

@Injectable({ providedIn: 'root' })
export class DataService {

  constructor() {
    console.log("in constructor dataservice")
    this.ensureSheets()
      .then(async () => {
        console.log("end constructor dataservice ")
        await this.chargerUsers()
        await this.ensureAdminTest();
      })
  }


  private cache = inject(CacheService);
  private queue = inject(SheetsQueueServiceService);
  private sheets = inject(GoogleSheetsService);

  // ══════════════════════════════════════════════════════════════
  // DÉMARRAGE — appelé une seule fois au lancement de l'app
  // 1. Crée les feuilles si elles n'existent pas
  // 2. Charge articles + users (nécessaires pour se connecter)
  // 3. Lance en arrière-plan : tickets, lignes, mouvements du mois
  // ══════════════════════════════════════════════════════════════
  async initAppData(): Promise<void> {
    // await this.chargerUsers();
    // await this.ensureAdminTest();
    await this.chargerArticles();

    // Arrière-plan : l'UI est déjà disponible pendant ce chargement
    this.chargerEnArrierePlan(sheetMonth('SM_TICKETS'), H.tickets, (rows) => this.cache.setTickets(this.parse(rows, H.tickets)));
    this.chargerEnArrierePlan(sheetMonth('SM_LIGNES'), H.lignes, (rows) => this.cache.setLignes(this.parse(rows, H.lignes)));
    this.chargerEnArrierePlan(sheetMonth('SM_MOUVEMENTS'), H.mouvements, (rows) => this.cache.setMouvements(this.parse(rows, H.mouvements)));
  }

  // ══════════════════════════════════════════════════════════════
  // CŒUR — Chargement par blocs de 100 lignes
  // Lit la feuille 100 lignes à la fois jusqu'à ne plus rien trouver
  // Appelle onBloc() à chaque bloc pour alimenter le cache au fur et à mesure
  // ══════════════════════════════════════════════════════════════
  private async chargerEnArrierePlan(
    feuille: string,
    headers: readonly string[],
    onBloc: (rows: any[][]) => void
  ): Promise<void> {
    let debut = 2; // ligne 1 = en-têtes, on commence à la ligne 2

    while (true) {
      const plage = `${feuille}!A${debut}:Z${debut + BLOC - 1}`; // ex: !A2:Z101
      const lignes = await this.sheets.getRange(plage);

      if (!lignes?.length) break;       // plus rien → terminé
      onBloc(lignes);                   // alimente le cache avec ce bloc
      if (lignes.length < BLOC) break;  // bloc incomplet → c'était le dernier
      debut += BLOC;                    // passe au bloc suivant
    }
  }

  // ── Chargement articles ────────────────────────────────────────
  private async chargerArticles(): Promise<void> {
    let tous: Article[] = [];
    await this.chargerEnArrierePlan(SHEET.articles, H.articles, (rows) => {
      tous.push(...this.parse<Article>(rows, H.articles));
    });
    tous = tous.map(a => ({ ...a, stock_actuel: +a.stock_actuel, seuil_alerte: +a.seuil_alerte, stock_maximum: +a.stock_maximum })); // convertit les champs numériques
    this.cache.setArticles(tous);
  }

  // ── Chargement users ───────────────────────────────────────────
  private async chargerUsers(): Promise<void> {
    const tous: AppUser[] = [];
    await this.chargerEnArrierePlan(SHEET.users, H.users, (rows) => {
      tous.push(...this.parse<AppUser>(rows, H.users));
    });
    this.cache.setUsers(tous);
  }

  // ── Charge un mois précis à la demande (historique) ───────────
  // Ex : loadMonth(2026, 4) → avril 2026
  async loadMonth(year: number, month: number): Promise<{ tickets: Ticket[]; lignes: LigneVente[], mouvements: MouvementStock[] }> {
    const d = new Date(year, month - 1);
    const tickets: Ticket[] = [];
    const lignes: LigneVente[] = [];
    const mouvements: MouvementStock[] = [];

    await this.chargerEnArrierePlan(sheetMonth('SM_TICKETS', d), H.tickets, (rows) => tickets.push(...this.parse<Ticket>(rows, H.tickets)));
    await this.chargerEnArrierePlan(sheetMonth('SM_LIGNES', d), H.lignes, (rows) => lignes.push(...this.parse<LigneVente>(rows, H.lignes)));
    await this.chargerEnArrierePlan(sheetMonth('SM_MOUVEMENTS', d), H.mouvements, (rows) => mouvements.push(...this.parse<MouvementStock>(rows, H.mouvements)));

    return { tickets, lignes, mouvements };
  }

  // ── Articles ───────────────────────────────────────────────────

  async addArticle(a: Article): Promise<void> {
    this.cache.upsertArticle(a);
    this.queue.enqueue({ sheetName: SHEET.articles, rowData: this.toRow(a, H.articles) }, 'addRow');
  }

  async updateArticle(a: Article): Promise<void> {
    this.cache.upsertArticle(a);
    const row = await this.sheets.findRowById(SHEET.articles, a.code_article);
    if (row === -1) return this.addArticle(a);
    this.queue.enqueue({ sheetName: SHEET.articles, row, col: 1, values: this.toRow(a, H.articles) }, 'updateRow');
  }

  async deleteArticle(code: string): Promise<void> {
    this.cache.removeArticle(code);
    const row = await this.sheets.findRowById(SHEET.articles, code);
    if (row === -1) return;
    this.queue.enqueue({ sheetName: SHEET.articles, rowIndex: row - 1 }, 'deleteRow');
  }

  // Ajoute du stock + crée un mouvement ENTREE automatiquement
  async reapprovisionner(code: string, qte: number, idUser: string): Promise<void> {
    const article = this.cache.getArticles().find(a => a.code_article === code);
    if (!article) return;
    await this.updateArticle({ ...article, stock_actuel: +article.stock_actuel + qte });
    this.addMouvement({ id: `MV-${Date.now()}`, code_article: code, type_mouvement: 'ENTREE', quantite: qte, date: new Date().toISOString(), id_utilisateur: idUser, reference: 'REAPPRO' });
  }

  addLignes(l: LigneVente): void {
    this.cache.addLignes([l]);
    this.queue.enqueue({ sheetName: sheetMonth('SM_LIGNES'), rowData: this.toRow(l, H.lignes) }, 'addRow');
  }
  addTicket(t: Ticket): void {
    this.cache.addTicket(t);
    this.queue.enqueue({ sheetName: sheetMonth('SM_TICKETS'), rowData: this.toRow(t, H.tickets) }, 'addRow');
  }
  // ── Vente : ticket + lignes + décréments stock ─────────────────
  async enregistrerVente(ticket: Ticket, lignes: LigneVente[]): Promise<void> {

    // ── 1. VALIDATION complète AVANT toute modification ───────────
    // Si un article manque, on sort immédiatement sans rien toucher
    const articles = lignes.map(l => {
      const art = this.cache.getArticles().find(a => a.code_article === l.code_article);
      if (!art) throw new Error(`Article introuvable : ${l.code_article}`);
      return art;
    });

    // ── 2. PRÉPARATION des données (aucun effet de bord ici) ───────
    // On calcule tout ce qu'on va écrire avant d'écrire quoi que ce soit
    const articlesUpdates = articles.map((art, i) => ({
      ...art,
      stock_actuel: +art.stock_actuel - lignes[i].quantite,
    }));

    const mouvements: MouvementStock[] = lignes.map((l, i) => ({
      id: `MV-${Date.now()}-${l.code_article}`,
      code_article: l.code_article,
      type_mouvement: 'SORTIE_VENTE' as const,
      quantite: l.quantite,
      date: ticket.date_heure,
      id_utilisateur: ticket.id_caissier,
      reference: ticket.id_ticket,
    }));

    // ── 3. COMMIT — tout s'applique d'un coup ─────────────────────
    // On n'arrive ici que si la validation a réussi
    this.addTicket(ticket);
    lignes.forEach(l => this.addLignes(l));
    articlesUpdates.forEach(a => this.updateArticle(a));
    mouvements.forEach(m => this.addMouvement(m));
  }

  // ── Users ──────────────────────────────────────────────────────

  addUser(u: AppUser): void {
    this.cache.upsertUser(u);
    this.queue.enqueue({ sheetName: SHEET.users, rowData: this.toRow(u, H.users) }, 'addRow');
  }

  updateUser(u: AppUser): void {
    this.cache.upsertUser(u);
    this.sheets.findRowById(SHEET.users, u.id).then(row => {
      if (row === -1) return this.addUser(u);
      this.queue.enqueue({ sheetName: SHEET.users, row, col: 1, values: this.toRow(u, H.users) }, 'updateRow');
    });
  }

  deleteUser(id: string): void {
    this.cache.removeUser(id);
    this.sheets.findRowById(SHEET.users, id).then(row => {
      if (row === -1) return;
      this.queue.enqueue({ sheetName: SHEET.users, rowIndex: row - 1 }, 'deleteRow');
    });
  }

  getUsers(): AppUser[] { return this.cache.getUsers(); }

  // ── Helpers privés ─────────────────────────────────────────────

  // Si aucun user au premier démarrage → crée l'admin de test
  private async ensureAdminTest(): Promise<void> {
    if (this.cache.getUsers().length > 0) return;
    this.cache.upsertUser(ADMIN_TEST);
    this.queue.enqueue({ sheetName: SHEET.users, rowData: this.toRow(ADMIN_TEST, H.users) }, 'addRow');
  }

  private addMouvement(m: MouvementStock): void {
    this.cache.addMouvement(m);
    this.queue.enqueue({ sheetName: sheetMonth('SM_MOUVEMENTS'), rowData: this.toRow(m, H.mouvements) }, 'addRow');
  }

  // Convertit un objet en tableau selon l'ordre des en-têtes
  private toRow(obj: any, headers: readonly string[]): any[] {
    return headers.map(k => obj[k] ?? '');
  }

  // Convertit des lignes brutes Sheets en objets typés (sans la ligne d'en-tête)
  private parse<T>(rows: any[][], headers: readonly string[]): T[] {
    if (!rows?.length) return [];
    return rows
      .filter(r => r.length && r[0])
      .map(row => {
        const obj: any = {};
        headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });
        return obj as T;
      });
  }

  // Crée les feuilles du mois si elles n'existent pas encore dans Sheets
  async ensureSheets(): Promise<void> {
    await Promise.all([
      this.sheets.createSheet({ sheetName: SHEET.articles, headers: [...H.articles] }),
      this.sheets.createSheet({ sheetName: SHEET.users, headers: [...H.users] }),
      this.sheets.createSheet({ sheetName: sheetMonth('SM_TICKETS'), headers: [...H.tickets] }),
      this.sheets.createSheet({ sheetName: sheetMonth('SM_LIGNES'), headers: [...H.lignes] }),
      this.sheets.createSheet({ sheetName: sheetMonth('SM_MOUVEMENTS'), headers: [...H.mouvements] }),
    ]);
  }
  // Vide tout le cache local (utile avant un rechargement forcé depuis Sheets)
  invalidateCache(): void {
    this.cache.setArticles([]);
    this.cache.setUsers([]);
    this.cache.setTickets([]);
    this.cache.setLignes([]);
    this.cache.setMouvements([]);
  }
}