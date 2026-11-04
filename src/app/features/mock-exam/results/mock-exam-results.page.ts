/**
 * Mock exam results and review screen (issue 005, S8 and S9).
 *
 * One routed screen: the score summary and actions sit on top (EXAM-35,
 * EXAM-37, EXAM-38, EXAM-44 to EXAM-46) and the question review with its
 * filters sits below (EXAM-39 to EXAM-42). Routes are wired by the parent; the
 * navigation targets are inputs with sensible defaults so the parent can
 * override them through route input binding.
 *
 * Data sources, exactly two:
 *
 * - `MockExamSessionService.result()` when it is set: the just finished
 *   attempt, including an uncommitted one whose save can be retried (EXAM-35).
 *   A successful retry flips `committed`, which this page reacts to and then
 *   reloads the review rows, which only exist once the commit landed.
 * - `STUDY_REPOSITORY.getAttempt` when the route carries an `attemptId`
 *   (a deep link to a stored attempt), with `listQuestionResults` feeding the
 *   review and the bundled bank resolving question text and explanations.
 *
 * Nothing here touches the network (S14, EXAM-47) and nothing claims the save
 * succeeded while `committed` is false (EXAM-35).
 */

import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import { getCert } from '../../../core/content/cert-registry';
import { loadAllQuestions } from '../../../core/content/question-loader';
import { STUDY_REPOSITORY } from '../../../core/storage/repository-provider';
import type {
  AttemptRow,
  QuestionResultRow,
} from '../../../core/storage/types';
import { mockExamRunPath } from '../mock-exam.routes';
import { MockExamSessionService } from '../session/mock-exam-session.service';

import { ReviewCardComponent } from './review-card.component';
import {
  applyReviewFilter,
  buildDomainBreakdown,
  buildReviewCards,
  buildScoreFacts,
  domainFilters,
  domainName,
  weakestDomain,
  type DomainBreakdownRow,
  type ReviewCardView,
  type ReviewFilter,
  type ScoreFacts,
} from './results-view.model';

/** What the async load produced, so the template can switch on one value. */
type LoadState =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'error' }
  | {
      kind: 'ready';
      attempt: AttemptRow;
      /** `CLF-C02 AWS Cloud Practitioner`, or the raw code for unknown certs. */
      certLabel: string;
      facts: ScoreFacts;
      domains: DomainBreakdownRow[];
      cards: ReviewCardView[];
    };

@Component({
  selector: 'app-mock-exam-results',
  imports: [
    IonButton,
    IonContent,
    IonHeader,
    IonSpinner,
    IonTitle,
    IonToolbar,
    RouterLink,
    ReviewCardComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Mock exam results</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="ccp-page">
        <div class="ccp-content">
          @if (saveFailed()) {
            <div class="ccp-card save-alert" role="alert">
              <h2 class="ccp-card-heading">Results not saved</h2>
              <p class="ccp-small ccp-muted">
                The local save failed, so this attempt is not in your history
                yet. The results below are still computed from your answers,
                and your in-progress exam is untouched, so the save can be
                retried.
              </p>
              <ion-button (click)="retrySave()" [disabled]="retrying()">
                {{ retrying() ? 'Saving...' : 'Retry save' }}
              </ion-button>
            </div>
          } @else if (freshlySaved()) {
            <p class="saved-note ccp-small" aria-live="polite">
              Results saved on this device.
            </p>
          }

          @switch (state().kind) {
            @case ('loading') {
              <div class="status-block" role="status">
                <ion-spinner name="crescent" aria-hidden="true"></ion-spinner>
                <p class="ccp-body ccp-muted">Loading results...</p>
              </div>
            }
            @case ('missing') {
              <p class="ccp-kicker">Mock exam</p>
              <h1 class="ccp-display">No result to show</h1>
              <p class="ccp-body ccp-muted">
                Finish a mock exam to see its results here.
              </p>
              <ion-button [routerLink]="dashboardPath()">Back to dashboard</ion-button>
            }
            @case ('error') {
              <div role="alert">
                <p class="ccp-kicker">Mock exam</p>
                <h1 class="ccp-display">Results unavailable</h1>
                <p class="ccp-body ccp-muted">
                  The saved results could not be read from local storage.
                </p>
                <ion-button (click)="retryLoad()">Try again</ion-button>
                <ion-button fill="outline" [routerLink]="dashboardPath()">
                  Back to dashboard
                </ion-button>
              </div>
            }
            @case ('ready') {
              @if (readyView(); as view) {
                <p class="ccp-kicker">Mock exam results</p>
                <h1 class="ccp-display" [class.passed]="view.facts.passed">
                  {{ view.facts.outcomeText }}
                </h1>
                <p class="ccp-body ccp-muted">{{ view.certLabel }}</p>

                <section class="ccp-card score-card" aria-labelledby="score-heading">
                  <h2 id="score-heading" class="ccp-card-heading">Score</h2>
                  <dl class="facts">
                    <div class="fact">
                      <dt>Score</dt>
                      <dd>
                        <span class="fact-value">{{ view.facts.scorePercent }}%</span>
                        @if (view.facts.passingPercent !== null) {
                          <span class="ccp-muted">(pass mark {{ view.facts.passingPercent }}%)</span>
                        }
                      </dd>
                    </div>
                    <div class="fact">
                      <dt>Correct</dt>
                      <dd>
                        <span class="fact-value">{{ view.facts.correctCount }}</span>
                        of {{ view.facts.totalQuestions }} questions
                      </dd>
                    </div>
                    <div class="fact">
                      <dt>Time</dt>
                      <dd><span class="fact-value ccp-mono">{{ view.facts.elapsedText }}</span></dd>
                    </div>
                  </dl>
                </section>

                <section class="ccp-card" aria-labelledby="domains-heading">
                  <h2 id="domains-heading" class="ccp-card-heading">Domain breakdown</h2>
                  <ul class="domain-list">
                    @for (domain of view.domains; track domain.domainId) {
                      <li class="domain-row">
                        <div class="domain-head">
                          <span class="ccp-body">{{ domain.name }}</span>
                          <span class="ccp-small ccp-muted">
                            {{ domain.percent }}% ({{ domain.correct }} of {{ domain.total }})
                          </span>
                        </div>
                        <div
                          class="domain-bar"
                          role="progressbar"
                          [attr.aria-label]="domain.name"
                          aria-valuemin="0"
                          aria-valuemax="100"
                          [attr.aria-valuenow]="domain.percent"
                          [attr.aria-valuetext]="
                            domain.name + ': ' + domain.percent + '% correct'
                          "
                        >
                          <div class="domain-bar-fill" [style.width.%]="domain.percent"></div>
                        </div>
                      </li>
                    }
                  </ul>
                </section>

                <div class="actions">
                  @if (weakest(); as weak) {
                    <ion-button
                      expand="block"
                      [routerLink]="practicePath()"
                      [queryParams]="{ domain: weak.domainId }"
                    >
                      Practice weakest domain: {{ weak.name }}
                    </ion-button>
                  }
                  <ion-button
                    expand="block"
                    fill="outline"
                    (click)="retake()"
                    [disabled]="retaking()"
                  >
                    {{ retaking() ? 'Starting...' : 'Retake exam' }}
                  </ion-button>
                  @if (retakeError(); as message) {
                    <p class="ccp-small action-error" role="alert">{{ message }}</p>
                  }
                  <ion-button expand="block" fill="clear" [routerLink]="dashboardPath()">
                    Back to dashboard
                  </ion-button>
                </div>

                <section class="review" aria-labelledby="review-heading">
                  <h2 id="review-heading" class="ccp-heading">Review answers</h2>

                  @if (view.cards.length === 0 && view.attempt.totalQuestions > 0) {
                    <p class="ccp-body ccp-muted review-note">
                      @if (saveFailed()) {
                        Answer review appears here once the save succeeds. Use
                        Retry save above.
                      } @else {
                        Answer review is not available for this result.
                      }
                    </p>
                  } @else {
                    <div class="filter-chips" role="group" aria-label="Filter questions">
                      <button
                        type="button"
                        class="chip"
                        [class.chip-active]="filter() === 'all'"
                        [attr.aria-pressed]="filter() === 'all'"
                        (click)="setFilter('all')"
                      >
                        All ({{ view.cards.length }})
                      </button>
                      <button
                        type="button"
                        class="chip"
                        [class.chip-active]="filter() === 'incorrect'"
                        [attr.aria-pressed]="filter() === 'incorrect'"
                        (click)="setFilter('incorrect')"
                      >
                        Incorrect ({{ incorrectCount() }})
                      </button>
                      <button
                        type="button"
                        class="chip"
                        [class.chip-active]="filter() === 'flagged'"
                        [attr.aria-pressed]="filter() === 'flagged'"
                        (click)="setFilter('flagged')"
                      >
                        Flagged ({{ flaggedCount() }})
                      </button>
                      @for (domain of domainFilterOptions(); track domain.id) {
                        <button
                          type="button"
                          class="chip"
                          [class.chip-active]="filter() === domain.id"
                          [attr.aria-pressed]="filter() === domain.id"
                          (click)="setFilter(domain.id)"
                        >
                          {{ domain.name }}
                        </button>
                      }
                    </div>

                    @if (filteredCards().length === 0) {
                      <p class="ccp-body ccp-muted">No questions match this filter.</p>
                    }

                    <ol class="review-list">
                      @for (card of filteredCards(); track card.resultId) {
                        <li><app-review-card [card]="card" /></li>
                      }
                    </ol>
                  }
                </section>
              }
            }
          }
        </div>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .save-alert {
        border: 1px solid rgb(var(--ccp-danger));
        margin-bottom: var(--ccp-space-lg);
      }

      .saved-note {
        color: rgb(var(--ccp-success));
        margin: 0 0 var(--ccp-space-base);
      }

      .status-block {
        align-items: center;
        display: flex;
        gap: var(--ccp-space-md);
        justify-content: center;
        min-height: 120px;
      }

      .passed {
        color: rgb(var(--ccp-success));
      }

      h1:not(.passed) {
        color: rgb(var(--ccp-danger));
      }

      .score-card,
      .actions,
      .review {
        margin-top: var(--ccp-space-lg);
      }

      .facts {
        display: grid;
        gap: var(--ccp-space-base);
        margin: var(--ccp-space-base) 0 0;
      }

      .fact dt {
        color: rgb(var(--ccp-text-muted));
        font-size: 0.75rem;
        font-weight: 500;
        letter-spacing: 0.02em;
        text-transform: uppercase;
      }

      .fact dd {
        font-size: 1rem;
        margin: var(--ccp-space-xs) 0 0;
      }

      .fact-value {
        font-size: 1.25rem;
        font-weight: 600;
        margin-right: var(--ccp-space-xs);
      }

      .domain-list {
        display: grid;
        gap: var(--ccp-space-base);
        list-style: none;
        margin: var(--ccp-space-base) 0 0;
        padding: 0;
      }

      .domain-head {
        align-items: baseline;
        display: flex;
        gap: var(--ccp-space-sm);
        justify-content: space-between;
      }

      .domain-bar {
        background: rgb(var(--ccp-bg));
        border: 1px solid rgb(var(--ccp-border));
        border-radius: var(--ccp-radius-pill);
        height: 8px;
        margin-top: var(--ccp-space-xs);
        overflow: hidden;
      }

      .domain-bar-fill {
        background: rgb(var(--ccp-brand));
        height: 100%;
      }

      .actions ion-button {
        margin-top: var(--ccp-space-sm);
      }

      .action-error {
        color: rgb(var(--ccp-danger));
        margin: var(--ccp-space-sm) 0 0;
      }

      .filter-chips {
        display: flex;
        flex-wrap: wrap;
        gap: var(--ccp-space-sm);
        margin-top: var(--ccp-space-base);
      }

      .chip {
        background: rgb(var(--ccp-bg-card));
        border: 1px solid rgb(var(--ccp-border));
        border-radius: var(--ccp-radius-pill);
        color: rgb(var(--ccp-text));
        cursor: pointer;
        font: inherit;
        font-size: 0.875rem;
        min-height: var(--ccp-tap-target);
        padding: 0 var(--ccp-space-base);
      }

      .chip-active {
        background: rgb(var(--ccp-cta));
        border-color: rgb(var(--ccp-cta));
        color: rgb(var(--ccp-on-cta));
      }

      .review-list {
        display: grid;
        gap: var(--ccp-space-base);
        list-style: none;
        margin: var(--ccp-space-base) 0 0;
        padding: 0;
      }

      .review-note {
        margin-top: var(--ccp-space-base);
      }
    `,
  ],
})
export class MockExamResultsPage {
  private readonly session = inject(MockExamSessionService);
  private readonly repository = inject(STUDY_REPOSITORY);
  private readonly router = inject(Router);

  /** Deep-link input: the stored attempt id to show instead of the session result. */
  readonly attemptId = input<string>();
  /** Exam runner path, wired by the parent route. */
  readonly examPath = input('');
  /** Practice tab path, the target of Practice weakest domain (log L4). */
  readonly practicePath = input('/tabs/practice');
  /** Cert dashboard path. */
  readonly dashboardPath = input('/tabs/home');

  protected readonly state = signal<LoadState>({ kind: 'loading' });
  protected readonly filter = signal<ReviewFilter>('all');
  protected readonly retrying = signal(false);
  protected readonly retaking = signal(false);
  protected readonly retakeError = signal<string | null>(null);

  /** Bumped by Try again to re-run a failed load. */
  private readonly loadVersion = signal(0);
  private loadSequence = 0;

  /** True while the session holds an uncommitted result (EXAM-35). */
  protected readonly saveFailed = computed(() => {
    if (this.attemptId()) {
      return false;
    }
    const result = this.session.result();
    return result !== null && !result.committed;
  });

  /** A just committed session result earned its saved note (ACC-7). */
  protected readonly freshlySaved = computed(() => {
    if (this.attemptId()) {
      return false;
    }
    return this.session.result()?.committed ?? false;
  });

  /** The ready payload for the template; null in every other state. */
  protected readonly readyView = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state : null;
  });

  protected readonly filteredCards = computed(() => {
    const view = this.readyView();
    if (!view) {
      return [];
    }
    return applyReviewFilter(view.cards, this.filter());
  });

  protected readonly incorrectCount = computed(
    () => this.readyView()?.cards.filter((card) => !card.isCorrect).length ?? 0,
  );

  protected readonly flaggedCount = computed(
    () => this.readyView()?.cards.filter((card) => card.wasFlagged).length ?? 0,
  );

  protected readonly domainFilterOptions = computed(() => {
    const view = this.readyView();
    if (!view) {
      return [];
    }
    return domainFilters(view.cards, getCert(view.attempt.cert));
  });

  /** The weakest covered domain of a failed attempt, or null (EXAM-44). */
  protected readonly weakest = computed(() => {
    const view = this.readyView();
    if (!view || view.attempt.passed) {
      return null;
    }
    const row = weakestDomain(view.attempt);
    if (!row) {
      return null;
    }
    return {
      domainId: row.domainId,
      name: domainName(getCert(view.attempt.cert), row.domainId),
    };
  });

  constructor() {
    effect(() => {
      const attemptId = this.attemptId();
      const sessionAttempt = this.session.result()?.attempt ?? null;
      this.loadVersion();
      if (this.retaking()) {
        return;
      }
      void this.load(attemptId, sessionAttempt);
    });
  }

  protected setFilter(filter: ReviewFilter): void {
    this.filter.set(filter);
  }

  /**
   * Retry the failed save (EXAM-35). The service keeps the uncommitted result
   * in place; on success `committed` flips and this page reloads the review
   * rows, which only exist after the commit landed. A failure leaves the
   * alert on screen and never claims success.
   */
  protected async retrySave(): Promise<void> {
    if (this.retrying()) {
      return;
    }
    this.retrying.set(true);
    try {
      await this.session.submit();
    } catch {
      // The uncommitted result is still in the session; the alert stays.
    } finally {
      this.retrying.set(false);
    }
  }

  /** Re-run a load that failed to read from local storage (ACC-45). */
  protected retryLoad(): void {
    this.loadVersion.update((version) => version + 1);
  }

  /**
   * Start a fresh attempt for this cert and navigate to the exam runner
   * (EXAM-45). `start` resets session state and replaces any in-progress mock
   * session, so the retake begins clean. A failure stays on this screen with
   * a retryable error.
   */
  protected async retake(): Promise<void> {
    const view = this.readyView();
    if (!view || this.retaking()) {
      return;
    }
    this.retaking.set(true);
    this.retakeError.set(null);
    try {
      await this.session.start(view.attempt.cert);
      await this.router.navigateByUrl(this.examPath() || mockExamRunPath(view.attempt.cert));
    } catch {
      this.retakeError.set('A fresh exam could not be started. Try again.');
    } finally {
      this.retaking.set(false);
    }
  }

  private async load(attemptId: string | undefined, sessionAttempt: AttemptRow | null): Promise<void> {
    const sequence = ++this.loadSequence;
    this.state.set({ kind: 'loading' });
    try {
      let attempt = sessionAttempt;
      if (attemptId) {
        attempt = await this.repository.getAttempt(attemptId);
      }
      if (sequence !== this.loadSequence) {
        return;
      }
      if (!attempt) {
        this.state.set({ kind: 'missing' });
        return;
      }

      const [rows, bank] = await Promise.all([
        this.repository.listQuestionResults(attempt.id),
        loadAllQuestions(attempt.cert),
      ]);
      if (sequence !== this.loadSequence) {
        return;
      }

      const cert = getCert(attempt.cert);
      this.state.set({
        kind: 'ready',
        attempt,
        certLabel: cert ? `${cert.shortName} ${cert.name}` : attempt.cert,
        facts: buildScoreFacts(attempt, cert),
        domains: buildDomainBreakdown(attempt, cert),
        cards: buildReviewCards(this.inAttemptOrder(attempt, rows), bank, cert),
      });
    } catch {
      if (sequence === this.loadSequence) {
        this.state.set({ kind: 'error' });
      }
    }
  }

  /**
   * Review order: the exam's own question order when this attempt belongs to
   * the active session, because a stored attempt cannot recover its shuffled
   * order after the session row is cleared at commit.
   */
  private inAttemptOrder(
    attempt: AttemptRow,
    rows: readonly QuestionResultRow[],
  ): QuestionResultRow[] {
    if (this.session.result()?.attempt.id !== attempt.id) {
      return [...rows];
    }
    const order = this.session.questions().map((question) => question.id);
    if (order.length === 0) {
      return [...rows];
    }
    const rank = new Map(order.map((id, index) => [id, index]));
    return [...rows].sort(
      (a, b) =>
        (rank.get(a.questionId) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(b.questionId) ?? Number.MAX_SAFE_INTEGER),
    );
  }
}
