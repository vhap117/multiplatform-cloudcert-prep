import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';

import { getCert, listCerts, type Certification } from '../../core/content/cert-registry';
import { SETTINGS_KEYS, readSetting } from '../../core/settings/local-settings';

import { PRACTICE_SEGMENT } from './practice.routes';

/**
 * The Practice tab lists the selected cert's domains with one practice action
 * each (issue 007, PRACT-1 to PRACT-3). Each action opens the config screen
 * with the domain already named, so the dashboard can deep link straight to
 * the same screen later.
 */
@Component({
  selector: 'app-practice',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, RouterLink],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Practice</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="ccp-page">
        <div class="ccp-content">
          <p class="ccp-kicker">Adaptive practice</p>
          <h1 class="ccp-display">Domain practice</h1>

          @if (cert; as activeCert) {
            <p class="ccp-body ccp-muted">
              {{ activeCert.name }} ({{ activeCert.shortName }}). Pick one domain
              and answer a short adaptive session with instant feedback.
            </p>

            <ul class="domain-actions">
              @for (domain of activeCert.domains; track domain.id) {
                <li>
                  <a
                    class="practice-domain ccp-card"
                    [routerLink]="configSegments()"
                    [queryParams]="{ domain: domain.id }"
                  >
                    <span class="ccp-body">{{ domain.name }}</span>
                    <span class="ccp-small ccp-muted">Practice this domain</span>
                  </a>
                </li>
              }
            </ul>
          } @else {
            <p class="ccp-body ccp-muted" role="alert">
              No active certification is available for domain practice yet.
            </p>
          }
        </div>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .domain-actions {
        display: grid;
        gap: var(--ccp-space-md);
        list-style: none;
        margin: var(--ccp-space-lg) 0 0;
        padding: 0;
      }

      .practice-domain {
        color: inherit;
        display: flex;
        flex-direction: column;
        gap: var(--ccp-space-xs);
        text-decoration: none;
      }

      .practice-domain:focus-visible {
        outline: 2px solid rgb(var(--ccp-focus));
        outline-offset: 2px;
      }
    `,
  ],
})
export class PracticePage {
  readonly cert: Certification | null = resolveCert();

  configSegments(): string[] {
    // Absolute on purpose: the Practice tab lives at /tabs/practice, and a
    // relative link there would resolve to /tabs/practice/practice/... .
    return this.cert ? [`/${PRACTICE_SEGMENT}`, this.cert.code] : ['/tabs/practice'];
  }
}

/** The locally selected cert, falling back to the first active one. */
function resolveCert(): Certification | null {
  const selected = readSetting(SETTINGS_KEYS.selectedCert);
  const chosen = selected ? getCert(selected) : null;
  return chosen ?? listCerts({ activeOnly: true })[0] ?? null;
}
