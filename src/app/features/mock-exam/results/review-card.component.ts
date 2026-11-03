/**
 * One reviewed question card (EXAM-41): student answer, correct answer,
 * correctness as text, flag state as text, the explanation summary, and the
 * per-option explanations for the options that matter.
 *
 * The report-question action copies the question id to the clipboard. That is
 * the allowed shape of EXAM-42 for this app, because no issue URL is
 * configured and share is out of scope (issue 005 log L3). The copy result is
 * announced through a live region, not colour alone (ACC-6, ACC-7).
 */

import { Component, input, OnDestroy, signal } from '@angular/core';

import { AnswerViewComponent } from './answer-view.component';
import type { ReviewCardView } from './results-view.model';

@Component({
  selector: 'app-review-card',
  imports: [AnswerViewComponent],
  template: `
    <article class="ccp-card review-card">
      <header class="review-head">
        <h3 class="ccp-card-heading">Question {{ card().number }}</h3>
        <div class="badges">
          <span
            class="badge"
            [class.badge-correct]="card().isCorrect"
            [class.badge-incorrect]="!card().isCorrect"
          >
            {{ card().isCorrect ? 'Correct' : 'Incorrect' }}
          </span>
          @if (card().wasFlagged) {
            <span class="badge badge-flagged">Flagged</span>
          }
        </div>
      </header>

      <p class="ccp-caption ccp-muted">{{ card().domainName }}</p>
      <p class="ccp-body question-text">{{ card().questionText }}</p>

      <app-answer-view [answer]="card().userAnswer" label="Your answer" />
      <app-answer-view [answer]="card().correctAnswer" label="Correct answer" />

      <section class="explanation" aria-label="Why this is the answer">
        <h4 class="answer-label ccp-caption">Why this is the answer</h4>
        <p class="ccp-small">{{ card().summary }}</p>
        @if (card().optionExplanations.length > 0) {
          <ul class="option-notes">
            @for (note of card().optionExplanations; track note.key) {
              <li class="ccp-small">
                <span class="answer-key ccp-mono">{{ note.key }}</span>
                {{ note.explanation }}
              </li>
            }
          </ul>
        }
      </section>

      <div class="report-row">
        <button type="button" class="report-button" (click)="report()">Report question</button>
        <span class="ccp-caption ccp-muted" aria-live="polite">{{ reportStatus }}</span>
      </div>
    </article>
  `,
  styles: [
    `
      .review-card {
        display: block;
      }

      .review-head {
        align-items: flex-start;
        display: flex;
        gap: var(--ccp-space-md);
        justify-content: space-between;
      }

      .badges {
        display: flex;
        flex-wrap: wrap;
        gap: var(--ccp-space-sm);
      }

      .badge {
        border: 1px solid rgb(var(--ccp-border));
        border-radius: var(--ccp-radius-pill);
        font-size: 0.75rem;
        font-weight: 600;
        line-height: 1.4;
        padding: 1px var(--ccp-space-sm);
        white-space: nowrap;
      }

      .badge-correct {
        border-color: rgb(var(--ccp-success));
        color: rgb(var(--ccp-success));
      }

      .badge-incorrect {
        border-color: rgb(var(--ccp-danger));
        color: rgb(var(--ccp-danger));
      }

      .badge-flagged {
        border-color: rgb(var(--ccp-warning));
        color: rgb(var(--ccp-warning));
      }

      .question-text {
        margin: var(--ccp-space-sm) 0 0;
      }

      .explanation {
        margin-top: var(--ccp-space-base);
      }

      .answer-label {
        color: rgb(var(--ccp-text-muted));
        margin: 0 0 var(--ccp-space-xs);
        text-transform: uppercase;
      }

      .option-notes {
        display: grid;
        gap: var(--ccp-space-xs);
        list-style: none;
        margin: var(--ccp-space-sm) 0 0;
        padding: 0;
      }

      .option-notes li {
        background: rgb(var(--ccp-bg));
        border: 1px solid rgb(var(--ccp-border));
        border-radius: var(--ccp-radius-inner);
        padding: var(--ccp-space-sm) var(--ccp-space-md);
      }

      .answer-key {
        display: inline-block;
        font-weight: 600;
        margin-right: var(--ccp-space-sm);
      }

      .report-row {
        align-items: center;
        display: flex;
        flex-wrap: wrap;
        gap: var(--ccp-space-sm);
        margin-top: var(--ccp-space-base);
        min-height: var(--ccp-tap-target);
      }

      .report-button {
        background: transparent;
        border: 1px solid rgb(var(--ccp-border));
        border-radius: var(--ccp-radius-input);
        color: rgb(var(--ccp-link));
        cursor: pointer;
        font: inherit;
        font-size: 0.875rem;
        min-height: var(--ccp-tap-target);
        padding: 0 var(--ccp-space-base);
      }
    `,
  ],
})
export class ReviewCardComponent implements OnDestroy {
  readonly card = input.required<ReviewCardView>();

  protected readonly copied = signal(false);
  protected readonly copyFailed = signal(false);

  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  protected get reportStatus(): string {
    if (this.copyFailed()) {
      return 'Could not copy the question id';
    }
    if (this.copied()) {
      return 'Question id copied to the clipboard';
    }
    return '';
  }

  /**
   * Copy the question id to the clipboard (EXAM-42). The outcome is reported
   * in the live region above, and a failure never pretends success.
   */
  protected async report(): Promise<void> {
    this.copyFailed.set(false);
    const clipboard = navigator.clipboard;
    if (!clipboard) {
      this.copyFailed.set(true);
      return;
    }
    try {
      await clipboard.writeText(this.card().questionId);
      this.copied.set(true);
      this.resetTimer = setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.copied.set(false);
      this.copyFailed.set(true);
    }
  }

  ngOnDestroy(): void {
    if (this.resetTimer !== null) {
      clearTimeout(this.resetTimer);
    }
  }
}
