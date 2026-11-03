/**
 * Study exam runner (issue 006: S3, S4, S5, S6, S7, S11 display, S12).
 *
 * The untimed learning screen: every answer grades immediately, feedback
 * appears in place, and three progress bars track the session. There is no
 * countdown, no deadline, no auto-submit, and no leave guard anywhere in this
 * page (S1, S12, STUDY-52): progress is saved after every graded answer by
 * the session service, so navigating away never discards anything.
 *
 * Invariants:
 *
 * - Single answers grade on selection through `answer`, which grades singles
 *   in the same transactional write (S3). Multi, ordering, and matching
 *   responses persist a draft on every change and grade only through an
 *   explicit Confirm that calls `submitAnswer` (STUDY-9).
 * - A graded question is read-only for the rest of the session (S5): every
 *   input is disabled and revisiting shows the recorded answer, its
 *   correctness, and its feedback exactly as stored.
 * - The feedback panel is keyboard and screen-reader reachable (S6): it is
 *   focusable, labelled by its heading, announced through a polite live
 *   region when it appears, and receives focus after a fresh grade. Focus is
 *   never moved on a revisit, so navigation stays where the student put it.
 * - The three bars (answered with a percentage, correct count, wrong count)
 *   are always visible with text labels, numeric values, and full progressbar
 *   ARIA values (S7). Colour is never the only signal.
 * - Finish snapshots the counts, then calls `complete()` and renders the
 *   summary in place (S11). A failed commit keeps the session resumable and
 *   shows a retryable error (S8).
 */

import {
  afterRenderEffect,
  Component,
  computed,
  effect,
  type ElementRef,
  inject,
  input,
  type OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import { getCert } from '../../../core/content/cert-registry';
import { questionType, type Question } from '../../../core/content/question-types';
import { correctAnswerFor, MAX_MULTI_ANSWER } from '../../../core/exam';
import { StudyExamSessionService } from '../session/study-exam-session.service';
import type {
  DomainTally,
  FeedbackEntry,
  FeedbackEntryKind,
  QuestionFeedback,
} from '../session/study-exam-session.types';
import { studyExamStartPath } from '../study-exam.routes';

interface OptionEntry {
  key: string;
  text: string;
}

/**
 * The counts shown on the completion summary (S11). They are captured before
 * `complete()` runs because the service clears the active session when the
 * commit lands, which zeroes every count signal.
 */
interface CompletionSummary {
  answered: number;
  total: number;
  correct: number;
  wrong: number;
  accuracyPercent: number;
  domains: readonly DomainTally[];
}

@Component({
  selector: 'app-study-exam-runner',
  imports: [IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar],
  templateUrl: './study-exam-runner.page.html',
  styleUrl: './study-exam-runner.page.css',
})
export class StudyExamRunnerPage implements OnInit {
  protected readonly session = inject(StudyExamSessionService);
  private readonly router = inject(Router);

  /**
   * Cert code bound from the route by the parent wiring. Used only for the
   * defensive resume when the runner opens without an active session; the
   * start screen owns the normal start and resume flow.
   */
  readonly certCode = input<string>();

  readonly typeOf = questionType;

  /**
   * Engine multi limit, read through a getter. The mock runner observed a
   * plain readonly field initialized from the imported constant reading
   * undefined inside the merged unit-test bundle; reading it at call time
   * keeps the value tied to the module namespace whatever the bundler does.
   */
  get maxMulti(): number {
    return MAX_MULTI_ANSWER;
  }

  readonly singleSelection = signal<string | null>(null);
  readonly multiDraft = signal<readonly string[]>([]);
  readonly orderingDraft = signal<readonly string[]>([]);
  readonly matchingDraft = signal<Readonly<Partial<Record<string, string>>>>({});

  readonly actionError = signal<string | null>(null);
  readonly unavailable = signal(false);

  /**
   * True until the entry logic settles.
   *
   * The page promised nothing while `resume` was in flight, so a slow local
   * store left a blank screen. Stating the state is honest and keeps the
   * runner from ever rendering empty.
   */
  readonly initialising = signal(true);
  readonly finishing = signal(false);
  readonly summary = signal<CompletionSummary | null>(null);

  /** Polite live-region text announcing feedback when it appears (S6). */
  readonly feedbackAnnouncement = signal('');

  /** Question whose feedback panel should receive focus once rendered (S6). */
  private readonly pendingFeedbackFocus = signal<string | null>(null);

  readonly feedbackPanel = viewChild<ElementRef<HTMLElement>>('feedbackPanel');

  /** Reload the local drafts whenever the displayed question changes. */
  private readonly draftLoader = effect(() => {
    const question = this.session.currentQuestion();
    if (!question || this.summary() !== null) {
      return;
    }
    this.loadDrafts(question);
  });

  /**
   * Announce the feedback state of the displayed question (S6). The region
   * clears on ungraded questions so the next grade always re-announces.
   */
  private readonly feedbackAnnouncer = effect(() => {
    const question = this.session.currentQuestion();
    if (!question || this.summary() !== null || !this.session.isGraded(question.id)) {
      this.feedbackAnnouncement.set('');
      return;
    }
    const position = this.session.currentIndex() + 1;
    const verdict = this.session.isCorrect(question.id) ? 'correct' : 'incorrect';
    this.feedbackAnnouncement.set(
      `Feedback for question ${position}: ${verdict}. Review the feedback panel.`,
    );
  });

  /**
   * Move focus to the feedback panel after a fresh grade, once the panel
   * exists in the DOM. Revisits never queue a focus move, so the grid and
   * pager keep their focus (S6).
   */
  private readonly feedbackFocuser = afterRenderEffect(() => {
    const questionId = this.pendingFeedbackFocus();
    if (questionId === null) {
      return;
    }
    const question = this.session.currentQuestion();
    const panel = this.feedbackPanel();
    if (!question || question.id !== questionId || !panel || !this.session.isGraded(questionId)) {
      return;
    }
    panel.nativeElement.focus();
    this.pendingFeedbackFocus.set(null);
  });

  async ngOnInit(): Promise<void> {
    await this.initialise();
  }

  /**
   * Enter logic. When the runner opens without an active session (for
   * example after a force close and a deep link), resume the saved one;
   * otherwise show a recoverable empty state. Starting a fresh session
   * belongs to the start screen, not this page.
   */
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

  /** Where the back affordance leads: the study exam start screen. */
  readonly backHref = computed(() => {
    const cert = this.certCode();
    return cert !== undefined && cert !== '' ? studyExamStartPath(cert) : '/tabs/home';
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

  /** The recorded matching pairs for a graded question, in left-key order. */
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

  /** Accessible cell label: the graded state is announced, never colour only (ACC-4). */
  gridLabel(question: Question, index: number): string {
    const parts = [`Question ${index + 1}`];
    if (this.session.isGraded(question.id)) {
      parts.push(this.session.isCorrect(question.id) ? 'graded correct' : 'graded incorrect');
    } else {
      parts.push('ungraded');
    }
    if (index === this.session.currentIndex()) {
      parts.push('current');
    }
    return parts.join(', ');
  }

  /** Single answers grade on selection (S3). Graded questions are read-only (S5). */
  async selectSingle(questionId: string, key: string): Promise<void> {
    if (this.session.isGraded(questionId) || this.singleSelection() === key) {
      return;
    }
    const previous = this.singleSelection();
    this.singleSelection.set(key);
    this.actionError.set(null);
    try {
      await this.session.answer(questionId, key);
      this.pendingFeedbackFocus.set(questionId);
    } catch {
      if (this.session.currentQuestion()?.id === questionId) {
        this.singleSelection.set(previous);
      }
      this.actionError.set('The answer could not be saved. Select the option again to retry.');
    }
  }

  /** Multi toggles edit the draft and persist it; the limit caps new selections (S3). */
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
    this.actionError.set(null);
    try {
      await this.session.answer(questionId, next);
    } catch {
      if (this.session.currentQuestion()?.id === questionId) {
        this.multiDraft.set(previous);
      }
      this.actionError.set('The selection could not be saved. Choose the option again to retry.');
    }
  }

  /**
   * The explicit Confirm grades a multi, ordering, or matching response (S3,
   * STUDY-9). The current draft is persisted first so the graded draft is
   * always the one on screen, then `submitAnswer` grades the stored draft.
   */
  async confirmResponse(questionId: string, draft: readonly string[]): Promise<void> {
    if (this.session.isGraded(questionId)) {
      return;
    }
    this.actionError.set(null);
    try {
      await this.session.answer(questionId, draft);
      await this.session.submitAnswer(questionId);
      this.pendingFeedbackFocus.set(questionId);
    } catch {
      this.actionError.set('The answer could not be graded. Confirm again to retry.');
    }
  }

  async confirmMulti(questionId: string): Promise<void> {
    await this.confirmResponse(questionId, [...this.multiDraft()]);
  }

  /** Ordering persists the full sequence on every move; Confirm grades it. */
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

  async confirmOrdering(questionId: string): Promise<void> {
    await this.confirmResponse(questionId, [...this.orderingDraft()]);
  }

  /** Matching persists the chosen pairs as tokens on every change. */
  async selectMatch(questionId: string, leftKey: string, event: Event): Promise<void> {
    if (this.session.isGraded(questionId)) {
      return;
    }
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

  async confirmMatching(questionId: string): Promise<void> {
    const tokens = Object.entries(this.matchingDraft())
      .filter(([, value]) => value !== '')
      .map(([left, value]) => `${left}:${value}`);
    await this.confirmResponse(questionId, tokens);
  }

  /**
   * True when the draft on screen is a complete response for its format, so
   * the Confirm button only arms when there is something gradable (S3). The
   * arity of the correct response sets the required count, exactly the
   * completeness rule the service enforces.
   */
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

  /** Feedback entries of one kind, for the grouped panel (S4). */
  entriesOfKind(feedback: QuestionFeedback, kind: FeedbackEntryKind): FeedbackEntry[] {
    return feedback.options.filter((entry) => entry.kind === kind);
  }

  /** Accuracy blends the answered bar between light green and intense orange (STUDY-28). */
  readonly accuracyPercent = computed(() => {
    const answered = this.session.answeredCount();
    if (answered === 0) {
      return 100;
    }
    return Math.round((this.session.correctCount() / answered) * 100);
  });

  /** The blended fill of the answered bar (STUDY-28). */
  readonly answeredFill = computed(
    () => `color-mix(in srgb, rgb(74 222 128) ${this.accuracyPercent()}%, rgb(249 115 22))`,
  );

  readonly correctPercentOfTotal = computed(() =>
    this.percentOfTotal(this.session.correctCount()),
  );

  readonly wrongPercentOfTotal = computed(() => this.percentOfTotal(this.session.wrongCount()));

  private percentOfTotal(count: number): number {
    const total = this.session.totalQuestions();
    return total === 0 ? 0 : Math.round((count / total) * 100);
  }

  readonly answeredValueText = computed(
    () =>
      `${this.session.answeredCount()} of ${this.session.totalQuestions()} answered, ` +
      `${this.session.answeredPercent()} percent`,
  );

  readonly correctValueText = computed(() => `${this.session.correctCount()} correct`);

  readonly wrongValueText = computed(() => `${this.session.wrongCount()} wrong`);

  /** Previous, next, and grid navigation all go through `goTo`. */
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

  /**
   * Finish the exam (S11 display): snapshot the counts, commit through the
   * service, and render the summary in place. A failed commit leaves the
   * session resumable and shows a retryable error (S8).
   */
  async finish(): Promise<void> {
    if (this.finishing() || this.summary() !== null || !this.session.isActive()) {
      return;
    }
    this.finishing.set(true);
    this.actionError.set(null);
    const answered = this.session.answeredCount();
    const correct = this.session.correctCount();
    const snapshot: CompletionSummary = {
      answered,
      total: this.session.totalQuestions(),
      correct,
      wrong: this.session.wrongCount(),
      accuracyPercent: answered === 0 ? 0 : Math.round((correct / answered) * 100),
      // A domain nobody answered reports no percentage at all (STUDY-49).
      domains: this.session.domainTallies().filter((tally) => tally.answered > 0),
    };
    try {
      await this.session.complete();
      this.summary.set(snapshot);
    } catch {
      this.actionError.set(
        'The completed exam could not be saved locally. The session is unchanged, finish again to retry.',
      );
    } finally {
      this.finishing.set(false);
    }
  }

  /** Domain display name for the summary; the service exposes only domain ids. */
  domainName(domainId: number): string {
    const cert = this.certCode();
    const name =
      cert !== undefined && cert !== ''
        ? getCert(cert)?.domains.find((domain) => domain.id === domainId)?.name
        : undefined;
    return name ?? `Domain ${domainId}`;
  }

  domainPercent(tally: DomainTally): number {
    return tally.answered === 0 ? 0 : Math.round((tally.correct / tally.answered) * 100);
  }

  /** Return to the study exam start screen once the summary has been read. */
  async leaveToStart(): Promise<void> {
    await this.router.navigateByUrl(this.backHref());
  }
}
