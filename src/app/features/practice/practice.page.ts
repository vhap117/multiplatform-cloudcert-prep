import { Component } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';

/**
 * Placeholder for the Practice entry points (issues 005, 006, 007).
 */
@Component({
  selector: 'app-practice',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Practice</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="ccp-page">
        <div class="ccp-content">
          <p class="ccp-kicker">Practice</p>
          <h1 class="ccp-display">Practice</h1>
          <p class="ccp-body ccp-muted">
            Mock exam, study exam and domain practice arrive in issues 005,
            006 and 007.
          </p>
        </div>
      </div>
    </ion-content>
  `,
})
export class PracticePage {}
