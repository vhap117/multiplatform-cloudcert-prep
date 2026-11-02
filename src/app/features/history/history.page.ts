import { Component } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';

/**
 * Placeholder for history and local statistics (issue 009).
 */
@Component({
  selector: 'app-history',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>History</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="ccp-page">
        <div class="ccp-content">
          <p class="ccp-kicker">Progress</p>
          <h1 class="ccp-display">History</h1>
          <p class="ccp-body ccp-muted">
            Attempt history, question review and local statistics arrive in
            issue 009.
          </p>
        </div>
      </div>
    </ion-content>
  `,
})
export class HistoryPage {}
