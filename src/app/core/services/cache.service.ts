// cache.service.ts — signaux supermarché
import { Injectable, signal, computed } from '@angular/core';
import { Article, AppUser, Ticket, LigneVente, MouvementStock, AlerteStock } from '../models/supermarche.models';

@Injectable({ providedIn: 'root' })
export class CacheService {

  // ── Signaux bruts ──────────────────────────────────────────────
  private _articles   = signal<Article[]>([]);
  private _users      = signal<AppUser[]>([]);
  private _tickets    = signal<Ticket[]>([]);
  private _lignes     = signal<LigneVente[]>([]);
  private _mouvements = signal<MouvementStock[]>([]);

  // ── Computed : articles en alerte ─────────────────────────────
  readonly alertes = computed<AlerteStock[]>(() =>
    this._articles()
      .filter(a => a.stock_actuel <= Math.floor(a.seuil_alerte * 1.5))
      .map(a => ({
        code_article: a.code_article,
        nom: a.nom,
        stock_actuel: a.stock_actuel,
        seuil_alerte: a.seuil_alerte,
        niveau: a.stock_actuel <= a.seuil_alerte ? 'CRITIQUE' : 'FAIBLE',
      } as AlerteStock))
  );

  // ── Computed : tickets enrichis avec leurs lignes ─────────────
  readonly ticketsAvecLignes = computed(() => {
    const lignesIdx = new Map<string, LigneVente[]>();
    for (const l of this._lignes()) {
      const arr = lignesIdx.get(l.id_ticket);
      if (arr) arr.push(l); else lignesIdx.set(l.id_ticket, [l]);
    }
    return this._tickets().map(t => ({
      ...t,
      lignes: lignesIdx.get(t.id_ticket) ?? [],
    }));
  });

  // ── Getters ────────────────────────────────────────────────────
  getArticles()   { return this._articles(); }
  getUsers()      { return this._users(); }
  getTickets()    { return this._tickets(); }
  getLignes()     { return this._lignes(); }
  getMouvements() { return this._mouvements(); }

  // ── Setters ────────────────────────────────────────────────────
  setArticles(d: Article[])       { this._articles.set(d); }
  setUsers(d: AppUser[])          { this._users.set(d); }
  setTickets(d: Ticket[])         { this._tickets.set(d); }
  setLignes(d: LigneVente[])      { this._lignes.set(d); }
  setMouvements(d: MouvementStock[]) { this._mouvements.set(d); }

  // ── Upsert ─────────────────────────────────────────────────────
  upsertArticle(a: Article)    { this._articles.update(l => upsert(l, a, 'code_article')); }
  removeArticle(code: string)  { this._articles.update(l => l.filter(x => x.code_article !== code)); }

  upsertUser(u: AppUser)       { this._users.update(l => upsert(l, u, 'id')); }
  removeUser(id: string)       { this._users.update(l => l.filter(x => x.id !== id)); }

  addTicket(t: Ticket)         { this._tickets.update(l => [t, ...l]); }
  addLignes(ls: LigneVente[])  { this._lignes.update(l => [...ls, ...l]); }
  addMouvement(m: MouvementStock) { this._mouvements.update(l => [m, ...l]); }

  // Décrémente le stock en mémoire après vente
  decrementStock(code: string, qte: number) {
    this._articles.update(l =>
      l.map(a => a.code_article === code
        ? { ...a, stock_actuel: Math.max(0, a.stock_actuel - qte) }
        : a
      )
    );
  }

  // Incrémente le stock après réappro
  // incrementStock(code: string, qte: number) {
  //   this._articles.update(l =>
  //     l.map(a => a.code_article === code
  //       ? { ...a, stock_actuel: a.stock_actuel + qte }
  //       : a
  //     )
  //   );
  // }

  // ── Invalidation ───────────────────────────────────────────────
  invalidateAll() {
    this._articles.set([]); this._users.set([]);
    this._tickets.set([]); this._lignes.set([]);
    this._mouvements.set([]);
  }
}

// Helper générique upsert
function upsert<T>(list: T[], item: T, key: keyof T): T[] {
  const idx = list.findIndex(x => x[key] === (item as any)[key]);
  return idx === -1 ? [...list, item] : list.map((x, i) => i === idx ? item : x);
}
