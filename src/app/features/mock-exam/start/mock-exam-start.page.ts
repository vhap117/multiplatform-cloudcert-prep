import { Component, ElementRef, HostListener, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';

import { getCert, listCerts, type Certification } from '../../../core/content/cert-registry';
import { formatTotalTime } from '../../../core/exam';
import { SETTINGS_KEYS, readSetting } from '../../../core/settings/local-settings';
import { HomeButtonComponent } from '../../../layout/home-button/home-button.component';
import { mockExamRunPath } from '../mock-exam.routes';
import { MockExamSessionService } from '../session/mock-exam-session.service';

/**
 * Mock exam start screen (issue 005, S10; EXAM-1, EXAM-4, EXAM-5, EXAM-6,
 * DATA-40).
 *
 * Every number on screen comes from the bundled cert registry (EXAM-1); the
 * duration is formatted with the engine `formatTotalTime`. The screen never
 * touches the network or storage directly: attempt lifecycle goes through
 * `MockExamSessionService`, and the cert choice is the local settings
 * selection when one exists, otherwise the first active cert.
 *
 * Resume-or-discard (EXAM-6, DATA-40): pressing Start while an attempt is in
 * progress never starts or discards anything on its own. It opens an
 * explicit choice dialog; only the Discard path calls the service
 * `abandon()`, and always before the fresh `start()`.
 *
 * Refusals: a cert whose registry status is not active never reaches the
 * service. Any refusal the service raises (for example a bank too short to
 * supply the exam) is shown verbatim, never paraphrased.
 *
 * Accessibility: exactly one h1; every action is an `ion-button` with a text
 * label; the choice dialog is an `alertdialog` with `aria-modal`, a labelled
 * title, a focus trap, Escape to cancel, and focus returned to the trigger
 * (ACC-2, ACC-8). Refusals use `role="alert"` so they are announced (ACC-7).
 */

/**
 * The cert this screen serves: the settings selection when it resolves,
 * otherwise the first active cert in registry order.
 */
function resolveCert(): Certification | null {
  const selected = readSetting(SETTINGS_KEYS.selectedCert);
  if (selected) {
    const cert = getCert(selected);
    if (cert) {
      return cert;
    }
  }
  return listCerts({ activeOnly: true })[0] ?? null;
}

@Component({
  selector: 'app-mock-exam-start',
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
        <ion-title>Mock exam</ion-title>
        <app-home-button />
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="ccp-page">
        <div class="ccp-content">
          <p class="ccp-kicker">Mock exam</p>
          <h1 class="ccp-display">Mock exam</h1>

          @if (cert; as activeCert) {
            <p class="ccp-body ccp-muted">
              {{ activeCert.name }} ({{ activeCert.shortName }}). A timed,
              scored attempt that mirrors the real exam and never leaves this
              device.
            </p>

            <div class="ccp-card facts">
              <h2 class="ccp-card-heading">Exam facts</h2>
              <dl class="fact-list">
                <div class="fact">
                  <dt class="ccp-small ccp-muted">Format</dt>
                  <dd class="ccp-body">Timed mock exam, scored by percentage</dd>
                </div>
                <div class="fact">
                  <dt class="ccp-small ccp-muted">Questions</dt>
                  <dd class="ccp-body">{{ activeCert.examQuestionCount }}</dd>
                </div>
                <div class="fact">
                  <dt class="ccp-small ccp-muted">Duration</dt>
                  <dd class="ccp-body">{{ durationLabel }}</dd>
                </div>
                <div class="fact">
                  <dt class="ccp-small ccp-muted">Passing score</dt>
                  <dd class="ccp-body">{{ activeCert.passingPercent }} percent</dd>
                </div>
              </dl>
            </div>

            @if (startRefusal; as refusal) {
              <p class="ccp-body refusal" role="alert">{{ refusal }}</p>
            } @else {
              <div class="actions">
                @if (inProgress()) {
                  <ion-button
                    class="ccp-pressable"
                    color="primary"
                    expand="block"
                    [disabled]="busy()"
                    (click)="onResume()"
                    >Resume exam</ion-button
                  >
                }
                <ion-button
                  class="ccp-pressable"
                  color="primary"
                  [fill]="inProgress() ? 'outline' : 'solid'"
                  expand="block"
                  [disabled]="busy()"
                  (click)="onStart()"
                  >Start exam</ion-button
                >
              </div>
            }

            @if (errorMessage(); as message) {
              <p class="ccp-body refusal" role="alert">{{ message }}</p>
            }
          } @else {
            <p class="ccp-body ccp-muted" role="alert">
              No active certification is available for a mock exam yet.
            </p>
          }
        </div>
      </div>

      @if (choiceOpen()) {
        <div class="choice-backdrop">
          <div
            class="choice-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="mock-exam-choice-title"
            aria-describedby="mock-exam-choice-description"
          >
            <h2 id="mock-exam-choice-title" class="ccp-card-heading">
              Exam already in progress
            </h2>
            <p id="mock-exam-choice-description" class="ccp-body ccp-muted">
              A mock exam is already in progress for {{ cert?.name }}. Resume it
              where you left off, or discard that attempt and start a fresh one.
            </p>
            <div class="choice-actions">
              <ion-button color="primary" expand="block" (click)="onChoiceResume()"
                >Resume exam</ion-button
              >
              <ion-button color="danger" fill="outline" expand="block" (click)="onChoiceDiscard()"
                >Discard and start fresh</ion-button
              >
              <ion-button fill="clear" expand="block" (click)="onChoiceCancel()"
                >Cancel</ion-button
              >
            </div>
          </div>
        </div>
      }
    </ion-content>
  `,
  styles: [
    `
      .facts {
        margin-top: var(--ccp-space-lg);
      }

      .fact-list {
        display: grid;
        gap: var(--ccp-space-base);
        margin: var(--ccp-space-base) 0 0;
      }

      .fact {
        display: flex;
        flex-direction: column;
        gap: var(--ccp-space-xs);
        margin: 0;
      }

      .fact dt,
      .fact dd {
        margin: 0;
        padding: 0;
      }

      .actions {
        display: flex;
        flex-direction: column;
        gap: var(--ccp-space-md);
        margin-top: var(--ccp-space-lg);
      }

      .actions ion-button,
      .choice-actions ion-button {
        margin: 0;
      }

      .refusal {
        color: rgb(var(--ccp-danger));
        margin-top: var(--ccp-space-lg);
      }

      .choice-backdrop {
        align-items: center;
        background: rgb(15 25 35 / 0.45);
        display: flex;
        inset: 0;
        justify-content: center;
        padding: var(--ccp-space-lg);
        position: fixed;
        z-index: 10000;
      }

      .choice-dialog {
        background: rgb(var(--ccp-bg-card));
        border-radius: var(--ccp-radius-card);
        box-shadow: var(--ccp-shadow-overlay);
        max-width: 420px;
        padding: var(--ccp-space-lg);
        width: 100%;
      }

      .choice-dialog h2 {
        margin-top: 0;
      }

      .choice-actions {
        display: flex;
        flex-direction: column;
        gap: var(--ccp-space-md);
        margin-top: var(--ccp-space-lg);
      }
    `,
  ],
})
export class MockExamStartPage implements OnInit {
  private readonly router = inject(Router);
  private readonly sessions = inject(MockExamSessionService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The cert this screen serves, resolved once from settings and the registry. */
  protected readonly cert: Certification | null = resolveCert();

  /** Registry duration, formatted by the engine (EXAM-1, EXAM-4). */
  protected readonly durationLabel = this.cert
    ? formatTotalTime(Math.round(this.cert.examTimeSeconds / 60))
    : '';

  /**
   * A coming-soon cert never reaches the service: the refusal is stated
   * here, in the same shape the service uses for its own refusals, and no
   * Start or Resume action is offered.
   */
  protected readonly startRefusal: string | null =
    this.cert && this.cert.status !== 'active'
      ? `Cert "${this.cert.code}" is coming soon; a mock exam is refused.`
      : null;

  /** True when the service reports a resumable attempt for the cert (EXAM-5). */
  protected readonly inProgress = signal(false);
  /** True while a lifecycle call is in flight; actions stay disabled. */
  protected readonly busy = signal(false);
  /** True while the resume-or-discard dialog is open (EXAM-6, DATA-40). */
  protected readonly choiceOpen = signal(false);
  /** The exact message the service produced, shown verbatim. */
  protected readonly errorMessage = signal<string | null>(null);

  /** The element that opened the choice dialog, refocused when it closes (ACC-8). */
  private choiceReturnFocus: HTMLElement | null = null;

  async ngOnInit(): Promise<void> {
    await this.refreshInProgress();
  }

  /** Start pressed: ask first when an attempt is in progress (EXAM-6, DATA-40). */
  protected async onStart(): Promise<void> {
    if (this.busy() || !this.cert || this.startRefusal) {
      return;
    }
    this.errorMessage.set(null);
    if (this.inProgress()) {
      this.openChoice();
      return;
    }
    await this.beginFresh();
  }

  /** Resume pressed on the screen itself (EXAM-5). */
  protected async onResume(): Promise<void> {
    if (this.busy() || !this.cert) {
      return;
    }
    this.errorMessage.set(null);
    this.busy.set(true);
    try {
      const resumed = await this.sessions.resume(this.cert.code);
      if (!resumed) {
        // The stored attempt was unreadable and the service quarantined it
        // (DATA-23); the Resume offer must go away with it.
        this.inProgress.set(false);
        return;
      }
      await this.router.navigateByUrl(mockExamRunPath(this.cert.code));
    } catch (error) {
      this.errorMessage.set(this.messageOf(error));
    } finally {
      this.busy.set(false);
    }
  }

  /** Dialog: resume the existing attempt; nothing is started or discarded. */
  protected async onChoiceResume(): Promise<void> {
    this.closeChoice();
    await this.onResume();
  }

  /** Dialog: the explicit discard. abandon always lands before start (DATA-40). */
  protected async onChoiceDiscard(): Promise<void> {
    this.closeChoice();
    if (this.busy() || !this.cert) {
      return;
    }
    this.errorMessage.set(null);
    this.busy.set(true);
    try {
      await this.sessions.abandon();
      await this.sessions.start(this.cert.code);
      await this.refreshInProgress();
      await this.router.navigateByUrl(mockExamRunPath(this.cert.code));
    } catch (error) {
      this.errorMessage.set(this.messageOf(error));
    } finally {
      this.busy.set(false);
    }
  }

  /** Dialog: keep the in-progress attempt exactly as it is. */
  protected onChoiceCancel(): void {
    this.closeChoice();
  }

  /**
   * Keyboard support for the dialog: Escape cancels, Tab stays trapped
   * (ACC-8). Bound on the host because focus lives on the dialog buttons
   * while the dialog is open.
   */
  @HostListener('keydown', ['$event'])
  protected onChoiceKeydown(event: KeyboardEvent): void {
    if (!this.choiceOpen()) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.onChoiceCancel();
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    const dialog = this.host.nativeElement.querySelector('.choice-dialog');
    if (!dialog) {
      return;
    }
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>('ion-button:not([disabled]), button:not([disabled])'),
    );
    if (focusable.length === 0) {
      return;
    }
    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || first.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || last.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  private async beginFresh(): Promise<void> {
    const cert = this.cert;
    if (!cert) {
      return;
    }
    this.busy.set(true);
    try {
      await this.sessions.start(cert.code);
      await this.refreshInProgress();
      await this.router.navigateByUrl(mockExamRunPath(cert.code));
    } catch (error) {
      this.errorMessage.set(this.messageOf(error));
    } finally {
      this.busy.set(false);
    }
  }

  private async refreshInProgress(): Promise<void> {
    const cert = this.cert;
    if (!cert || this.startRefusal) {
      this.inProgress.set(false);
      return;
    }
    try {
      this.inProgress.set(await this.sessions.hasInProgress(cert.code));
    } catch {
      // A failed read is not a resumable attempt; the Start path stays correct.
      this.inProgress.set(false);
    }
  }

  private openChoice(): void {
    this.choiceReturnFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.choiceOpen.set(true);
    setTimeout(() => {
      const first = this.host.nativeElement.querySelector<HTMLElement>(
        '.choice-dialog ion-button',
      );
      first?.focus();
    });
  }

  private closeChoice(): void {
    this.choiceOpen.set(false);
    const target = this.choiceReturnFocus;
    this.choiceReturnFocus = null;
    if (target) {
      setTimeout(() => target.focus());
    }
  }

  /** The service message verbatim; only non-Error throws get String(). */
  private messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
