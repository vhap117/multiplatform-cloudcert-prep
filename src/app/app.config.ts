import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';

import { provideBackupTransport } from './core/backup/web-backup-transport';
import { SelectedTabService } from './core/navigation/selected-tab.service';
import { provideStudyRepository } from './core/storage/repository-provider';
import { StorageStartupService } from './core/storage/storage-startup.service';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideIonicAngular(),
    provideStudyRepository(),
    provideBackupTransport(),
    // Open the store and run migrations before any screen reads it.
    provideAppInitializer(() => inject(StorageStartupService).start()),
    // Start recording the last visited tab before the first navigation (CERT-14).
    provideAppInitializer(() => {
      inject(SelectedTabService);
    }),
    provideRouter(routes, withComponentInputBinding()),
  ],
};
