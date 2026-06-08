// barcode-scanner.component.ts
//
// Stratégie de décodage par ordre de priorité :
//   1. BarcodeDetector natif (Chrome Android / Chrome desktop) — le plus rapide, 0 lib
//   2. BrowserQRCodeReader zxing — fallback universel pour QR
//   3. ScanService USB — détection clavier pour scanner laser
//
import {
  Component, inject, OnInit, OnDestroy,
  ViewChild, ElementRef, signal, effect, untracked, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import { ScanService } from '../../../core/services/ScanService';

// BarcodeDetector est natif mais pas encore dans les types TS standard
declare const BarcodeDetector: any;

@Component({
  selector: 'app-barcode-scanner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rounded overflow-hidden position-relative bg-dark"
         style="aspect-ratio:4/3;max-height:220px">

      <video #videoEl
             [style.display]="active() ? 'block' : 'none'"
             class="w-100 h-100" style="object-fit:cover"
             playsinline muted autoplay></video>

      <!-- Viseur de scan -->
      @if (active()) {
        <div class="position-absolute top-50 start-50 translate-middle"
             style="width:60%;aspect-ratio:3/1;border:2px solid rgba(255,255,255,.7);
                    border-radius:4px;pointer-events:none">
          <div class="position-absolute start-0 end-0"
               style="height:2px;background:rgba(255,80,80,.8);
                      animation:scanline 1.5s ease-in-out infinite"></div>
        </div>

        <!-- Bouton torche (si disponible) -->
        @if (torchDisponible()) {
          <button class="btn btn-sm position-absolute top-0 end-0 m-2 px-2 py-1"
                  [class.btn-warning]="torchActive()"
                  [class.btn-outline-light]="!torchActive()"
                  (click)="toggleTorch()"
                  title="Lampe torche">
            <i class="fa-solid fa-bolt"></i>
          </button>
        }

        <!-- Badge moteur de décodage actif -->
        <span class="badge position-absolute bottom-0 start-0 m-2"
              [class.bg-success]="moteur() === 'natif'"
              [class.bg-secondary]="moteur() === 'zxing'">
          {{ moteur() === 'natif' ? 'Natif' : 'ZXing' }}
        </span>
      }

      <!-- Mode USB actif -->
      @if (!active()) {
        <div class="d-flex flex-column align-items-center justify-content-center
                    text-muted h-100 gap-2 p-3">
          <i class="fa-solid fa-usb fa-2x opacity-50"></i>
          <small class="text-center opacity-75">Scanner USB actif<br>Caméra en veille</small>
        </div>
      }

      <!-- Erreur -->
      @if (erreur()) {
        <div class="position-absolute top-0 start-0 end-0 bottom-0
                    d-flex align-items-center justify-content-center
                    bg-dark bg-opacity-75 text-danger small text-center p-2">
          <span><i class="fa-solid fa-triangle-exclamation me-1"></i>{{ erreur() }}</span>
        </div>
      }
    </div>

    <!-- Sélecteur caméra (si plusieurs disponibles) -->
    @if (cameras().length > 1 && active()) {
      <select class="form-select form-select-sm mt-1"
              [value]="selectedCamera()"
              (change)="changerCamera($event)">
        @for (cam of cameras(); track cam.deviceId) {
          <option [value]="cam.deviceId">{{ cam.label || 'Caméra ' + $index }}</option>
        }
      </select>
    }

    <style>
      @keyframes scanline { 0% { top:10%; } 50% { top:85%; } 100% { top:10%; } }
    </style>
  `,
})
export class BarcodeScannerComponent implements OnInit, OnDestroy {

  private scanSv = inject(ScanService);
  private zone   = inject(NgZone);

  @ViewChild('videoEl', { static: true }) videoEl!: ElementRef<HTMLVideoElement>;

  // ── Signals ────────────────────────────────────────────────────
  active         = signal(false);
  erreur         = signal('');
  cameras        = signal<MediaDeviceInfo[]>([]);
  selectedCamera = signal('');
  torchDisponible = signal(false);
  torchActive     = signal(false);
  moteur          = signal<'natif' | 'zxing'>('zxing'); // moteur de décodage utilisé

  // ── Internals ──────────────────────────────────────────────────
  private reader!: BrowserQRCodeReader;      // fallback zxing (QR uniquement = 3x plus rapide que MultiFormat)
  private controls: IScannerControls | null = null;
  private nativeLoop: number | null = null;  // requestAnimationFrame loop pour BarcodeDetector
  private nativeDetector: any = null;        // instance BarcodeDetector natif
  private mediaStream: MediaStream | null = null; // stream caméra actif (nécessaire pour torch)

  constructor() {
    effect(() => {
      const mode = this.scanSv.mode();
      untracked(() => {
        if (mode === 'camera') this.demarrer();
        else                   this.arreter();
      });
    }, { allowSignalWrites: true });
  }

  async ngOnInit(): Promise<void> {
    // QRCodeReader uniquement — beaucoup plus rapide que MultiFormatReader
    this.reader = new BrowserQRCodeReader();

    // Initialise BarcodeDetector natif si disponible (Chrome Android / Chrome 83+)
    if (typeof BarcodeDetector !== 'undefined') {
      try {
        // On supporte QR + Code128 (scanner laser) en un seul détecteur
        this.nativeDetector = new BarcodeDetector({
          formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8']
        });
        this.moteur.set('natif');
      } catch {
        this.nativeDetector = null;
      }
    }

    try {
      const devices = await BrowserQRCodeReader.listVideoInputDevices();
      this.cameras.set(devices);

      // Préfère la caméra arrière sur mobile (label contient souvent "back" ou "arrière")
      const arriere = devices.find(d =>
        d.label.toLowerCase().includes('back') ||
        d.label.toLowerCase().includes('rear') ||
        d.label.toLowerCase().includes('arrière') ||
        d.label.toLowerCase().includes('environment')
      );
      this.selectedCamera.set(arriere?.deviceId ?? devices[0]?.deviceId ?? '');
    } catch {
      this.erreur.set('Impossible de lister les caméras');
    }

    if (this.scanSv.mode() === 'camera') await this.demarrer();
  }

  ngOnDestroy(): void { this.arreter(); }

  // ── Démarrage ──────────────────────────────────────────────────
  async demarrer(): Promise<void> {
    if (this.controls || this.nativeLoop) return;
    this.erreur.set('');

    try {
      if (this.nativeDetector) {
        // ── Moteur natif : getUserMedia + boucle requestAnimationFrame ──
        // Beaucoup plus rapide que zxing car pas de JS de décodage
        await this.demarrerNatif();
      } else {
        // ── Fallback zxing QRCodeReader ──
        await this.demarrerZxing();
      }
      this.active.set(true);
    } catch (e: any) {
      this.erreur.set(
        e?.message?.includes('ermission') ? 'Accès caméra refusé' : 'Caméra indisponible'
      );
    }
  }

  // ── Moteur 1 : BarcodeDetector natif + boucle RAF ─────────────
  // Analyse chaque frame vidéo directement en natif (GPU-accelerated sur Android)
  private async demarrerNatif(): Promise<void> {
    const constraints: MediaStreamConstraints = {
      video: {
        deviceId:   this.selectedCamera() ? { exact: this.selectedCamera() } : undefined,
        facingMode: this.selectedCamera() ? undefined : 'environment', // caméra arrière par défaut
        width:      { ideal: 1280 },
        height:     { ideal: 720 },
      }
    };

    this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    const video      = this.videoEl.nativeElement;
    video.srcObject  = this.mediaStream;
    await video.play();

    // Vérifie si la torche est disponible sur cette caméra
    const track = this.mediaStream.getVideoTracks()[0];
    const caps  = track.getCapabilities() as any;
    this.torchDisponible.set(!!caps?.torch);

    // Boucle de décodage — on sort de la zone Angular pour ne pas déclencher
    // la détection de changements à chaque frame (60fps = 60 cycles sinon)
    this.zone.runOutsideAngular(() => {
      const boucle = async () => {
        if (!this.nativeDetector || !this.mediaStream) return;
        try {
          const codes = await this.nativeDetector.detect(video);
          if (codes.length > 0) {
            const code = codes[0].rawValue;
            // On rentre dans la zone Angular uniquement quand on a un résultat
            this.zone.run(() => this.scanSv.emitFromCamera(code));
          }
        } catch { /* frame non décodable — normal, on continue */ }
        this.nativeLoop = requestAnimationFrame(boucle);
      };
      this.nativeLoop = requestAnimationFrame(boucle);
    });
  }

  // ── Moteur 2 : zxing QRCodeReader (fallback) ──────────────────
  private async demarrerZxing(): Promise<void> {
    const constraints = {
      video: {
        deviceId:   this.selectedCamera() ? { exact: this.selectedCamera() } : undefined,
        facingMode: this.selectedCamera() ? undefined : { ideal: 'environment' },
        width:      { ideal: 1280 },
        height:     { ideal: 720 },
      }
    };
    this.controls = await this.reader.decodeFromConstraints(
      constraints,
      this.videoEl.nativeElement,
      (result) => { if (result) this.scanSv.emitFromCamera(result.getText()); }
    );
  }

  // ── Arrêt ──────────────────────────────────────────────────────
  arreter(): void {
    // Arrêt boucle native
    if (this.nativeLoop) {
      cancelAnimationFrame(this.nativeLoop);
      this.nativeLoop = null;
    }
    // Arrêt stream caméra
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    // Arrêt zxing
    this.controls?.stop();
    this.controls = null;

    this.active.set(false);
    this.torchDisponible.set(false);
    this.torchActive.set(false);
  }

  // ── Changer de caméra ──────────────────────────────────────────
  async changerCamera(event: Event): Promise<void> {
    this.selectedCamera.set((event.target as HTMLSelectElement).value);
    this.arreter();
    await this.demarrer();
  }

  // ── Torche (lampe) ─────────────────────────────────────────────
  async toggleTorch(): Promise<void> {
    if (!this.mediaStream) return;
    const track = this.mediaStream.getVideoTracks()[0];
    const newState = !this.torchActive();
    try {
      await (track as any).applyConstraints({ advanced: [{ torch: newState }] });
      this.torchActive.set(newState);
    } catch {
      this.torchDisponible.set(false); // la torche n'est finalement pas supportée
    }
  }
}