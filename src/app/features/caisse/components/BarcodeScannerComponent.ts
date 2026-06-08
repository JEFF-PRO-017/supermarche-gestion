// barcode-scanner.component.ts
import {
  Component, inject, OnInit, OnDestroy,
  ViewChild, ElementRef, signal, effect, untracked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { ScanService } from '../../../core/services/ScanService';

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
             playsinline muted></video>

      @if (active()) {
        <div class="position-absolute top-50 start-50 translate-middle"
             style="width:60%;aspect-ratio:3/1;border:2px solid rgba(255,255,255,.7);
                    border-radius:4px;pointer-events:none">
          <div class="position-absolute start-0 end-0"
               style="height:2px;background:rgba(255,80,80,.8);animation:scanline 1.5s ease-in-out infinite"></div>
        </div>
      }

      @if (!active()) {
        <div class="d-flex flex-column align-items-center justify-content-center text-muted h-100 gap-2 p-3">
          <i class="fa-solid fa-usb fa-2x opacity-50"></i>
          <small class="text-center opacity-75">Scanner USB actif<br>Caméra en veille</small>
        </div>
      }

      @if (erreur()) {
        <div class="position-absolute top-0 start-0 end-0 bottom-0
                    d-flex align-items-center justify-content-center
                    bg-dark bg-opacity-75 text-danger small text-center p-2">
          <span><i class="fa-solid fa-triangle-exclamation me-1"></i>{{ erreur() }}</span>
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
      @keyframes scanline { 0% { top:10%; } 50% { top:85%; } 100% { top:10%; } }
    </style>
  `,
})
export class BarcodeScannerComponent implements OnInit, OnDestroy {
  private scanSv = inject(ScanService);

  @ViewChild('videoEl', { static: true }) videoEl!: ElementRef<HTMLVideoElement>;

  active         = signal(false);
  erreur         = signal('');
  cameras        = signal<MediaDeviceInfo[]>([]);
  selectedCamera = signal('');

  private reader!: BrowserMultiFormatReader;
  private controls: IScannerControls | null = null;

  constructor() {
    // ✅ FIX NG0600 : allowSignalWrites requis pour écrire dans un signal depuis effect()
    effect(() => {
      const mode = this.scanSv.mode();
      // untracked évite de capturer d'autres dépendances dans les méthodes appelées
      untracked(() => {
        if (mode === 'camera') { this.demarrer(); }
        else                   { this.arreter();  }
      });
    }, { allowSignalWrites: true });
  }

  async ngOnInit(): Promise<void> {
    this.reader = new BrowserMultiFormatReader();
    try {
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      this.cameras.set(devices);
      if (devices.length) this.selectedCamera.set(devices[0].deviceId);
    } catch {
      this.erreur.set('Impossible de lister les caméras');
    }
    if (this.scanSv.mode() === 'camera') await this.demarrer();
  }

  ngOnDestroy(): void { this.arreter(); }

  async demarrer(): Promise<void> {
    if (this.controls) return;
    this.erreur.set('');
    try {
      this.controls = await this.reader.decodeFromVideoDevice(
        this.selectedCamera() || undefined,
        this.videoEl.nativeElement,
        (result) => { if (result) this.scanSv.emitFromCamera(result.getText()); }
      );
      this.active.set(true);  // ✅ autorisé grâce à allowSignalWrites
    } catch (e: any) {
      this.erreur.set(e?.message?.includes('Permission')
        ? 'Accès caméra refusé' : 'Caméra indisponible');
    }
  }

  arreter(): void {
    this.controls?.stop();
    this.controls = null;
    this.active.set(false);   // ✅ idem
  }

  async changerCamera(event: Event): Promise<void> {
    this.selectedCamera.set((event.target as HTMLSelectElement).value);
    this.arreter();
    await this.demarrer();
  }
}