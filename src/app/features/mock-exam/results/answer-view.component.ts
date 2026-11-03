/**
 * One rendered answer on a review card: either the student's answer or the
 * correct answer (EXAM-41).
 *
 * The option keys stay visible next to their text so a screen reader hears
 * the same identifiers the student saw, and the rendering never relies on
 * position or colour alone (ACC-4, ACC-6). Single and multi answers render
 * as a list of keyed lines, ordering as a numbered sequence, and matching
 * as left to right pairs.
 */

import { Component, input } from '@angular/core';

import type { AnswerView } from './results-view.model';

@Component({
  selector: 'app-answer-view',
  template: `
    <div class="answer-block">
      <h4 class="answer-label ccp-caption">{{ label() }}</h4>

      @switch (answer().kind) {
        @case ('none') {
          <p class="ccp-small ccp-muted answer-empty">Not answered</p>
        }
        @case ('keys') {
          <ul class="answer-lines">
            @for (line of answer().lines; track line.key) {
              <li class="ccp-small">
                <span class="answer-key ccp-mono">{{ line.key }}</span>
                {{ line.text }}
              </li>
            }
          </ul>
        }
        @case ('sequence') {
          <ol class="answer-lines">
            @for (step of answer().steps; track step.position) {
              <li class="ccp-small">
                {{ step.text }}
                <span class="answer-key ccp-mono">({{ step.key }})</span>
              </li>
            }
          </ol>
        }
        @case ('pairs') {
          <ul class="answer-lines">
            @for (pair of answer().pairs; track pair.left) {
              <li class="ccp-small">
                <span class="answer-key ccp-mono">{{ pair.left }}</span>
                {{ pair.leftText }}
                <span class="pair-arrow" aria-hidden="true">&#8594;</span>
                <span class="answer-key ccp-mono">{{ pair.right }}</span>
                {{ pair.rightText }}
              </li>
            }
          </ul>
        }
      }
    </div>
  `,
  styles: [
    `
      .answer-block {
        margin-top: var(--ccp-space-base);
      }

      .answer-label {
        color: rgb(var(--ccp-text-muted));
        margin: 0 0 var(--ccp-space-xs);
        text-transform: uppercase;
      }

      .answer-lines {
        display: grid;
        gap: var(--ccp-space-xs);
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .answer-lines li {
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

      .pair-arrow {
        color: rgb(var(--ccp-text-muted));
        margin: 0 var(--ccp-space-sm);
      }

      .answer-empty {
        margin: 0;
      }
    `,
  ],
})
export class AnswerViewComponent {
  readonly answer = input.required<AnswerView>();
  readonly label = input.required<string>();
}
