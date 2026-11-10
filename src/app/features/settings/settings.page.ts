import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';

import { IS_NATIVE_STORAGE } from '../../core/storage/repository-provider';

import { AppInfoSectionComponent } from './app-info/app-info-section.component';
import { AppearanceSectionComponent } from './appearance/appearance-section.component';
import { DataManagementComponent } from './data-management/data-management.component';
import { PrivacySectionComponent } from './privacy/privacy-section.component';

/**
 * Settings (issue 012).
 *
 * Appearance, data management, the privacy statement, and app information.
 * Every section is local: the screen works fully offline and never asks for a
 * network or a device permission.
 */
@Component({
  selector: 'app-settings',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    RouterLink,
    AppearanceSectionComponent,
    DataManagementComponent,
    PrivacySectionComponent,
    AppInfoSectionComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Settings</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="ccp-page">
        <div class="ccp-content">
          <p class="ccp-kicker">Settings</p>
          <h1 class="ccp-display">Settings</h1>

          <app-appearance-section />
          <app-data-management />

          @if (isNative) {
            <section class="ccp-card storage-section" aria-labelledby="storage-heading">
              <h2 id="storage-heading" class="ccp-card-heading">Database</h2>
              <p class="ccp-body ccp-muted">
                Check that the local SQLite database has every required table
                and migration.
              </p>
              <ion-button fill="outline" routerLink="/tabs/settings/storage">
                Check database health
              </ion-button>
            </section>
          }

          <app-privacy-section />
          <app-app-info-section />
        </div>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .storage-section {
        margin-top: var(--ccp-space-lg);
      }

      .storage-section ion-button {
        margin: var(--ccp-space-md) 0 0;
      }
    `,
  ],
})
export class SettingsPage {
  protected readonly isNative = inject(IS_NATIVE_STORAGE);
}
