import { Component } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';

/**
 * Placeholder for the cert dashboard (issue 008).
 *
 * The token check card is temporary: it exists so light and dark themes can be
 * verified by eye before any real screen lands. Remove it when issue 008
 * replaces this page.
 */
@Component({
  selector: 'app-home',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Home</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="ccp-page">
        <div class="ccp-content">
          <p class="ccp-kicker">Your dashboard</p>
          <h1 class="ccp-display">Home</h1>
          <p class="ccp-body ccp-muted">
            The cert dashboard, best score, domain mastery and resume card
            arrive in issue 008.
          </p>

          <div class="ccp-card" style="margin-top: var(--ccp-space-lg)">
            <h2 class="ccp-card-heading">Design tokens</h2>
            <p class="ccp-small ccp-muted">
              Temporary check. Each swatch reads a token from DESIGN.md.
            </p>

            <ul class="swatches">
              <li><span class="swatch swatch-brand"></span>brand</li>
              <li><span class="swatch swatch-success"></span>success</li>
              <li><span class="swatch swatch-danger"></span>danger</li>
              <li><span class="swatch swatch-warning"></span>warning</li>
              <li><span class="swatch swatch-link"></span>link</li>
            </ul>

            <p class="ccp-mono">Mono 00:00</p>
            <p class="ccp-caption ccp-muted">Caption</p>
          </div>
        </div>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .swatches {
        display: flex;
        flex-wrap: wrap;
        gap: var(--ccp-space-md);
        list-style: none;
        margin: var(--ccp-space-base) 0;
        padding: 0;
      }

      .swatches li {
        align-items: center;
        display: flex;
        font-size: 0.875rem;
        gap: var(--ccp-space-sm);
      }

      .swatch {
        border: 1px solid rgb(var(--ccp-border));
        border-radius: var(--ccp-radius-inner);
        display: block;
        height: 24px;
        width: 24px;
      }

      .swatch-brand {
        background: rgb(var(--ccp-brand));
      }

      .swatch-success {
        background: rgb(var(--ccp-success));
      }

      .swatch-danger {
        background: rgb(var(--ccp-danger));
      }

      .swatch-warning {
        background: rgb(var(--ccp-warning));
      }

      .swatch-link {
        background: rgb(var(--ccp-link));
      }
    `,
  ],
})
export class HomePage {}
