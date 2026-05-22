// ─────────────────────────────────────────────────────────────────
// sheets-queue.service.ts — file d'attente persistante hors-ligne
//
// Modifications par rapport à la version d'origine :
//  - Ajout de 'updateRow' : met à jour toute une ligne en un appel
//    (remplace les N appels updateCell du DataService v1)
//  - Interface QueueItem générique : payload typé par order
//  - Scheduler inchangé (setInterval 2s)
//  - Persistance localStorage inchangée
// ─────────────────────────────────────────────────────────────────
import { effect, Injectable, signal } from '@angular/core';
import { GoogleSheetsService, RowConfig, CellConfig, DeleteRowConfig, UpdateRowConfig }
  from './@google-sheets/google-sheets.service';
import { from, EMPTY, of } from 'rxjs';
import { switchMap, map, catchError, filter, tap } from 'rxjs/operators';


export type QueueOrder = 'addRow' | 'updateRow' | 'updateCell' | 'deleteRow';

export type QueuePayload =
  | RowConfig
  | UpdateRowConfig
  | CellConfig
  | DeleteRowConfig;

interface QueueItem {
  id: string;
  order: QueueOrder;
  payload: QueuePayload;
  countError: number;
}

const STORAGE_KEY = 'sheets_queue';
const INTERVAL_MS = 2000;

@Injectable({ providedIn: 'root' })
export class SheetsQueueServiceService {

  private queue = signal<QueueItem[]>([]);
  private online = signal(navigator.onLine);
  private scheduled: ReturnType<typeof setInterval> | null = null;
  private syncing = false;

  constructor(private sheets: GoogleSheetsService) {
    // Restaure la file depuis localStorage au démarrage
    this.queue.set(this.load());

    window.addEventListener('online', () => this.online.set(true));
    window.addEventListener('offline', () => this.online.set(false));

    // Persiste + démarre le scheduler à chaque changement de la file
    effect(() => {
      this.persist();
      if (this.online() && this.queue().length > 0) {
        this.startScheduler();
      }
    });
  }

  // ── API publique ───────────────────────────────────────────────

  enqueue(payload: QueuePayload, order: QueueOrder): void {
    this.queue.update(list => [
      ...list,
      { id: crypto.randomUUID(), order, payload, countError: 0 },
    ]);
  }

  dequeue(): void {
    this.queue.update(list => list.slice(1));
  }

  peek(): QueueItem { return this.queue()[0]; }
  isEmpty(): boolean { return this.queue().length === 0; }
  size(): number { return this.queue().length; }

  /** Vide complètement la file sans envoyer — à utiliser avec précaution */
  clearQueue(): void {
    this.queue.set([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Tente d'envoyer le premier élément de la file.
   * En cas d'erreur réseau, l'élément est conservé pour la prochaine tentative.
   */
  sync(): void {
    if (this.syncing || !this.online() || this.isEmpty()) return;
    this.syncing = true;
    const item = this.peek();

    of(item).pipe(
      filter(i => !!i?.order && !!i?.payload),
      switchMap(i => from(this.dispatch(i)).pipe(map(() => i))),
      tap(i => {
        this.dequeue();
        console.log(`✅ Queue — envoyé : ${i.order} [${i.id}]`);
      }),
      catchError(err => {
        if (item?.countError >=5 || !item.countError) this.dequeue()// éviter de bloquer la file indéfiniment sur un élément problématique
        else item.countError++;
        console.warn(`⚠️ Queue — échec, conservé [${item.id}] :`, err?.message ?? err);
        return EMPTY;
      }),
    ).subscribe({
      complete: () => { this.syncing = false; },
      error: () => { this.syncing = false; },
    });
  }

  // ── Dispatch vers GoogleSheetsService ─────────────────────────

  /**
   * Aiguille vers la bonne méthode selon l'ordre.
   * updateRow est converti en un seul appel batchUpdate côté Sheets.
   */
  private dispatch(item: QueueItem): Promise<void> {
    switch (item.order) {
      case 'addRow':
        return this.sheets.addRow(item.payload as RowConfig);

      case 'updateRow':
        return this.sheets.updateRow(item.payload as UpdateRowConfig);

      case 'updateCell':
        return this.sheets.updateCell(item.payload as CellConfig);

      case 'deleteRow':
        return this.sheets.deleteRow(item.payload as DeleteRowConfig);

      default:
        return Promise.reject(new Error(`Ordre inconnu : ${(item as any).order}`));
    }
  }

  // ── Scheduler ─────────────────────────────────────────────────

  private startScheduler(): void {
    if (this.scheduled) return;
    this.scheduled = setInterval(() => {
      if (this.isEmpty()) {
        clearInterval(this.scheduled!);
        this.scheduled = null;
        return;
      }
      this.sync();
    }, INTERVAL_MS);
  }

  // ── Persistance localStorage ──────────────────────────────────

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue()));
    } catch (e) {
      console.warn('Queue — impossible de persister :', e);
    }
  }

  private load(): QueueItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as QueueItem[]) : [];
    } catch {
      return [];
    }
  }
}