// beep.service.ts — son bip après scan réussi
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class BeepService {
  // Bip court 880Hz — confirme l'ajout d'un article scanné
  beep(): void {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch { /* silencieux si AudioContext indisponible */ }
  }
}
