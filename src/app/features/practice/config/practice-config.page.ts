import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  AlertController,
  IonButton,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import { getCert, type Certification } from '../../../core/content/cert-registry';
import { HomeButtonComponent } from '../../../layout/home-button/home-button.component';
import {
  DEFAULT_PRACTICE_QUESTIONS,
  MAX_PRACTICE_QUESTIONS,
  MIN_PRACTICE_QUESTIONS,
} from '../../../core/exam';

import { practiceRunPath } from '../practice.routes';
import { PracticeSessionService } from '../session/practice-session.service';
import { hasAvailableQuestions } from './practice-availability';

const SIZE_STEP = 5;

/**
 * Domain practice config screen (issue 007, PRACT-2 to PRACT-8, SR-41).
 *
 * The student confirms one domain and a session size from 10 to 50 in steps
 * of 5, defaulting to 20. A deep link naming a domain preselects it, so the
 * dashboard Next up action can reuse this screen unchanged (PRACT-3, SR-39).
 *
 * Starting never silently replaces an in-progress session: the screen asks
 * for an explicit Resume, Discard and start fresh, or Cancel choice first
 * (PRACT-7). Discard always lands before the fresh start. A failed bank or
 * session read shows the service message verbatim and keeps Start usable;
 * Try again re-checks the saved session (PRACT-24, PRACT-25).
 */
@Component({
  selector: 'app-practice-config',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    HomeButtonComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Domain practice</ion-title>
        <app-home-button />
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="ccp-page">
        <div class="ccp-content">
          <p class="ccp-kicker">Adaptive practice</p>
          <h1 class="ccp-display">Domain practice</h1>

          @if (cert(); as activeCert) {
            <p class="ccp-body ccp-muted">
              {{ activeCert.name }} ({{ activeCert.shortName }}). Pick one domain
              and a session size. Questions adapt to your local history.
            </p>

            @if (hasQuestions()) {
            <fieldset class="domain-picker">
              <legend class="ccp-card-heading">Domain</legend>
              @for (domain of activeCert.domains; track domain.id) {
                <label class="domain-option">
                  <input
                    type="radio"
                    [name]="'practice-domain-' + activeCert.code"
                    [value]="domain.id"
                    [checked]="selectedDomainId() === domain.id"
                    (change)="selectDomain(domain.id)"
                  />
                  <span class="ccp-body">{{ domain.name }}</span>
                </label>
              }
            </fieldset>

            <div class="size-control">
              <span class="ccp-card-heading" id="practice-size-label">
                Session size
              </span>
              <div class="size-row" role="group" aria-labelledby="practice-size-label">
                <button
                  type="button"
                  class="ccp-button"
                  aria-label="Decrease session size"
                  [disabled]="busy() || !canDecrease()"
                  (click)="decreaseSize()"
                >
                  -
                </button>
                <output class="size-value">{{ size() }} questions</output>
                <button
                  type="button"
                  class="ccp-button"
                  aria-label="Increase session size"
                  [disabled]="busy() || !canIncrease()"
                  (click)="increaseSize()"
                >
                  +
                </button>
              </div>
            </div>

            @if (errorMessage(); as message) {
              <p class="ccp-body refusal" role="alert">{{ message }}</p>
              @if (loadFailed()) {
                <ion-button fill="outline" expand="block" [disabled]="busy()" (click)="retryLoad()">
                  Try again
                </ion-button>
              }
            }

            <div class="actions">
              @if (inProgress()) {
                <ion-button
                  color="primary"
                  expand="block"
                  [disabled]="busy()"
                  (click)="onResume()"
                  >Resume practice</ion-button
                >
              }
              <ion-button
                color="primary"
                [fill]="inProgress() ? 'outline' : 'solid'"
                expand="block"
                [disabled]="busy()"
                (click)="onStart()"
                >Start practice</ion-button
              >
            </div>
            } @else {
              <p class="ccp-body ccp-muted" role="alert">
                No questions are available for this certification yet.
              </p>
            }
          } @else {
            <p class="ccp-body ccp-muted" role="alert">
              Cert "{{ certCode() }}" is not bundled, so practice cannot start.
            </p>
          }
        </div>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .domain-picker {
        border: 0;
        margin: var(--ccp-space-lg) 0 0;
        padding: 0;
      }

      .domain-picker legend {
        margin-bottom: var(--ccp-space-sm);
        padding: 0;
      }

      .domain-option {
        align-items: center;
        display: flex;
        gap: var(--ccp-space-sm);
        margin-bottom: var(--ccp-space-sm);
      }

      .size-control {
        margin-top: var(--ccp-space-lg);
      }

      .size-row {
        align-items: center;
        display: flex;
        gap: var(--ccp-space-md);
        margin-top: var(--ccp-space-sm);
      }

      .size-value {
        font-weight: 600;
        min-width: 9rem;
        text-align: center;
      }

      .actions {
        display: flex;
        flex-direction: column;
        gap: var(--ccp-space-md);
        margin-top: var(--ccp-space-lg);
      }

      .refusal {
        color: rgb(var(--ccp-danger));
        margin-top: var(--ccp-space-lg);
      }
    `,
  ],
})
export class PracticeConfigPage implements OnInit {
  private readonly router = inject(Router);
  private readonly alerts = inject(AlertController);
  private readonly sessions = inject(PracticeSessionService);

  readonly certCode = input<string>('');
  /** The domain named by a deep link; invalid values fall back to domain 1. */
  readonly domain = input<string>();

  readonly cert = computed<Certification | null>(() => getCert(this.certCode()));
  readonly hasQuestions = computed(() => hasAvailableQuestions(this.cert()));

  readonly selectedDomainId = signal(1);
  readonly size = signal(DEFAULT_PRACTICE_QUESTIONS);
  readonly inProgress = signal(false);
  readonly busy = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly loadFailed = signal(false);

  async ngOnInit(): Promise<void> {
    const cert = this.cert();
    const requested = Number(this.domain());
    const firstDomain = cert?.domains[0]?.id ?? 1;
    const valid = cert?.domains.some((candidate) => candidate.id === requested) ?? false;
    this.selectedDomainId.set(valid ? requested : firstDomain);
    await this.refreshInProgress();
  }

  selectDomain(domainId: number): void {
    this.selectedDomainId.set(domainId);
  }

  readonly canDecrease = computed(() => this.size() > MIN_PRACTICE_QUESTIONS);
  readonly canIncrease = computed(() => this.size() < MAX_PRACTICE_QUESTIONS);

  decreaseSize(): void {
    this.size.update((current) => Math.max(MIN_PRACTICE_QUESTIONS, current - SIZE_STEP));
  }

  increaseSize(): void {
    this.size.update((current) => Math.min(MAX_PRACTICE_QUESTIONS, current + SIZE_STEP));
  }

  /** Start never replaces a saved session until the student chooses to (PRACT-7). */
  async onStart(): Promise<void> {
    if (this.busy() || !this.cert()) {
      return;
    }
    this.errorMessage.set(null);
    this.loadFailed.set(false);
    if (this.inProgress()) {
      await this.askResumeOrDiscard();
      return;
    }
    await this.beginFresh();
  }

  async onResume(): Promise<void> {
    if (this.busy() || !this.cert()) {
      return;
    }
    this.errorMessage.set(null);
    this.busy.set(true);
    try {
      const resumed = await this.sessions.resume(this.certCode());
      if (!resumed) {
        this.inProgress.set(false);
        return;
      }
      await this.router.navigateByUrl(practiceRunPath(this.certCode()));
    } catch (error) {
      this.errorMessage.set(messageOf(error));
    } finally {
      this.busy.set(false);
    }
  }

  async retryLoad(): Promise<void> {
    this.errorMessage.set(null);
    this.loadFailed.set(false);
    await this.refreshInProgress();
  }

  private async askResumeOrDiscard(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Practice already in progress',
      message:
        'A practice session is already in progress for this certification. Resume it where you left off, or discard it and start a fresh session.',
      buttons: [
        { text: 'Resume practice', role: 'resume' },
        { text: 'Discard and start fresh', role: 'discard' },
        { text: 'Cancel', role: 'cancel' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role === 'resume') {
      await this.onResume();
    } else if (role === 'discard') {
      await this.discardAndStart();
    }
  }

  private async discardAndStart(): Promise<void> {
    if (this.busy() || !this.cert()) {
      return;
    }
    this.busy.set(true);
    try {
      await this.sessions.discard(this.certCode());
      await this.sessions.start(this.certCode(), this.selectedDomainId(), this.size());
      await this.router.navigateByUrl(practiceRunPath(this.certCode()));
    } catch (error) {
      this.errorMessage.set(messageOf(error));
    } finally {
      this.busy.set(false);
    }
  }

  private async beginFresh(): Promise<void> {
    if (this.busy() || !this.cert()) {
      return;
    }
    this.busy.set(true);
    try {
      await this.sessions.start(this.certCode(), this.selectedDomainId(), this.size());
      await this.router.navigateByUrl(practiceRunPath(this.certCode()));
    } catch (error) {
      this.errorMessage.set(messageOf(error));
    } finally {
      this.busy.set(false);
    }
  }

  private async refreshInProgress(): Promise<void> {
    if (!this.cert()) {
      this.inProgress.set(false);
      return;
    }
    try {
      this.inProgress.set(await this.sessions.hasInProgress(this.certCode()));
    } catch (error) {
      this.inProgress.set(false);
      this.loadFailed.set(true);
      this.errorMessage.set(messageOf(error));
    }
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
