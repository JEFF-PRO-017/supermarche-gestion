// app.config.ts
import {
  ApplicationConfig,
  provideZoneChangeDetection,
  isDevMode,
} from '@angular/core';
import { provideRouter }            from '@angular/router';
import { provideHttpClient }        from '@angular/common/http';
import { provideAnimationsAsync }   from '@angular/platform-browser/animations/async';
import { MAT_DIALOG_DEFAULT_OPTIONS }     from '@angular/material/dialog';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { provideServiceWorker }     from '@angular/service-worker';
import { routes }                   from './app.routes';

// NE PAS injecter DataService ici — GoogleSheetsService utilise crypto.subtle
// (Web Crypto API) qui n'est disponible qu'après le rendu complet du navigateur.
// ensureSheets() est appelé depuis LoginComponent après montage du DOM.

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    provideAnimationsAsync(),

    // Angular Material — dialogues centrés avec panelClass sm-modal
    {
      provide: MAT_DIALOG_DEFAULT_OPTIONS,
      useValue: {
        hasBackdrop: true,
        panelClass: 'sm-modal',
        autoFocus: false,
        restoreFocus: false,
      },
    },

    // Tous les mat-form-field en outline par défaut
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: { appearance: 'outline', subscriptSizing: 'dynamic' },
    },

    // PWA Service Worker — actif uniquement en production
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};