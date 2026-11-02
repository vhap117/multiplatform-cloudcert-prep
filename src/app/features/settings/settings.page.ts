import { Component } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';

/**
 * Placeholder for Settings (issue 012).
 */
@Component({
  selector: 'app-settings',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent],
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
            Theme and motion controls, versions, backup and the privacy
            statement arrive in issue 012.
          </p>
        </div>
      </div>
    </ion-content>
  `,
})
export class SettingsPage {}
