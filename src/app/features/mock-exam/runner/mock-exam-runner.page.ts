/**
 * Mock exam runner (issue 005: S3, S11, S12, S13, plus EXAM-24 to EXAM-27).
 *
 * The screen owns everything the student does while the clock runs: answer
 * capture for the four response formats, flagging, grid and previous or next
 * navigation, the persistent status toolbar, the submit confirmation, and the
 * leave confirmation that `mockExamLeaveGuard` delegates to.
 *
 * Invariants:
 *
 * - Every response goes through `MockExamSessionService.answer` the moment it
 *   is given, before any navigation (S2, EXAM-14). Single answers persist on
 *   selection; multi drafts persist on an explicit confirm capped at the
 *   engine `MAX_MULTI_ANSWER`; ordering persists on every move; matching
 *   persists on every chosen target (S3, EXAM-8, EXAM-9).
 * - The clock is wall clock: remaining time is recomputed from the service on
 *   a one second interval and on `visibilitychange`, never decremented
 *   locally (S4, EXAM-20 to EXAM-23). When the deadline has passed the
 *   service ends the attempt, including on entry after the app was
 *   backgrounded (S5, EXAM-24).
 * - The low-time warning fires once per crossing of the documented ten minute
 *   threshold through a polite live region, not on every tick (S13, EXAM-25,
 *   EXAM-26).
 * - The result panel is a stopgap summary of what the service returns; the
 *   full results screen and the review list are a later task and stay out of
 *   scope here.
 */

import {
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import { questionType, type Question } from '../../../core/content/question-types';
import { MAX_MULTI_ANSWER, formatTime } from '../../../core/exam';
import { mockExamResultsPath, mockExamStartPath } from '../mock-exam.routes';
import { MockExamSessionService } from '../session/mock-exam-session.service';

interface OptionEntry {
  key: string;
  text: string;
}

@Component({
  selector: 'app-mock-exam-runner',
  imports: [IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar],
  templateUrl: './mock-exam-runner.page.html',
  styleUrl: './mock-exam-runner.page.css',
  host: {
    '(document:visibilitychange)': 'onVisibilityChange()',
  },
})
export class MockExamRunnerPage implements OnInit, OnDestroy {
  protected readonly session = inject(MockExamSessionService);
  private readonly alerts = inject(AlertController);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);

  /**
   * Cert code bound from the route by the parent wiring. Used only for the
   * defensive resume when the runner opens without an active session; the
   * start screen owns the normal start and resume flow.
   */
  readonly certCode = input<string>();

  /**
   * Documented low-time threshold in seconds (S13, EXAM-25). Below ten
   * minutes the timer shows its low state and the polite live region
   * announces the crossing once.
   */
  readonly lowTimeThresholdSeconds = 600;

  readonly typeOf = questionType;
  readonly formatTime = formatTime;

  /**
   * Engine multi limit, read through a getter.
   *
   * A plain readonly field initialized from the imported constant was observed
   * reading undefined inside the merged unit-test bundle, which silently
   * disabled the limit. Reading it at call time keeps the value tied to the
   * module namespace, whatever the bundler does with the initialization order.
   */
  get maxMulti(): number {
    return MAX_MULTI_ANSWER;
  }

  readonly remainingSeconds = signal(0);
  readonly formattedRemaining = computed(() => formatTime(this.remainingSeconds()));
  readonly lowTime = signal(false);
  readonly lowTimeAnnouncement = signal('');

  readonly singleSelection = signal<string | null>(null);
  readonly multiDraft = signal<readonly string[]>([]);
  readonly orderingDraft = signal<readonly string[]>([]);
  readonly matchingDraft = signal<Readonly<Partial<Record<string, string>>>>({});

  readonly actionError = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly unavailable = signal(false);

  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private endingExpired = false;

  /** Reload the local drafts whenever the displayed question changes. */
  private readonly draftLoader = effect(() => {
    const question = this.session.currentQuestion();
    if (!question || this.session.result() !== null) {
      return;
    }
    this.loadDrafts(question);
  });

  /** The countdown stops once a result exists; the attempt is over. */
  private readonly clockStopper = effect(() => {
    if (this.session.result() !== null) {
      this.stopClock();
    }
  });

  async ngOnInit(): Promise<void> {
    await this.initialise();
  }

  ngOnDestroy(): void {
    this.stopClock();
  }

  /**
   * Enter logic. When the runner opens with a resumable but inactive session
   * (for example after a force close and a deep link), restore it first; then
   * `endIfExpired` ends the attempt when the deadline passed while
   * backgrounded, with the results already committed by the service (S5,
   * EXAM-24).
   */
  private async initialise(): Promise<void> {
    if (!this.session.isActive()) {
      const cert = this.certCode();
      if (cert !== undefined && cert !== '' && (await this.hasResumableSession(cert))) {
        if (!(await this.confirmResume())) {
          await this.router.navigateByUrl(mockExamStartPath(cert));
          return;
        }
      }
      let resumed = false;
      if (cert !== undefined && cert !== '') {
        try {
          resumed = await this.session.resume(cert);
        } catch {
          resumed = false;
        }
      }
      if (!resumed && !this.session.isActive()) {
        this.unavailable.set(true);
        return;
      }
    }
    this.unavailable.set(false);
    this.refreshClock();
    await this.endIfExpiredQuietly();
    this.startClock();
  }

  private async hasResumableSession(cert: string): Promise<boolean> {
    try {
      return await this.session.hasInProgress(cert);
    } catch {
      return false;
    }
  }

  /**
   * CERT-32: opening directly into a timed attempt asks before resuming. The
   * timer keeps running while the attempt is saved, so the student chooses
   * whether to jump back into it. Explicit Resume actions on the dashboard and
   * the start screen resume before navigating, so they never reach this path.
   */
  private async confirmResume(): Promise<boolean> {
    const alert = await this.alerts.create({
      header: 'Resume timed exam?',
      message:
        'A timed attempt is saved on this device and its timer has kept running. Resume it now, or go back to the exam start screen.',
      buttons: [
        { text: 'Not now', role: 'cancel' },
        { text: 'Resume', role: 'confirm' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'confirm';
  }

  async retryInitialise(): Promise<void> {
    this.actionError.set(null);
    await this.initialise();
  }

  private startClock(): void {
    this.stopClock();
    this.zone.runOutsideAngular(() => {
      this.clockTimer = setInterval(() => this.refreshClock(), 1000);
    });
  }

  private stopClock(): void {
    if (this.clockTimer !== null) {
      clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
  }

  /** Recompute from the service on every tick; never decrement locally (S4). */
  private refreshClock(): void {
    const remaining = this.session.remainingSeconds();
    this.remainingSeconds.set(remaining);
    this.updateLowTime(remaining);
    if (remaining <= 0 && this.session.hasExpired()) {
      void this.endIfExpiredQuietly();
    }
  }

  /** Recompute as soon as the app returns from the background (EXAM-23). */
  onVisibilityChange(): void {
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }
    this.refreshClock();
  }

  private updateLowTime(remaining: number): void {
    const running = this.session.isActive() && this.session.result() === null;
    const low = running && remaining > 0 && remaining < this.lowTimeThresholdSeconds;
    if (low && !this.lowTime()) {
      this.lowTimeAnnouncement.set(`Low time warning: ${formatTime(remaining)} remaining.`);
    }
    this.lowTime.set(low);
  }

  private async endIfExpiredQuietly(): Promise<void> {
    if (this.endingExpired) {
      return;
    }
    this.endingExpired = true;
    try {
      await this.session.endIfExpired().then(async (attempt) => {
        if (attempt) {
          await this.navigateToResults(attempt.id);
        }
      });
    } catch {
      // A failed commit keeps the computed result on screen with a retry
      // affordance (EXAM-35); the result state renders it.
    } finally {
      this.endingExpired = false;
    }
  }

  /** Hand a finished attempt to the results screen (S8). */
  private async navigateToResults(attemptId: string): Promise<void> {
    const certCode = this.certCode();
    if (!certCode) {
      return;
    }
    await this.router.navigateByUrl(mockExamResultsPath(certCode, attemptId));
  }

  private loadDrafts(question: Question): void {
    const stored = this.session.answerFor(question.id);
    switch (questionType(question)) {
      case 'single':
        this.singleSelection.set(typeof stored === 'string' && stored !== '' ? stored : null);
        break;
      case 'multi':
        this.multiDraft.set(Array.isArray(stored) ? [...stored] : []);
        break;
      case 'ordering':
        this.orderingDraft.set(
          Array.isArray(stored) && stored.length > 0 ? [...stored] : this.optionKeys(question),
        );
        break;
      case 'matching':
        this.matchingDraft.set(this.matchDraftFrom(stored, question));
        break;
    }
  }

  private matchDraftFrom(
    stored: string | string[] | null,
    question: Question,
  ): Partial<Record<string, string>> {
    const draft: Partial<Record<string, string>> = {};
    for (const key of this.optionKeys(question)) {
      draft[key] = '';
    }
    if (Array.isArray(stored)) {
      for (const token of stored) {
        const [left, target] = token.split(':');
        if (left !== undefined && target !== undefined && left in draft) {
          draft[left] = target;
        }
      }
    }
    return draft;
  }

  optionEntries(question: Question): OptionEntry[] {
    return Object.entries(question.options).map(([key, text]) => ({ key, text }));
  }

  targetEntries(question: Question): OptionEntry[] {
    return Object.entries(question.targets ?? {}).map(([key, text]) => ({ key, text }));
  }

  optionText(question: Question, key: string): string {
    return question.options[key] ?? key;
  }

  private optionKeys(question: Question): string[] {
    return Object.keys(question.options);
  }

  /** Accessible cell label: the state is announced, never colour only (ACC-4). */
  gridLabel(question: Question, index: number): string {
    const parts = [`Question ${index + 1}`];
    parts.push(this.session.isAnswered(question.id) ? 'answered' : 'unanswered');
    if (this.session.isFlagged(question.id)) {
      parts.push('flagged');
    }
    if (index === this.session.currentIndex()) {
      parts.push('current');
    }
    return parts.join(', ');
  }

  /** Single answers persist the moment the option is selected (S3, EXAM-14). */
  async selectSingle(questionId: string, key: string): Promise<void> {
    if (this.singleSelection() === key) {
      return;
    }
    const previous = this.singleSelection();
    this.singleSelection.set(key);
    this.actionError.set(null);
    try {
      await this.session.answer(questionId, key);
    } catch {
      if (this.session.currentQuestion()?.id === questionId) {
        this.singleSelection.set(previous);
      }
      this.actionError.set('The answer could not be saved. Select the option again to retry.');
    }
  }

  /** Multi toggles only edit the draft; the limit caps new selections (S3). */
  toggleMulti(key: string): void {
    const draft = this.multiDraft();
    if (draft.includes(key)) {
      this.multiDraft.set(draft.filter((candidate) => candidate !== key));
      return;
    }
    if (draft.length >= this.maxMulti) {
      return;
    }
    this.multiDraft.set([...draft, key]);
  }

  /** The explicit confirm is what persists a multi response (S3, EXAM-9). */
  async confirmMulti(questionId: string): Promise<void> {
    const draft = [...this.multiDraft()];
    if (draft.length === 0) {
      return;
    }
    this.actionError.set(null);
    try {
      await this.session.answer(questionId, draft);
    } catch {
      this.actionError.set('The answer could not be saved. Confirm again to retry.');
    }
  }

  /** Ordering persists the full sequence on every move (EXAM-14). */
  async moveOrdering(questionId: string, index: number, delta: number): Promise<void> {
    const draft = [...this.orderingDraft()];
    const target = index + delta;
    if (target < 0 || target >= draft.length) {
      return;
    }
    const previous = this.orderingDraft();
    const moved = draft[index];
    draft[index] = draft[target];
    draft[target] = moved;
    this.orderingDraft.set(draft);
    this.actionError.set(null);
    try {
      await this.session.answer(questionId, draft);
    } catch {
      if (this.session.currentQuestion()?.id === questionId) {
        this.orderingDraft.set(previous);
      }
      this.actionError.set('The order could not be saved. Move the step again to retry.');
    }
  }

  /** Matching persists the chosen pairs as tokens on every change (EXAM-14). */
  async selectMatch(questionId: string, leftKey: string, event: Event): Promise<void> {
    const target = (event.target as HTMLSelectElement).value;
    const previous = this.matchingDraft();
    const draft = { ...previous, [leftKey]: target };
    this.matchingDraft.set(draft);
    this.actionError.set(null);
    const tokens = Object.entries(draft)
      .filter(([, value]) => value !== '')
      .map(([left, value]) => `${left}:${value}`);
    try {
      await this.session.answer(questionId, tokens);
    } catch {
      if (this.session.currentQuestion()?.id === questionId) {
        this.matchingDraft.set(previous);
      }
      this.actionError.set('The match could not be saved. Choose the target again to retry.');
    }
  }

  /** Flag and unflag through the service so the state persists (EXAM-11). */
  async toggleFlag(): Promise<void> {
    const question = this.session.currentQuestion();
    if (!question) {
      return;
    }
    const next = !this.session.isFlagged(question.id);
    this.actionError.set(null);
    try {
      await this.session.setFlag(question.id, next);
    } catch {
      this.actionError.set('The flag could not be saved. Try again.');
    }
  }

  /** Previous, next, and grid navigation all go through `goTo` (EXAM-15). */
  async goToQuestion(index: number): Promise<void> {
    if (
      index < 0 ||
      index >= this.session.totalQuestions() ||
      index === this.session.currentIndex()
    ) {
      return;
    }
    this.actionError.set(null);
    try {
      await this.session.goTo(index);
    } catch {
      this.actionError.set('The position could not be saved. Try again.');
    }
  }

  async previous(): Promise<void> {
    await this.goToQuestion(this.session.currentIndex() - 1);
  }

  async next(): Promise<void> {
    await this.goToQuestion(this.session.currentIndex() + 1);
  }

  /** The Ready to submit dialog summarizes the counts before grading (EXAM-27). */
  async requestSubmit(): Promise<void> {
    if (this.submitting() || this.session.result() !== null) {
      return;
    }
    const answered = this.session.answeredCount();
    const total = this.session.totalQuestions();
    const flagged = this.session.flaggedIds().length;
    const alert = await this.alerts.create({
      header: 'Ready to submit?',
      message: `You answered ${answered} of ${total} questions and flagged ${flagged}. Unanswered questions grade as incorrect.`,
      buttons: [
        { text: 'Keep answering', role: 'cancel' },
        { text: 'Submit exam', role: 'confirm' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'confirm') {
      return;
    }
    await this.submitExam();
  }

  /**
   * Grade and commit through the service. A failed commit raises and keeps
   * the result available uncommitted, so the result panel can offer a retry
   * without ever claiming success (EXAM-35).
   */
  async submitExam(): Promise<void> {
    if (this.submitting()) {
      return;
    }
    this.submitting.set(true);
    try {
      const attempt = await this.session.submit();
      await this.navigateToResults(attempt.id);
    } catch {
      // The uncommitted result state renders the retry affordance.
    } finally {
      this.submitting.set(false);
    }
  }

  /**
   * The leave confirmation behind `mockExamLeaveGuard` (S11, EXAM-16 to
   * EXAM-18). Confirming only allows the navigation; the attempt stays saved
   * because nothing here discards it. Leaving is free once the exam is over
   * or never started.
   */
  async confirmLeave(): Promise<boolean> {
    if (!this.session.isActive() || this.session.result() !== null) {
      return true;
    }
    const alert = await this.alerts.create({
      header: 'Leave the exam?',
      message:
        'Your attempt stays saved on this device and the timer keeps running. Resume it from the exam start screen.',
      buttons: [
        { text: 'Stay', role: 'cancel' },
        { text: 'Leave', role: 'confirm' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'confirm';
  }

  /** Return to the tab shell. The full results actions arrive with the results screen. */
  async leaveExam(): Promise<void> {
    await this.router.navigate(['/tabs/home']);
  }
}
