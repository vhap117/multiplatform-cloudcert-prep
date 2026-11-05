import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import { STUDY_REPOSITORY } from '../../core/storage/repository-provider';

import { clearDashboardSeed, seedDashboard, seededCertCodes } from './dashboard-seed';

/**
 * Manual development seeder (issue 008).
 *
 * The route is registered only in development. Seeding resets the two seeded
 * certs first so a second run produces the same data instead of duplicates.
 */
@Component({
  selector: 'app-seed-page',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonSpinner],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Development seed</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="ccp-page">
        <div class="ccp-content">
          <p class="ccp-kicker">Development only</p>
          <h1 class="ccp-display">Dashboard seed data</h1>
          <p class="ccp-body ccp-muted">
            Seeds repeatable dashboard data for {{ certs.join(' and ') }}. Seeding resets study
            data for those certs first, so reruns do not duplicate rows.
          </p>

          <div class="actions">
            <ion-button expand="block" [disabled]="busy()" (click)="seed()">
              Reset and seed dashboard data
            </ion-button>
            <ion-button
              expand="block"
              fill="outline"
              color="danger"
              [disabled]="busy()"
              (click)="clear()"
            >
              Clear seeded data
            </ion-button>
            <ion-button expand="block" fill="clear" [disabled]="busy()" (click)="openDashboard()">
              Open dashboard
            </ion-button>
          </div>

          @if (busy()) {
            <div class="status" role="status" aria-busy="true">
              <ion-spinner name="crescent" aria-hidden="true"></ion-spinner>
              <span>Working...</span>
            </div>
          }

          @if (message(); as text) {
            <p class="ccp-body" role="status">{{ text }}</p>
          }

          @if (error(); as text) {
            <p class="ccp-body error" role="alert">{{ text }}</p>
          }
        </div>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .actions {
        display: flex;
        flex-direction: column;
        gap: var(--ccp-space-md);
        margin-top: var(--ccp-space-lg);
      }

      .actions ion-button {
        margin: 0;
      }

      .status {
        align-items: center;
        display: flex;
        gap: var(--ccp-space-sm);
        margin-top: var(--ccp-space-lg);
      }

      .error {
        color: rgb(var(--ccp-danger));
      }
    `,
  ],
})
export class SeedPage {
  private readonly repository = inject(STUDY_REPOSITORY);
  private readonly router = inject(Router);

  protected readonly certs = seededCertCodes();
  protected readonly busy = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected async seed(): Promise<void> {
    await this.run(async () => {
      const result = await seedDashboard(this.repository);
      return `Seeded ${result.attempts} attempts, ${result.examResults} exam question results, ${result.practiceResults} practice results, ${result.sessions} sessions, ${result.progressRows} progress rows, and ${result.masteryRows} mastery rows.`;
    });
  }

  protected async clear(): Promise<void> {
    await this.run(async () => {
      await clearDashboardSeed(this.repository);
      return 'Cleared seeded study data for clf-c02 and aif-c01.';
    });
  }

  protected async openDashboard(): Promise<void> {
    await this.router.navigateByUrl('/tabs/home');
  }

  private async run(action: () => Promise<string>): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.message.set(null);
    this.error.set(null);
    try {
      this.message.set(await action());
    } catch (cause) {
      this.error.set(cause instanceof Error ? cause.message : String(cause));
    } finally {
      this.busy.set(false);
    }
  }
}
