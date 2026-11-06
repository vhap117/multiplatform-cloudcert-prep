import { Component } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';

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
          <app-privacy-section />
          <app-app-info-section />
        </div>
      </div>
    </ion-content>
  `,
})
export class SettingsPage {}
