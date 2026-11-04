import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonButtons } from '@ionic/angular';

/**
 * A direct route home for the top-level flow screens.
 *
 * Deep links and full-screen flows can leave the tab shell, so a visible
 * Home action gives the student one predictable way back to the dashboard
 * without relying on the browser history stack.
 */
@Component({
  selector: 'app-home-button',
  imports: [IonButton, IonButtons],
  template: `
    <ion-buttons slot="end">
      <ion-button
        fill="clear"
        (click)="goHome()"
        [attr.aria-label]="label()"
      >
        Home
      </ion-button>
    </ion-buttons>
  `,
})
export class HomeButtonComponent {
  readonly label = input('Go to the homepage');

  private readonly router = inject(Router);

  goHome(): void {
    void this.router.navigateByUrl('/tabs/home');
  }
}
