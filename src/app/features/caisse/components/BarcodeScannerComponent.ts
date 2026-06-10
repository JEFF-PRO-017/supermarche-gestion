import {
  Component, inject, OnInit, OnDestroy,
  ViewChild, ElementRef, signal, effect, untracked, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import { ScanService } from '../../../core/services/ScanService';

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

      @if (active()) {
        <!-- Viseur -->
        <div class="position-absolute top-50 start-50 translate-middle"
             style="width:60%;aspect-ratio:3/1;border:2px solid rgba(255,255,255,.7);
                    border-radius:4px;pointer-events:none">
          <div class="position-absolute start-0 end-0"
               style="height:2px;background:rgba(255,80,80,.8);
                      animation:scanline 1.5s ease-in-out infinite"></div>
        </div>

        <!-- Torche -->
        @if (torchDisponible()) {
          <button class="btn btn-sm position-absolute top-0 end-0 m-2 px-2 py-1"
                  [class.btn-warning]="torchActive()"
                  [class.btn-outline-light]="!torchActive()"
                  (click)="toggleTorch()" title="Lampe torche">
            <i class="fa-solid fa-bolt"></i>
          </button>
        }

        <!-- Badge moteur -->
        <span class="badge position-absolute bottom-0 start-0 m-2"
              [class.bg-success]="moteur() === 'natif'"
              [class.bg-secondary]="moteur() === 'zxing'">
          {{ moteur() === 'natif' ? 'Natif' : 'ZXing' }}
        </span>
      }

      @if (!active()) {
        <div class="d-flex flex-column align-items-center justify-content-center
                    text-muted h-100 gap-2 p-3">
          <i class="fa-solid fa-usb fa-2x opacity-50"></i>
          <small class="text-center opacity-75">Scanner USB actif<br>Caméra en veille</small>
        </div>
      }

      @if (erreur()) {
        <div class="position-absolute top-0 start-0 end-0 bottom-0
                    d-flex align-items-center justify-content-center
                    bg-dark bg-opacity-75 text-danger small text-center p-2">
          <i class="fa-solid fa-triangle-exclamation me-1"></i>{{ erreur() }}
        </div>
      }
    </div>

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
      @keyframes scanline { 0%{top:10%} 50%{top:85%} 100%{top:10%} }
    </style>
  `,
})
export class BarcodeScannerComponent implements OnInit, OnDestroy {

  private scanSv = inject(ScanService);
  private zone = inject(NgZone);

  @ViewChild('videoEl', { static: true }) videoEl!: ElementRef<HTMLVideoElement>;

  active = signal(false);
  erreur = signal('');
  cameras = signal<MediaDeviceInfo[]>([]);
  selectedCamera = signal('');
  torchDisponible = signal(false);
  torchActive = signal(false);
  moteur = signal<'natif' | 'zxing'>('zxing');

  private stopped = false;
  private reader!: BrowserQRCodeReader;
  private controls: IScannerControls | null = null;
  private nativeLoop: number | null = null;
  private nativeDetector: any = null;
  private mediaStream: MediaStream | null = null;

  constructor() {
    effect(() => {
      const mode = this.scanSv.mode();
      untracked(() => mode === 'camera' ? this.demarrer() : this.arreter());
    }, { allowSignalWrites: true });
  }

  async ngOnInit(): Promise<void> {
    this.reader = new BrowserQRCodeReader();

    if (typeof BarcodeDetector !== 'undefined') {
      try {
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
      const arriere = devices.find(d =>
        /back|rear|arrière|environment/i.test(d.label)
      );
      this.selectedCamera.set(arriere?.deviceId ?? devices[0]?.deviceId ?? '');
    } catch {
      this.erreur.set('Impossible de lister les caméras');
    }

    if (this.scanSv.mode() === 'camera') await this.demarrer();
  }

  ngOnDestroy(): void { this.arreter(); }

  async demarrer(): Promise<void> {
    if (this.controls || this.nativeLoop) return;
    this.erreur.set('');
    try {
      await (this.nativeDetector ? this.demarrerNatif() : this.demarrerZxing());
      this.active.set(true);
    } catch (e: any) {
      this.erreur.set(
        e?.message?.includes('ermission') ? 'Accès caméra refusé' : 'Caméra indisponible'
      );
    }
  }

  private async demarrerNatif(): Promise<void> {
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: this.selectedCamera() ? { exact: this.selectedCamera() } : undefined,
        facingMode: this.selectedCamera() ? undefined : 'environment',
        width: { ideal: 1280 }, height: { ideal: 720 },
      }
    });

    const video = this.videoEl.nativeElement;
    video.srcObject = this.mediaStream;
    await video.play();

    const track = this.mediaStream.getVideoTracks()[0];
    this.torchDisponible.set(!!(track.getCapabilities() as any)?.torch);

    this.zone.runOutsideAngular(() => {
      const boucle = async () => {
        if (!this.nativeDetector || !this.mediaStream) return;
        try {
          const [code] = await this.nativeDetector.detect(video);
          if (code) this.zone.run(() => this.scanSv.emitFromCamera(code.rawValue));
        } catch { /* frame non décodable */ }
        this.nativeLoop = requestAnimationFrame(boucle);
      };
      this.nativeLoop = requestAnimationFrame(boucle);
    });
  }


private async demarrerZxing(): Promise<void> {
  // ✅ On gère le stream nous-mêmes — plus de race condition zxing
  this.mediaStream = await navigator.mediaDevices.getUserMedia({
    video: {
      deviceId:   this.selectedCamera() ? { exact: this.selectedCamera() } : undefined,
      facingMode: this.selectedCamera() ? undefined : { ideal: 'environment' },
      width: { ideal: 1280 }, height: { ideal: 720 },
    }
  });

  const video     = this.videoEl.nativeElement;
  video.srcObject = this.mediaStream;

  // ✅ On attend que la vidéo soit prête AVANT de démarrer zxing
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror          = () => reject(new Error('Erreur chargement vidéo'));
  });

  await video.play();

  // ✅ decodeFromStream au lieu de decodeFromConstraints — zxing utilise notre stream
  this.controls = await this.reader.decodeFromStream(
    this.mediaStream,
    video,
    (result) => {
      console.log('Code détecté (ZXing) :', result);
      if (this.stopped || !result) return;
      this.scanSv.emitFromCamera(result.getText());
    }
  );
}
arreter(): void {
  this.stopped = true; // ✅ coupe le callback immédiatement

  if (this.nativeLoop !== null) {
    cancelAnimationFrame(this.nativeLoop);
    this.nativeLoop = null;
  }

  this.mediaStream?.getTracks().forEach(t => t.stop());
  this.mediaStream = null;

  this.controls?.stop();
  this.controls = null;

  const video = this.videoEl?.nativeElement;
  if (video) video.srcObject = null;

  this.active.set(false);
  this.torchDisponible.set(false);
  this.torchActive.set(false);
}

  async changerCamera(event: Event): Promise<void> {
    this.selectedCamera.set((event.target as HTMLSelectElement).value);
    this.arreter();
    await this.demarrer();
  }

  async toggleTorch(): Promise<void> {
    if (!this.mediaStream) return;
    const track = this.mediaStream.getVideoTracks()[0];
    const newState = !this.torchActive();
    try {
      await (track as any).applyConstraints({ advanced: [{ torch: newState }] });
      this.torchActive.set(newState);
    } catch {
      this.torchDisponible.set(false);
    }
  }
}