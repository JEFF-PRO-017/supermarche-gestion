// ─────────────────────────────────────────────────────────────────
// google-sheets.service.ts
//
// Modification par rapport à la version d'origine :
//  - Ajout de updateRow() : écrit toute une ligne en un seul appel
//    PUT values (remplace les N appels updateCell du DataService v1)
//  - findRowById retourne -1 si absent (cohérent avec DataService)
//  - Tout le reste est inchangé
// ─────────────────────────────────────────────────────────────────
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import * as jose from 'jose';
import { environment } from '../../../../environments/environment';

// ── Types d'entrée ────────────────────────────────────────────────

export interface SheetConfig   { sheetName: string; headers: string[]; }
export interface RowConfig     { sheetName: string; rowData: any[]; }
export interface UpdateRowConfig {
  sheetName: string;
  row:    number;   // ligne Sheets 1-based
  col:    number;   // colonne de départ (1 = A)
  values: any[];    // valeurs dans l'ordre des en-têtes
}
export interface CellConfig    { sheetName: string; row: number; col: number; value: any; }
export interface DeleteRowConfig { sheetName: string; rowIndex: number; }

// ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class GoogleSheetsService {

  private readonly BASE  = 'https://sheets.googleapis.com/v4/spreadsheets';
  private readonly SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
  private token:  string | null = null;
  private expiry  = 0;

  constructor(private http: HttpClient) {
    // this.refreshToken();
  }

  // ── Auth JWT ─────────────────────────────────────────────────

  private async refreshToken(): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const pk  = await jose.importPKCS8(
      environment.googlePrivateKey.replace(/\\n/g, '\n'), 'RS256'
    );
    const jwt = await new jose.SignJWT({ scope: this.SCOPE })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(environment.googleServiceAccountEmail)
      .setAudience('https://oauth2.googleapis.com/token')
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(pk);

    const res: any = await firstValueFrom(
      this.http.post('https://oauth2.googleapis.com/token', null, {
        params: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }
      })
    );
    this.token  = res.access_token;
    this.expiry = now + 3500;
  }

  private async headers(): Promise<HttpHeaders> {
    if (!this.token || Math.floor(Date.now() / 1000) >= this.expiry) {
      await this.refreshToken();
    }
    return new HttpHeaders({
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    });
  }

  // ── Helpers URL ──────────────────────────────────────────────

  private enc(name: string): string { return encodeURIComponent(name); }
  private url(path: string):  string { return `${this.BASE}/${environment.spreadsheetId}${path}`; }
  private rangeNotation(col: number, row: number): string {
    return `${this.colLetter(col)}${row}`;
  }

  // ── CRUD ─────────────────────────────────────────────────────

  /** Crée la feuille si elle n'existe pas encore, puis écrit les en-têtes */
  async createSheet(cfg: SheetConfig): Promise<void> {
    const hdrs = await this.headers();
    const file: any = await firstValueFrom(
      this.http.get(this.url(''), { headers: hdrs })
    );
    if (file.sheets?.some((s: any) => s.properties?.title === cfg.sheetName)) return;

    await firstValueFrom(
      this.http.post(this.url(':batchUpdate'), {
        requests: [{ addSheet: { properties: { title: cfg.sheetName } } }]
      }, { headers: hdrs })
    );
    await firstValueFrom(
      this.http.put(
        this.url(`/values/${this.enc(cfg.sheetName)}!A1?valueInputOption=RAW`),
        { values: [cfg.headers] },
        { headers: hdrs }
      )
    );
  }

  /** Ajoute une ligne à la suite du tableau */
  async addRow(cfg: RowConfig): Promise<void> {
    const hdrs = await this.headers();
    await firstValueFrom(
      this.http.post(
        this.url(`/values/${this.enc(cfg.sheetName)}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`),
        { values: [cfg.rowData] },
        { headers: hdrs }
      )
    );
  }

  /**
   * Met à jour toute une ligne en un seul appel PUT.
   * Remplace les N appels updateCell de l'ancienne version.
   */
  async updateRow(cfg: UpdateRowConfig): Promise<void> {
    const hdrs  = await this.headers();
    const start = this.rangeNotation(cfg.col, cfg.row);
    const end   = this.rangeNotation(cfg.col + cfg.values.length - 1, cfg.row);
    const range = `${this.enc(cfg.sheetName)}!${start}:${end}`;
    await firstValueFrom(
      this.http.put(
        this.url(`/values/${range}?valueInputOption=RAW`),
        { values: [cfg.values] },
        { headers: hdrs }
      )
    );
  }

  /** Met à jour une seule cellule */
  async updateCell(cfg: CellConfig): Promise<void> {
    const hdrs = await this.headers();
    const cell = this.rangeNotation(cfg.col, cfg.row);
    await firstValueFrom(
      this.http.put(
        this.url(`/values/${this.enc(cfg.sheetName)}!${cell}?valueInputOption=RAW`),
        { values: [[cfg.value]] },
        { headers: hdrs }
      )
    );
  }

  /** Supprime une ligne par son index (0-based) */
  async deleteRow(cfg: DeleteRowConfig): Promise<void> {
    if (cfg.rowIndex === 0) throw new Error('Impossible de supprimer la ligne d\'en-têtes');
    const hdrs    = await this.headers();
    const sheetId = await this.getSheetId(cfg.sheetName);
    await firstValueFrom(
      this.http.post(this.url(':batchUpdate'), {
        requests: [{
          deleteDimension: {
            range: {
              sheetId,
              dimension:  'ROWS',
              startIndex: cfg.rowIndex,
              endIndex:   cfg.rowIndex + 1,
            }
          }
        }]
      }, { headers: hdrs })
    );
  }

  /**
   * Cherche une valeur dans la colonne A et retourne le numéro de ligne (1-based).
   * Retourne -1 si absent.
   * Utilisé par DataService avant chaque update/delete (système distribué).
   */
  async findRowById(sheetName: string, id: any): Promise<number> {
    const hdrs = await this.headers();
    const res: any = await firstValueFrom(
      this.http.get(
        this.url(`/values/${this.enc(sheetName)}!A:A`),
        { headers: hdrs }
      )
    );
    const rows: any[][] = res.values ?? [];
    const idx = rows.findIndex(r => String(r[0]) === String(id));
    return idx === -1 ? -1 : idx + 1; // 1-based, ligne 1 = en-têtes
  }

  async findRowByValue(sheetName: string, col: number, value: any): Promise<number> {
    const hdrs = await this.headers();
    const colLetter = this.colLetter(col);
    const res: any = await firstValueFrom(
      this.http.get(
        this.url(`/values/${this.enc(sheetName)}!${colLetter}:${colLetter}`),
        { headers: hdrs }
      )
    );
    const rows: any[][] = res.values ?? [];
    const idx = rows.findIndex(r => String(r[0]) === String(value));
    return idx === -1 ? -1 : idx + 1; // 1-based, ligne 1 = en-têtes
  }

  /**
   * batchGet : retourne les données dans le même ordre que les plages demandées.
   * Intercale les noms de plage entre les tableaux de données (comportement d'origine).
   */
  async batchGet(ranges: string[]): Promise<any[][]> {
    const hdrs = await this.headers();
    const params = ranges.map(r => encodeURIComponent(r)).join('&ranges=');
    const res: any = await firstValueFrom(
      this.http.get(
        this.url(`/values:batchGet?ranges=${params}`),
        { headers: hdrs }
      )
    );
    const out: any[][] = [];
    for (const vr of (res.valueRanges ?? [])) {
      out.push(vr.values ?? []);
      out.push(vr.range?.split('!')?.[0]?.replace(/'/g, '') ?? '');
    }
    return out;
  }

  /** Lit toute une feuille (colonnes A:Z) */
  async fetchRaw(sheetName: string): Promise<any[][]> {
    const hdrs = await this.headers();
    const res: any = await firstValueFrom(
      this.http.get(
        this.url(`/values/${this.enc(sheetName)}!A:Z`),
        { headers: hdrs }
      )
    );
    return res.values ?? [];
  }

  // ── Helpers internes ─────────────────────────────────────────

  private async getSheetId(sheetName: string): Promise<number> {
    const hdrs = await this.headers();
    const res: any = await firstValueFrom(
      this.http.get(this.url(''), { headers: hdrs })
    );
    const sheet = res.sheets?.find((s: any) => s.properties?.title === sheetName);
    if (!sheet) throw new Error(`Feuille "${sheetName}" introuvable`);
    return sheet.properties.sheetId;
  }

  /** Convertit un numéro de colonne (1-based) en lettre(s) Excel */
  private colLetter(col: number): string {
    let s = '';
    while (col > 0) {
      const mod = (col - 1) % 26;
      s   = String.fromCharCode(65 + mod) + s;
      col = Math.floor((col - 1) / 26);
    }
    return s;
  }

  // findSheetId conservé pour compatibilité
  async findSheetId(sheetName: string): Promise<number> {
    return this.getSheetId(sheetName);
  }
}