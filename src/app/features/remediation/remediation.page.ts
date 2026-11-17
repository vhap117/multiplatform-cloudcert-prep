/**
 * Remediation session.
 *
 * A read-only review of wrong domain-practice answers. Each question renders
 * exactly like the graded practice runner: the stored wrong selection, the
 * recorded order or matches, and the same feedback groups. Removing a question
 * stores a dismissal so it stays out of the list until a newer wrong practice
 * answer re-adds it.
 */

import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import { getCert, type Certification } from '../../core/content/cert-registry';
import { loadAllQuestions } from '../../core/content/question-loader';
import { questionType, type Question } from '../../core/content/question-types';
import type { FeedbackEntry, FeedbackEntryKind, QuestionFeedback } from '../../core/exam-session/feedback';
import { STUDY_REPOSITORY } from '../../core/storage/repository-provider';
import {
  buildRemediationItems,
  type RemediationItem,
} from './remediation-view.model';

type LoadState = 'loading' | 'ready' | 'error';

interface OptionEntry {
  key: string;
  text: string;
}

@Component({
  selector: 'app-remediation',
  imports: [
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './remediation.page.html',
  styleUrl: './remediation.page.css',
})
export class RemediationPage implements OnInit {
  private readonly repository = inject(STUDY_REPOSITORY);
  private readonly router = inject(Router);
  private readonly alerts = inject(AlertController);

  readonly certCode = input<string>();

  protected readonly state = signal<LoadState>('loading');
  protected readonly error = signal('');
  protected readonly items = signal<readonly RemediationItem[]>([]);
  protected readonly index = signal(0);
  protected readonly announcing = signal('');
  protected readonly removing = signal(false);

  protected readonly cert = computed<Certification | null>(() => {
    const code = this.certCode();
    return code ? getCert(code) : null;
  });
  protected readonly current = computed<RemediationItem | null>(() => {
    const items = this.items();
    return items[this.index()] ?? null;
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async load(): Promise<void> {
    const cert = this.cert();
    if (!cert) {
      this.error.set('That certification is not available on this device.');
      this.state.set('error');
      return;
    }
    this.state.set('loading');
    this.error.set('');
    try {
      const [results, dismissals, bank] = await Promise.all([
        this.repository.listPracticeResults(cert.code),
        this.repository.listRemediationDismissals(cert.code),
        loadAllQuestions(cert.code),
      ]);
      this.items.set(buildRemediationItems(results, dismissals, bank, cert));
      this.index.set(0);
      this.state.set('ready');
    } catch (cause) {
      this.error.set(messageOf(cause));
      this.state.set('error');
    }
  }

  protected previous(): void {
    this.index.update((value) => Math.max(0, value - 1));
  }

  protected next(): void {
    this.index.update((value) => Math.min(this.items().length - 1, value + 1));
  }

  protected async remove(item: RemediationItem): Promise<void> {
    const cert = this.cert();
    if (!cert || this.removing()) {
      return;
    }
    const alert = await this.alerts.create({
      header: 'Remove from remediation?',
      message:
        'This question will leave the remediation list. It returns only if you answer it wrong again in domain practice.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Remove', role: 'destructive' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'destructive') {
      return;
    }
    this.removing.set(true);
    this.error.set('');
    try {
      await this.repository.putRemediationDismissal({
        id: `${cert.code}:${item.question.id}`,
        cert: cert.code,
        questionId: item.question.id,
        dismissedAt: Date.now(),
      });
      const remaining = this.items().filter((row) => row.question.id !== item.question.id);
      this.items.set(remaining);
      this.index.set(Math.min(this.index(), Math.max(0, remaining.length - 1)));
      this.announcing.set('Question removed from remediation.');
    } catch (cause) {
      this.error.set(messageOf(cause));
    } finally {
      this.removing.set(false);
    }
  }

  protected async leave(): Promise<void> {
    await this.router.navigateByUrl('/tabs/home');
  }

  protected typeOf = questionType;

  protected optionEntries(question: Question): OptionEntry[] {
    return Object.entries(question.options).map(([key, text]) => ({ key, text }));
  }

  protected targetEntries(question: Question): OptionEntry[] {
    return Object.entries(question.targets ?? {}).map(([key, text]) => ({ key, text }));
  }

  protected optionText(question: Question, key: string): string {
    return question.options[key] ?? key;
  }

  protected targetText(question: Question, key: string): string {
    return question.targets?.[key] ?? key;
  }

  protected selectedKeys(item: RemediationItem): string[] {
    return Array.isArray(item.answer) ? item.answer : item.answer ? [item.answer] : [];
  }

  protected orderingKeys(item: RemediationItem): string[] {
    return Array.isArray(item.answer) ? item.answer : [];
  }

  protected recordedMatching(item: RemediationItem): { left: OptionEntry; targetText: string }[] {
    const pairs = new Map(
      (Array.isArray(item.answer) ? item.answer : []).map(
        (token) => token.split(':') as [string, string],
      ),
    );
    return this.optionEntries(item.question).map((left) => ({
      left,
      targetText: this.targetText(item.question, pairs.get(left.key) ?? ''),
    }));
  }

  protected entriesOfKind(feedback: QuestionFeedback, kind: FeedbackEntryKind): FeedbackEntry[] {
    return feedback.options.filter((entry) => entry.kind === kind);
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
