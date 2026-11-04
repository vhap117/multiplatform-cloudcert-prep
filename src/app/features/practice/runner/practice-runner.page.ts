/**
 * Domain practice runner (issue 007: PRACT-9 to PRACT-23, PRACT-27 to PRACT-37).
 *
 * The targeted drill screen. Single answers grade on selection; multi,
 * ordering, and matching responses persist a draft and grade only on an
 * explicit confirm once complete, so an incomplete response warns instead of
 * being silently marked wrong (PRACT-12, PRACT-17). A graded question is
 * read-only for the rest of the session and a revisit shows the same recorded
 * answer and feedback (PRACT-19, PRACT-20).
 *
 * The runner advances with Next question and ends with Finish session on the
 * last question (PRACT-15). Completion renders the score and summary in place
 * and the session is already recorded in local history by the service
 * (PRACT-21 to PRACT-23). A failed save shows a retryable error and never
 * pretends the answer or completion was stored (PRACT-24).
 *
 * Walking away goes through `practiceLeaveGuard`, which delegates to
 * `confirmLeave` here. Confirming keeps the session mounted and saved for
 * resume; nothing is discarded (PRACT-27 to PRACT-30). Backgrounding is safe
 * because every answer and position is persisted as it changes (PRACT-31),
 * and opening the runner after a force close resumes the saved session
 * (PRACT-32). There is no timer, no timed-exam active state, and no network
 * (PRACT-26, PRACT-33, PRACT-39).
 */

import {
  Component,
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
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import { questionType, type Question } from '../../../core/content/question-types';
import { correctAnswerFor, MAX_MULTI_ANSWER } from '../../../core/exam';
import type {
  FeedbackEntry,
  FeedbackEntryKind,
  QuestionFeedback,
} from '../../../core/exam-session/feedback';
import type { AttemptRow } from '../../../core/storage/types';
import { practiceConfigPath } from '../practice.routes';
import { PracticeSessionService } from '../session/practice-session.service';

import type { PracticeLeaveAware } from './practice-leave.guard';

interface OptionEntry {
  key: string;
  text: string;
}

interface CompletionSummary {
  readonly attempt: AttemptRow;
}

@Component({
  selector: 'app-practice-runner',
  imports: [IonBackButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar],
  templateUrl: './practice-runner.page.html',
  styleUrl: './practice-runner.page.css',
})
export class PracticeRunnerPage implements OnInit, PracticeLeaveAware {
  protected readonly session = inject(PracticeSessionService);
  private readonly alerts = inject(AlertController);
  private readonly router = inject(Router);

  readonly certCode = input<string>();

  readonly typeOf = questionType;

  get maxMulti(): number {
    return MAX_MULTI_ANSWER;
  }

  readonly singleSelection = signal<string | null>(null);
  readonly multiDraft = signal<readonly string[]>([]);
  readonly orderingDraft = signal<readonly string[]>([]);
  readonly matchingDraft = signal<Readonly<Partial<Record<string, string>>>>({});

  readonly actionError = signal<string | null>(null);
  readonly warning = signal<string | null>(null);
  readonly statusMessage = signal<string | null>(null);
  readonly unavailable = signal(false);
  readonly initialising = signal(true);
  readonly finishing = signal(false);
  readonly summary = signal<CompletionSummary | null>(null);

  readonly feedbackAnnouncement = signal('');

  private readonly draftLoader = effect(() => {
    const question = this.session.currentQuestion();
    if (!question || this.summary() !== null) {
      return;
    }
    this.loadDrafts(question);
  });

  private readonly feedbackAnnouncer = effect(() => {
    const question = this.session.currentQuestion();
    if (!question || this.summary() !== null || !this.session.isGraded(question.id)) {
      this.feedbackAnnouncement.set('');
      return;
    }
    const position = this.session.currentIndex() + 1;
    const verdict = this.session.isCorrect(question.id) ? 'correct' : 'incorrect';
    this.feedbackAnnouncement.set(`Feedback for question ${position}: ${verdict}.`);
  });

  async ngOnInit(): Promise<void> {
    await this.initialise();
  }

  private async initialise(): Promise<void> {
    this.initialising.set(true);
    try {
      if (!this.session.isActive()) {
        const cert = this.certCode();
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
    } finally {
      this.initialising.set(false);
    }
  }

  async retryInitialise(): Promise<void> {
    this.actionError.set(null);
    await this.initialise();
  }

  readonly backHref = computed(() => {
    const cert = this.certCode();
    return cert !== undefined && cert !== ''
      ? practiceConfigPath(cert)
      : '/tabs/practice';
  });

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

  targetText(question: Question, key: string): string {
    return question.targets?.[key] ?? key;
  }

  private optionKeys(question: Question): string[] {
    return Object.keys(question.options);
  }

  recordedMatching(question: Question): { left: OptionEntry; targetText: string }[] {
    const stored = this.session.answerFor(question.id);
    const pairs = new Map(
      (Array.isArray(stored) ? stored : []).map((token) => token.split(':') as [string, string]),
    );
    return this.optionEntries(question).map((left) => ({
      left,
      targetText: this.targetText(question, pairs.get(left.key) ?? ''),
    }));
  }

  async selectSingle(questionId: string, key: string): Promise<void> {
    if (this.session.isGraded(questionId) || this.singleSelection() === key) {
      return;
    }
    const previous = this.singleSelection();
    this.singleSelection.set(key);
    this.clearMessages();
    try {
      await this.session.answer(questionId, key);
    } catch {
      if (this.session.currentQuestion()?.id === questionId) {
        this.singleSelection.set(previous);
      }
      this.actionError.set('The answer could not be saved. Select the option again to retry.');
    }
  }

  async toggleMulti(questionId: string, key: string): Promise<void> {
    if (this.session.isGraded(questionId)) {
      return;
    }
    const draft = this.multiDraft();
    let next: readonly string[];
    if (draft.includes(key)) {
      next = draft.filter((candidate) => candidate !== key);
    } else {
      if (draft.length >= this.maxMulti) {
        return;
      }
      next = [...draft, key];
    }
    const previous = this.multiDraft();
    this.multiDraft.set(next);
    this.clearMessages();
    try {
      await this.session.answer(questionId, next);
    } catch {
      if (this.session.currentQuestion()?.id === questionId) {
        this.multiDraft.set(previous);
      }
      this.actionError.set('The selection could not be saved. Choose the option again to retry.');
    }
  }

  async confirmResponse(questionId: string, draft: readonly string[]): Promise<void> {
    if (this.session.isGraded(questionId)) {
      return;
    }
    this.clearMessages();
    try {
      await this.session.answer(questionId, draft);
      const result = await this.session.submitAnswer(questionId);
      if (result === 'incomplete') {
        this.warning.set('Your response is not complete yet. Choose every required answer, then confirm again.');
      }
    } catch {
      this.actionError.set('The answer could not be graded. Confirm again to retry.');
    }
  }

  async confirmMulti(questionId: string): Promise<void> {
    await this.confirmResponse(questionId, [...this.multiDraft()]);
  }

  async moveOrdering(questionId: string, index: number, delta: number): Promise<void> {
    if (this.session.isGraded(questionId)) {
      return;
    }
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
    this.clearMessages();
    try {
      await this.session.answer(questionId, draft);
    } catch {
      if (this.session.currentQuestion()?.id === questionId) {
        this.orderingDraft.set(previous);
      }
      this.actionError.set('The order could not be saved. Move the step again to retry.');
    }
  }

  async confirmOrdering(questionId: string): Promise<void> {
    await this.confirmResponse(questionId, [...this.orderingDraft()]);
  }

  async selectMatch(questionId: string, leftKey: string, event: Event): Promise<void> {
    if (this.session.isGraded(questionId)) {
      return;
    }
    const target = (event.target as HTMLSelectElement).value;
    const previous = this.matchingDraft();
    const draft = { ...previous, [leftKey]: target };
    this.matchingDraft.set(draft);
    this.clearMessages();
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

  async confirmMatching(questionId: string): Promise<void> {
    const tokens = Object.entries(this.matchingDraft())
      .filter(([, value]) => value !== '')
      .map(([left, value]) => `${left}:${value}`);
    await this.confirmResponse(questionId, tokens);
  }

  responseComplete(question: Question): boolean {
    switch (questionType(question)) {
      case 'multi':
        return this.multiDraft().length === this.expectedCount(question);
      case 'ordering':
        return (
          this.orderingDraft().length > 0 &&
          this.orderingDraft().length === this.expectedCount(question)
        );
      case 'matching':
        return Object.values(this.matchingDraft()).every((value) => value !== '');
      default:
        return false;
    }
  }

  private expectedCount(question: Question): number {
    const correct = correctAnswerFor(question);
    return Array.isArray(correct) ? correct.length : 0;
  }

  entriesOfKind(feedback: QuestionFeedback, kind: FeedbackEntryKind): FeedbackEntry[] {
    return feedback.options.filter((entry) => entry.kind === kind);
  }

  readonly answeredValueText = computed(
    () =>
      `${this.session.answeredCount()} of ${this.session.totalQuestions()} answered, ` +
      `${this.session.answeredPercent()} percent`,
  );

  async goToQuestion(index: number): Promise<void> {
    if (
      index < 0 ||
      index >= this.session.totalQuestions() ||
      index === this.session.currentIndex()
    ) {
      return;
    }
    this.clearMessages();
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

  /** Copy the current question id only on an explicit tap (PRACT-18). */
  async reportQuestion(): Promise<void> {
    const question = this.session.currentQuestion();
    if (!question) {
      return;
    }
    try {
      await navigator.clipboard?.writeText(question.id);
      this.statusMessage.set('Question id copied.');
    } catch {
      this.statusMessage.set(`Question id: ${question.id}`);
    }
  }

  async finish(): Promise<void> {
    if (this.finishing() || this.summary() !== null || !this.session.isActive()) {
      return;
    }
    this.finishing.set(true);
    this.clearMessages();
    try {
      const completion = await this.session.complete();
      this.summary.set({ attempt: completion.attempt });
    } catch {
      this.actionError.set(
        'The completed practice session could not be saved locally. The session is unchanged, finish again to retry.',
      );
    } finally {
      this.finishing.set(false);
    }
  }

  async leaveToStart(): Promise<void> {
    await this.router.navigateByUrl(this.backHref());
  }

  /**
   * The leave confirmation behind `practiceLeaveGuard` (PRACT-27 to PRACT-30).
   * Confirming only allows navigation; the session stays saved because nothing
   * here discards it. Leaving is free once practice is over or never started.
   */
  async confirmLeave(): Promise<boolean> {
    if (!this.session.isActive() || this.summary() !== null) {
      return true;
    }
    const alert = await this.alerts.create({
      header: 'Leave practice?',
      message:
        'Your practice session stays saved on this device. Resume it later from the Practice tab.',
      buttons: [
        { text: 'Keep practicing', role: 'cancel' },
        { text: 'Leave practice', role: 'confirm' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'confirm';
  }

  private clearMessages(): void {
    this.actionError.set(null);
    this.warning.set(null);
    this.statusMessage.set(null);
  }
}
