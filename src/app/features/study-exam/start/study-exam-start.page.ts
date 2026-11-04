import { Component, ElementRef, HostListener, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';

import { getCert, listCerts, type Certification } from '../../../core/content/cert-registry';
import { getExamDomainTargets } from '../../../core/exam';
import { SETTINGS_KEYS, readSetting } from '../../../core/settings/local-settings';
import { HomeButtonComponent } from '../../../layout/home-button/home-button.component';
import { StudyExamSessionService } from '../session/study-exam-session.service';
import { studyExamRunPath } from '../study-exam.routes';

/**
 * Study exam start screen (issue 006, S1, S10; STUDY-59, STUDY-60).
 *
 * The screen explains the mode in the student's terms and never pressures
 * time: the study exam is untimed, so there is no countdown, no deadline,
 * and no auto-submit anywhere on this screen (S1, STUDY-1). The copy states
 * the four promises of the mode verbatim: untimed, feedback after every
 * answer, saved automatically, resumable (STUDY-59).
 *
 * Every number on screen comes from the bundled cert registry and the
 * engine: the question count is the registry `examQuestionCount`, and the
 * domain split is `getExamDomainTargets`, the exact composition the session
 * service will draw, so the screen can never disagree with the exam.
 *
 * Resume-primary (STUDY-60): the screen asks the service whether an
 * in-progress study exam exists for the cert. When one does, Resume renders
 * first as the solid primary action and Start drops to an outline, so the
 * primary action is distinguishable visually and in the DOM.
 *
 * Resume-or-discard (S10; STUDY-34, STUDY-35, STUDY-41): pressing Start
 * while a session is in progress never starts or discards anything on its
 * own. It opens an explicit choice dialog. The discard path then asks for a
 * second confirmation, and only that confirmation calls the service
 * `discard()`, always before the fresh `start()`.
 *
 * Refusals: a cert whose registry status is not active never reaches the
 * service. Any refusal the service raises (for example a bank too short to
 * fill the composition) is shown verbatim, never paraphrased.
 *
 * Accessibility: exactly one h1; every action is an `ion-button` with a text
 * label; both dialogs are `alertdialog` with `aria-modal`, a labelled title,
 * a focus trap, Escape to cancel, and focus returned to the trigger
 * (ACC-2, ACC-8). Refusals use `role="alert"` so they are announced (ACC-7).
 */

/** One line of the domain split: the exact count the exam draws per domain. */
interface DomainFact {
  readonly id: number;
  readonly name: string;
  readonly questions: number;
}

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

/**
 * The domain split the exam will use, from the engine composition rules:
 * domain proportions with the last-domain remainder (S2). The screen shows
 * these counts instead of re-deriving them, so it always matches the exam.
 */
function buildDomainFacts(cert: Certification): readonly DomainFact[] {
  const targets = getExamDomainTargets(cert);
  return cert.domains.map((domain) => ({
    id: domain.id,
    name: domain.name,
    questions: targets[domain.id] ?? 0,
  }));
}

@Component({
  selector: 'app-study-exam-start',
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
        <ion-title>Study exam</ion-title>
        <app-home-button />
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="ccp-page">
        <div class="ccp-content">
          <p class="ccp-kicker">Study exam</p>
          <h1 class="ccp-display">Study exam</h1>

          @if (cert; as activeCert) {
            <p class="ccp-body ccp-muted">
              {{ activeCert.name }} ({{ activeCert.shortName }}). A full exam
              at your own pace, kept on this device only.
            </p>

            <ul class="mode-points ccp-body ccp-muted">
              <li>Untimed: no countdown, no deadline, no auto-submit.</li>
              <li>Feedback after every answer, right where you answer.</li>
              <li>Progress is saved automatically after every graded answer.</li>
              <li>Stop at any point and resume exactly where you left off.</li>
            </ul>

            <div class="ccp-card facts">
              <h2 class="ccp-card-heading">Exam facts</h2>
              <dl class="fact-list">
                <div class="fact">
                  <dt class="ccp-small ccp-muted">Format</dt>
                  <dd class="ccp-body">Untimed study exam with feedback after every answer</dd>
                </div>
                <div class="fact">
                  <dt class="ccp-small ccp-muted">Questions</dt>
                  <dd class="ccp-body">{{ activeCert.examQuestionCount }}</dd>
                </div>
                <div class="fact">
                  <dt class="ccp-small ccp-muted">Domain split</dt>
                  <dd class="ccp-body">
                    <ul class="domain-list">
                      @for (domain of domainFacts; track domain.id) {
                        <li>
                          {{ domain.name }}: {{ domain.questions }} of
                          {{ activeCert.examQuestionCount }}
                        </li>
                      }
                    </ul>
                  </dd>
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
                    >Resume study exam</ion-button
                  >
                }
                <ion-button
                  class="ccp-pressable"
                  color="primary"
                  [fill]="inProgress() ? 'outline' : 'solid'"
                  expand="block"
                  [disabled]="busy()"
                  (click)="onStart()"
                  >Start study exam</ion-button
                >
              </div>
            }

            @if (errorMessage(); as message) {
              <p class="ccp-body refusal" role="alert">{{ message }}</p>
            }
          } @else {
            <p class="ccp-body ccp-muted" role="alert">
              No active certification is available for a study exam yet.
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
            aria-labelledby="study-exam-choice-title"
            aria-describedby="study-exam-choice-description"
          >
            <h2 id="study-exam-choice-title" class="ccp-card-heading">
              Study exam already in progress
            </h2>
            <p id="study-exam-choice-description" class="ccp-body ccp-muted">
              A study exam is already in progress for {{ cert?.name }}. Resume
              it where you left off, or discard that session and start a fresh
              one.
            </p>
            <div class="choice-actions">
              <ion-button color="primary" expand="block" (click)="onChoiceResume()"
                >Resume study exam</ion-button
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

      @if (confirmOpen()) {
        <div class="choice-backdrop">
          <div
            class="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="study-exam-confirm-title"
            aria-describedby="study-exam-confirm-description"
          >
            <h2 id="study-exam-confirm-title" class="ccp-card-heading">
              Discard saved exam?
            </h2>
            <p id="study-exam-confirm-description" class="ccp-body ccp-muted">
              The saved study exam for {{ cert?.name }} will be removed, along
              with every recorded answer. This cannot be undone.
            </p>
            <div class="choice-actions">
              <ion-button color="danger" expand="block" (click)="onConfirmDiscard()"
                >Discard saved exam</ion-button
              >
              <ion-button fill="clear" expand="block" (click)="onConfirmCancel()"
                >Keep saved exam</ion-button
              >
            </div>
          </div>
        </div>
      }
    </ion-content>
  `,
  styles: [
    `
      .mode-points {
        display: grid;
        gap: var(--ccp-space-xs);
        margin: var(--ccp-space-base) 0 0;
        padding-left: var(--ccp-space-lg);
      }

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

      .domain-list {
        display: grid;
        gap: var(--ccp-space-xs);
        list-style: none;
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

      .choice-dialog,
      .confirm-dialog {
        background: rgb(var(--ccp-bg-card));
        border-radius: var(--ccp-radius-card);
        box-shadow: var(--ccp-shadow-overlay);
        max-width: 420px;
        padding: var(--ccp-space-lg);
        width: 100%;
      }

      .choice-dialog h2,
      .confirm-dialog h2 {
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
export class StudyExamStartPage implements OnInit {
  private readonly router = inject(Router);
  private readonly sessions = inject(StudyExamSessionService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The cert this screen serves, resolved once from settings and the registry. */
  protected readonly cert: Certification | null = resolveCert();

  /** The exact per-domain split the exam will draw, from the engine (S2). */
  protected readonly domainFacts: readonly DomainFact[] = this.cert
    ? buildDomainFacts(this.cert)
    : [];

  /**
   * A coming-soon cert never reaches the service: the refusal is stated
   * here, in the same shape the service uses for its own refusals, and no
   * Start or Resume action is offered.
   */
  protected readonly startRefusal: string | null =
    this.cert && this.cert.status !== 'active'
      ? `Cert "${this.cert.code}" is coming soon; a study exam is refused.`
      : null;

  /** True when the service reports a resumable session for the cert (STUDY-60). */
  protected readonly inProgress = signal(false);
  /** True while a lifecycle call is in flight; actions stay disabled. */
  protected readonly busy = signal(false);
  /** True while the resume-or-discard dialog is open (S10, STUDY-35). */
  protected readonly choiceOpen = signal(false);
  /** True while the discard confirmation dialog is open (S10, STUDY-41). */
  protected readonly confirmOpen = signal(false);
  /** The exact message the service produced, shown verbatim. */
  protected readonly errorMessage = signal<string | null>(null);

  /** The element that opened the choice dialog, refocused when it closes (ACC-8). */
  private dialogReturnFocus: HTMLElement | null = null;

  async ngOnInit(): Promise<void> {
    await this.refreshInProgress();
  }

  /** Start pressed: ask first when a session is in progress (S10, STUDY-35). */
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

  /** Resume pressed on the screen itself (STUDY-60). */
  protected async onResume(): Promise<void> {
    if (this.busy() || !this.cert) {
      return;
    }
    this.errorMessage.set(null);
    this.busy.set(true);
    try {
      const resumed = await this.sessions.resume(this.cert.code);
      if (!resumed) {
        // The stored session was unreadable and the service quarantined it
        // (DATA-23); the Resume offer must go away with it.
        this.inProgress.set(false);
        return;
      }
      await this.router.navigateByUrl(studyExamRunPath(this.cert.code));
    } catch (error) {
      this.errorMessage.set(this.messageOf(error));
    } finally {
      this.busy.set(false);
    }
  }

  /** Choice dialog: resume the existing session; nothing is started or discarded. */
  protected async onChoiceResume(): Promise<void> {
    this.closeChoice();
    await this.onResume();
  }

  /**
   * Choice dialog: the discard path never discards here. STUDY-41 requires a
   * second confirmation, so this only swaps the choice dialog for the
   * confirm dialog.
   */
  protected onChoiceDiscard(): void {
    this.choiceOpen.set(false);
    this.openConfirm();
  }

  /** Choice dialog: keep the in-progress session exactly as it is. */
  protected onChoiceCancel(): void {
    this.closeChoice();
  }

  /**
   * Confirm dialog: the explicit discard. `discard()` removes the saved
   * session and always lands before the fresh `start()` (S10, STUDY-41).
   */
  protected async onConfirmDiscard(): Promise<void> {
    this.closeConfirm();
    if (this.busy() || !this.cert) {
      return;
    }
    this.errorMessage.set(null);
    this.busy.set(true);
    try {
      await this.sessions.discard(this.cert.code);
      await this.sessions.start(this.cert.code);
      await this.refreshInProgress();
      await this.router.navigateByUrl(studyExamRunPath(this.cert.code));
    } catch (error) {
      this.errorMessage.set(this.messageOf(error));
    } finally {
      this.busy.set(false);
    }
  }

  /** Confirm dialog: keep the saved session and go back to the screen. */
  protected onConfirmCancel(): void {
    this.closeConfirm();
  }

  /**
   * Keyboard support for the dialogs: Escape cancels the open dialog, Tab
   * stays trapped inside it (ACC-8). Bound on the host because focus lives
   * on the dialog buttons while a dialog is open.
   */
  @HostListener('keydown', ['$event'])
  protected onDialogKeydown(event: KeyboardEvent): void {
    if (this.confirmOpen()) {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.onConfirmCancel();
        return;
      }
      if (event.key === 'Tab') {
        this.trapTab(event, '.confirm-dialog');
      }
      return;
    }
    if (!this.choiceOpen()) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.onChoiceCancel();
      return;
    }
    if (event.key === 'Tab') {
      this.trapTab(event, '.choice-dialog');
    }
  }

  private trapTab(event: KeyboardEvent, selector: string): void {
    const dialog = this.host.nativeElement.querySelector(selector);
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
      await this.router.navigateByUrl(studyExamRunPath(cert.code));
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
      // A failed read is not a resumable session; the Start path stays correct.
      this.inProgress.set(false);
    }
  }

  private openChoice(): void {
    this.dialogReturnFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.choiceOpen.set(true);
    this.focusFirst('.choice-dialog');
  }

  private openConfirm(): void {
    // The return-focus element was captured when the choice dialog opened;
    // the confirm dialog continues the same flow, so it is kept (ACC-8).
    this.confirmOpen.set(true);
    this.focusFirst('.confirm-dialog');
  }

  private closeChoice(): void {
    this.choiceOpen.set(false);
    this.restoreDialogFocus();
  }

  private closeConfirm(): void {
    this.confirmOpen.set(false);
    this.restoreDialogFocus();
  }

  private focusFirst(selector: string): void {
    setTimeout(() => {
      const first = this.host.nativeElement.querySelector<HTMLElement>(
        `${selector} ion-button`,
      );
      first?.focus();
    });
  }

  private restoreDialogFocus(): void {
    const target = this.dialogReturnFocus;
    this.dialogReturnFocus = null;
    if (target) {
      setTimeout(() => target.focus());
    }
  }

  /** The service message verbatim; only non-Error throws get String(). */
  private messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
