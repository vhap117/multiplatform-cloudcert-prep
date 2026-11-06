import { Component } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';

import { DataManagementComponent } from './data-management/data-management.component';

/**
 * Settings (issue 011 adds data management; issue 012 adds theme, motion,
 * app info, and the privacy statement around it).
 */
@Component({
  selector: 'app-settings',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, DataManagementComponent],
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
          <p class="ccp-body ccp-muted">
            Theme and motion controls, versions, and the privacy statement
            arrive in issue 012.
          </p>

          <app-data-management />
        </div>
      </div>
    </ion-content>
  `,
})
export class SettingsPage {}
