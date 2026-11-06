import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { IonButton, IonContent, IonHeader, IonSkeletonText, IonTitle, IonToolbar } from '@ionic/angular';

import { loadAllQuestions } from '../../core/content/question-loader';
import { SelectedCertService } from '../../core/content/selected-cert.service';
import { formatTotalTime } from '../../core/exam';
import { STUDY_REPOSITORY } from '../../core/storage/repository-provider';
import type { AttemptRow } from '../../core/storage/types';
import { CertSwitcherComponent } from '../../layout/cert-switcher/cert-switcher.component';
import {
  ReviewCardComponent,
} from '../mock-exam/results/review-card.component';
import {
  applyReviewFilter,
  buildDomainBreakdown,
  buildReviewCards,
  domainFilters,
  type DomainBreakdownRow,
  type ReviewCardView,
  type ReviewFilter,
} from '../mock-exam/results/results-view.model';

import {
  buildHistoryStatistics,
  filterAttempts,
  isReviewable,
  type HistoryFilter,
  type HistoryStatistics,
  type KindStatistics,
} from './history-view.model';

type LoadState = 'loading' | 'ready' | 'error';
type Segment = 'history' | 'statistics';

const PAGE_SIZE = 10;

/**
 * History and local statistics for the selected cert (issue 009).
 *
 * Only exam attempts expand into question review. Practice sessions are
 * session-level summaries only, because their question results have no parent
 * attempt (DATA-18). All reads go through `StudyRepository`; nothing here uses
 * the network.
 */
@Component({
  selector: 'app-history',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonSkeletonText, ReviewCardComponent, CertSwitcherComponent],
  templateUrl: './history.page.html',
  styleUrl: './history.page.css',
})
export class HistoryPage implements OnInit {
  private readonly repository = inject(STUDY_REPOSITORY);
  private readonly selectedCert = inject(SelectedCertService);

  protected readonly cert = this.selectedCert.cert;
  protected readonly segment = signal<Segment>('history');
  protected readonly historyFilters: readonly { value: HistoryFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'passed', label: 'Passed' },
    { value: 'failed', label: 'Failed' },
    { value: 'mock', label: 'Mock exam' },
    { value: 'study', label: 'Study exam' },
    { value: 'practice', label: 'Domain practice' },
  ];

  protected readonly historyState = signal<LoadState>('loading');
  protected readonly historyError = signal('');
  protected readonly attempts = signal<readonly AttemptRow[]>([]);
  protected readonly filter = signal<HistoryFilter>('all');
  protected readonly limit = signal(PAGE_SIZE);

  protected readonly expandedId = signal<string | null>(null);
  protected readonly reviewState = signal<LoadState>('ready');
  protected readonly reviewError = signal('');
  protected readonly reviewCards = signal<readonly ReviewCardView[]>([]);
  protected readonly reviewFilter = signal<ReviewFilter>('all');
  protected readonly reviewDomains = signal<readonly { id: number; name: string }[]>([]);

  protected readonly statisticsState = signal<LoadState>('loading');
  protected readonly statisticsError = signal('');
  protected readonly statistics = signal<HistoryStatistics | null>(null);

  protected readonly filteredAttempts = computed(() =>
    filterAttempts(this.attempts(), this.filter()),
  );
  protected readonly visibleAttempts = computed(() =>
    this.filteredAttempts().slice(0, this.limit()),
  );
  protected readonly hasMore = computed(
    () => this.filteredAttempts().length > this.visibleAttempts().length,
  );
  protected readonly filteredReviewCards = computed(() =>
    applyReviewFilter(this.reviewCards(), this.reviewFilter()),
  );
  protected readonly expandedAttempt = computed(
    () => this.attempts().find((attempt) => attempt.id === this.expandedId()) ?? null,
  );
  protected readonly expandedDomains = computed<readonly DomainBreakdownRow[]>(() => {
    const attempt = this.expandedAttempt();
    return attempt ? buildDomainBreakdown(attempt, this.cert()) : [];
  });

  /**
   * Re-scope history and statistics when the selected cert changes (CERT-21).
   * The first effect run is skipped because `ngOnInit` owns the initial load.
   */
  private loadedCode: string | null | undefined = undefined;
  private readonly certChange = effect(() => {
    const code = this.selectedCert.code();
    if (this.loadedCode === undefined) {
      this.loadedCode = code;
      return;
    }
    if (code === this.loadedCode) {
      return;
    }
    this.loadedCode = code;
    void Promise.all([this.loadHistory(), this.loadStatistics()]);
  });

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadHistory(), this.loadStatistics()]);
  }

  protected async loadHistory(): Promise<void> {
    const cert = this.cert();
    if (!cert) {
      this.historyState.set('ready');
      return;
    }
    this.historyState.set('loading');
    this.historyError.set('');
    try {
      this.attempts.set(await this.repository.listAttempts({ cert: cert.code }));
      this.historyState.set('ready');
    } catch (error) {
      this.historyError.set(messageOf(error));
      this.historyState.set('error');
    }
  }

  protected async loadStatistics(): Promise<void> {
    const cert = this.cert();
    if (!cert) {
      this.statisticsState.set('ready');
      return;
    }
    this.statisticsState.set('loading');
    this.statisticsError.set('');
    try {
      const [attempts, practiceResults, bank] = await Promise.all([
        this.repository.listAttempts({ cert: cert.code }),
        this.repository.listPracticeResults(cert.code),
        loadAllQuestions(cert.code),
      ]);
      this.statistics.set(buildHistoryStatistics(attempts, practiceResults, bank, cert));
      this.statisticsState.set('ready');
    } catch (error) {
      this.statisticsError.set(messageOf(error));
      this.statisticsState.set('error');
    }
  }

  protected setSegment(segment: Segment): void {
    this.segment.set(segment);
  }

  protected setFilter(filter: HistoryFilter): void {
    this.filter.set(filter);
    this.limit.set(PAGE_SIZE);
    this.expandedId.set(null);
  }

  protected loadMore(): void {
    this.limit.update((current) => current + PAGE_SIZE);
  }

  protected async toggleAttempt(attempt: AttemptRow): Promise<void> {
    if (!isReviewable(attempt)) {
      return;
    }
    if (this.expandedId() === attempt.id) {
      this.closeReview();
      return;
    }
    this.expandedId.set(attempt.id);
    this.reviewFilter.set('all');
    await this.loadReview(attempt);
  }

  protected async retryReview(attempt: AttemptRow): Promise<void> {
    await this.loadReview(attempt);
  }

  private async loadReview(attempt: AttemptRow): Promise<void> {
    this.reviewCards.set([]);
    this.reviewDomains.set([]);
    this.reviewState.set('loading');
    this.reviewError.set('');
    try {
      const [results, bank] = await Promise.all([
        this.repository.listQuestionResults(attempt.id),
        loadAllQuestions(attempt.cert),
      ]);
      const cert = this.cert();
      if (!cert) {
        this.reviewState.set('ready');
        return;
      }
      const cards = buildReviewCards(results, bank, cert);
      this.reviewCards.set(cards);
      this.reviewDomains.set(domainFilters(cards, cert));
      this.reviewState.set('ready');
    } catch (error) {
      this.reviewError.set(messageOf(error));
      this.reviewState.set('error');
    }
  }

  protected closeReview(): void {
    this.expandedId.set(null);
    this.reviewFilter.set('all');
    this.reviewCards.set([]);
    this.reviewDomains.set([]);
    this.reviewState.set('ready');
    this.reviewError.set('');
  }

  protected setReviewFilter(filter: ReviewFilter): void {
    this.reviewFilter.set(filter);
  }

  protected kindLabel(kind: AttemptRow['kind']): string {
    switch (kind) {
      case 'mock':
        return 'Mock exam';
      case 'study':
        return 'Study exam';
      case 'practice':
        return 'Domain practice';
    }
  }

  protected formatDate(timestamp: number): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(timestamp));
  }

  protected formatDuration(seconds: number): string {
    return formatTotalTime(Math.round(seconds / 60));
  }

  protected kindStatsLabel(kind: KindStatistics['kind']): string {
    return this.kindLabel(kind);
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
