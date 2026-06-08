// scan.service.ts
import { Injectable, signal, computed } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { Article } from '../models/supermarche.models';

export type ScanMode = 'camera' | 'usb';

// ── Table Code 128B (chaque entrée = largeurs des 6 éléments) ────────────────
const CODE128_PATTERNS: number[] = [
  212222,222122,222221,121223,121322,131222,122213,122312,132212,221213,
  221312,231212,112232,122132,122231,113222,123122,123221,223211,221132,
  221231,213212,223112,312131,311222,321122,321221,312212,322112,322211,
  212123,212321,232121,111323,131123,131321,112313,132113,132311,211313,
  231113,231311,112133,112331,132131,113123,113321,133121,313121,211331,
  231131,213113,213311,213131,311123,311321,331121,312113,312311,332111,
  314111,221411,431111,111224,111422,121124,121421,141122,141221,112214,
  112412,122114,122411,142112,142211,241211,221114,413111,241112,134111,
  111242,121142,121241,114212,124112,124211,411212,421112,421211,212141,
  214121,412121,111143,111341,131141,114113,114311,411113,411311,113141,
  114131,311141,411131,211412,211214,211232,2331112,
];

/** Génère un SVG Code 128 pour un code article */
export function generateBarcodeSVG(
  text: string,
  opts: { height?: number; fontSize?: number } = {}
): string {
  const { height = 64, fontSize = 11 } = opts;
  const START_B = 104, STOP = 106;
  const MODULE  = 2; // px par module

  // Construire les indices
  const indices: number[] = [START_B];
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i) - 32;
    if (c >= 0 && c <= 95) indices.push(c);
  }
  let check = START_B;
  for (let i = 1; i < indices.length; i++) check += indices[i] * i;
  indices.push(check % 103);
  indices.push(STOP);

  // Générer les barres
  const rects: string[] = [];
  const MARGIN = 10;
  let x = MARGIN;
  const barH = height - fontSize - 6;

  x += MARGIN; // quiet zone
  for (const idx of indices) {
    const pat = String(CODE128_PATTERNS[idx]);
    let dark = true;
    for (const ch of pat) {
      const w = parseInt(ch) * MODULE;
      if (dark) rects.push(`<rect x="${x}" y="4" width="${w}" height="${barH}" fill="#000"/>`);
      x += w;
      dark = !dark;
    }
  }
  // barre finale stop
  rects.push(`<rect x="${x}" y="4" width="${MODULE}" height="${barH}" fill="#000"/>`);
  x += MODULE + MARGIN;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="${height}" viewBox="0 0 ${x} ${height}">
  <rect width="${x}" height="${height}" fill="#fff"/>
  ${rects.join('\n  ')}
  <text x="${x/2}" y="${height-1}" text-anchor="middle" font-family="monospace" font-size="${fontSize}">${text}</text>
</svg>`;
}

/** SVG → PNG data URL (via canvas) */
export function svgToDataURL(svg: string): Promise<string> {
  return new Promise(resolve => {
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    const img  = new Image();
    img.onload = () => {
      const c  = document.createElement('canvas');
      c.width  = img.naturalWidth  || 200;
      c.height = img.naturalHeight || 64;
      c.getContext('2d')!.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/png'));
    };
    img.src = url;
  });
}

/** Télécharge le SVG d'un seul article */
export function downloadBarcodeSVG(article: Article): void {
  const svg  = generateBarcodeSVG(article.code_article);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const a    = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `barcode_${article.code_article}.svg`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Génère et télécharge un .docx avec tous les codes-barres (3 par ligne) */
export async function downloadAllBarcodesWord(articles: Article[]): Promise<void> {
  const {
    Document, Packer, Paragraph, TextRun, ImageRun,
    Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType,
  } = await import('docx');

  const b = { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' };
  const borders = { top: b, bottom: b, left: b, right: b };
  const COLS = 3, CELL_W = 3020; // 3 × 3020 ≈ 9060 DXA (A4 - marges)

  const cells: any[] = [];
  for (const art of articles) {
    const dataUrl = await svgToDataURL(generateBarcodeSVG(art.code_article, { height: 70 }));
    const imgBuf  = Uint8Array.from(atob(dataUrl.replace('data:image/png;base64,', '')), c => c.charCodeAt(0));

    cells.push(new TableCell({
      width: { size: CELL_W, type: WidthType.DXA },
      borders,
      margins: { top: 100, bottom: 100, left: 100, right: 100 },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new ImageRun({ data: imgBuf, transformation: { width: 140, height: 55 }, type: 'png' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: art.nom, bold: true, size: 18, font: 'Arial' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: art.code_article, size: 16, font: 'Courier New', color: '555555' })],
        }),
      ],
    }));
  }

  // Compléter la dernière ligne
  while (cells.length % COLS !== 0) {
    cells.push(new TableCell({ width: { size: CELL_W, type: WidthType.DXA }, borders, children: [new Paragraph({ children: [] })] }));
  }

  const rows: any[] = [];
  for (let i = 0; i < cells.length; i += COLS) {
    rows.push(new TableRow({ children: cells.slice(i, i + COLS) }));
  }

  const doc = new Document({
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 280 },
          children: [new TextRun({ text: 'Catalogue codes-barres', bold: true, size: 28, font: 'Arial' })],
        }),
        new Table({ width: { size: 9060, type: WidthType.DXA }, columnWidths: [CELL_W, CELL_W, CELL_W], rows }),
      ],
    }],
  });

  // ✅ FIX : toBuffer() est Node.js uniquement → toBlob() pour le navigateur
  const blob = await Packer.toBlob(doc);
  const a    = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'barcodes_articles.docx' });
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── ScanService ───────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class ScanService {
  private _scan$ = new Subject<string>();
  readonly scan$: Observable<string> = this._scan$.asObservable();

  readonly mode      = signal<ScanMode>('camera');
  readonly modeLabel = computed(() => this.mode() === 'usb' ? 'Scanner USB actif' : 'Caméra active');
  readonly modeColor = computed(() => this.mode() === 'usb' ? 'text-info' : 'text-success');

  private _buffer  = '';
  private _lastKey = 0;
  private readonly USB_THRESHOLD_MS = 50;
  private _listener = this._onKeydown.bind(this);

  constructor() { window.addEventListener('keydown', this._listener, true); }

  emitFromCamera(code: string): void {
    if (this.mode() === 'usb') return;
    this._scan$.next(code);
  }

  forceMode(mode: ScanMode): void { this.mode.set(mode); this._buffer = ''; }
  destroy(): void { window.removeEventListener('keydown', this._listener, true); }

  private _onKeydown(e: KeyboardEvent): void {
    const now = Date.now(), delta = now - this._lastKey;
    this._lastKey = now;
    if (e.key === 'Enter') {
      const code = this._buffer.trim(); this._buffer = '';
      if (code.length >= 4) {
        if (this.mode() !== 'usb') this.mode.set('usb');
        e.preventDefault(); e.stopPropagation();
        this._scan$.next(code);
      }
      return;
    }
    if (delta < this.USB_THRESHOLD_MS || this.mode() === 'usb') {
      if (e.key.length === 1) {
        this._buffer += e.key;
        if (this.mode() === 'usb') { e.preventDefault(); e.stopPropagation(); }
      }
    } else {
      if (this._buffer.length > 0) { this._buffer = ''; if (this.mode() === 'usb') this.mode.set('camera'); }
    }
  }
}