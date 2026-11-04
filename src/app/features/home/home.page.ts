import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';

import { getCert, listCerts, type Certification } from '../../core/content/cert-registry';
import { formatTotalTime } from '../../core/exam';
import { SETTINGS_KEYS, readSetting } from '../../core/settings/local-settings';
import { mockExamStartPath } from '../mock-exam/mock-exam.routes';
import { studyExamStartPath } from '../study-exam/study-exam.routes';

/**
 * Placeholder for the cert dashboard (issue 008).
 *
 * The token check card is temporary: it exists so light and dark themes can be
 * verified by eye before any real screen lands. Remove it when issue 008
 * replaces this page.
 *
 * The mock exam entry is temporary too. Issue 008 owns the real dashboard
 * navigation, but without a door here the finished mock exam flow (issue 005)
 * would be reachable only by typing its URL.
 */
@Component({
  selector: 'app-home',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonButton, RouterLink],
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

          @if (mockExamPath; as examPath) {
            <div class="ccp-card" style="margin-top: var(--ccp-space-lg)">
              <h2 class="ccp-card-heading">Mock exam</h2>
              <p class="ccp-small ccp-muted">{{ examSummary }}</p>
              <ion-button expand="block" [routerLink]="examPath">Start mock exam</ion-button>
            </div>
          }

          @if (studyExamPath; as studyPath) {
            <div class="ccp-card" style="margin-top: var(--ccp-space-lg)">
              <h2 class="ccp-card-heading">Study exam</h2>
              <p class="ccp-small ccp-muted">{{ studyExamSummary }}</p>
              <ion-button expand="block" fill="outline" [routerLink]="studyPath">
                Start study exam
              </ion-button>
            </div>
          }

          <div class="ccp-card" style="margin-top: var(--ccp-space-lg)">
            <h2 class="ccp-card-heading">Domain practice</h2>
            <p class="ccp-small ccp-muted">
              Pick one domain and answer a short adaptive session with instant
              feedback.
            </p>
            <ion-button expand="block" fill="outline" [routerLink]="practicePath">
              Practice by domain
            </ion-button>
          </div>

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
export class HomePage {
  private readonly cert = resolveCert();

  /** Null when the registry has no active cert, which hides the entry. */
  readonly mockExamPath = this.cert ? mockExamStartPath(this.cert.code) : null;

  readonly studyExamPath = this.cert ? studyExamStartPath(this.cert.code) : null;

  /** The Practice tab, where the selected cert's domains are listed (PRACT-1). */
  readonly practicePath = '/tabs/practice';

  readonly studyExamSummary =
    'Untimed, feedback after every answer, saved automatically.';

  readonly examSummary = this.cert
    ? `${this.cert.examQuestionCount} questions, ${formatTotalTime(
        Math.round(this.cert.examTimeSeconds / 60),
      )}, pass at ${this.cert.passingScore}`
    : 'No active certification is bundled.';
}

/** The locally selected cert, falling back to the first active one (EXAM-1). */
function resolveCert(): Certification | null {
  const selected = readSetting(SETTINGS_KEYS.selectedCert);
  const chosen = selected ? getCert(selected) : null;
  return chosen ?? listCerts({ activeOnly: true })[0] ?? null;
}
