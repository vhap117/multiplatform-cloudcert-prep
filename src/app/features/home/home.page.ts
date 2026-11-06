import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import { type Certification } from '../../core/content/cert-registry';
import { loadAllQuestions } from '../../core/content/question-loader';
import { SelectedCertService } from '../../core/content/selected-cert.service';
import { formatTotalTime } from '../../core/exam';
import { STUDY_REPOSITORY } from '../../core/storage/repository-provider';
import { CertSwitcherComponent } from '../../layout/cert-switcher/cert-switcher.component';
import { mockExamStartPath, mockExamRunPath } from '../mock-exam/mock-exam.routes';
import { MockExamSessionService } from '../mock-exam/session/mock-exam-session.service';
import { practiceConfigPath, practiceRunPath } from '../practice/practice.routes';
import { PracticeSessionService } from '../practice/session/practice-session.service';
import { studyExamRunPath, studyExamStartPath } from '../study-exam/study-exam.routes';
import { StudyExamSessionService } from '../study-exam/session/study-exam-session.service';

import {
  buildDomainPerformance,
  buildExamMetrics,
  buildNextUp,
  buildResumeCards,
  recentExamAttempts,
  type DomainPerformanceRow,
  type ExamMetrics,
  type NextUpView,
  type RecentExamAttempt,
  type ResumeCardView,
} from './dashboard-view.model';

type SectionState = 'loading' | 'ready' | 'error';

/**
 * Cert dashboard (issue 008).
 *
 * The Home tab is the selected cert's dashboard. The three data sections load
 * and fail independently: exam performance, combined domain performance, and
 * in-progress sessions. A failed read therefore replaces only its own section
 * with an inline error and Try again, while the header and other sections keep
 * rendering.
 *
 * Only mock and study exam attempts feed exam metrics and recent exam
 * attempts. Practice sessions feed practice coverage, the combined domain
 * view, and the Next up recommendation, but never appear as exam attempts.
 */
@Component({
  selector: 'app-home',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonSkeletonText,
    CertSwitcherComponent,
  ],
  templateUrl: './home.page.html',
  styleUrl: './home.page.css',
})
export class HomePage implements OnInit {
  private readonly router = inject(Router);
  private readonly repository = inject(STUDY_REPOSITORY);
  private readonly mockSessions = inject(MockExamSessionService);
  private readonly studySessions = inject(StudyExamSessionService);
  private readonly practiceSessions = inject(PracticeSessionService);
  private readonly selectedCert = inject(SelectedCertService);

  protected readonly cert = this.selectedCert.cert;

  protected readonly examState = signal<SectionState>('loading');
  protected readonly domainState = signal<SectionState>('loading');
  protected readonly resumeState = signal<SectionState>('loading');

  protected readonly examError = signal('');
  protected readonly domainError = signal('');
  protected readonly resumeError = signal('');
  protected readonly resumeActionError = signal('');

  protected readonly metrics = signal<ExamMetrics | null>(null);
  protected readonly recentAttempts = signal<readonly RecentExamAttempt[]>([]);
  protected readonly domainRows = signal<readonly DomainPerformanceRow[]>([]);
  protected readonly nextUp = signal<NextUpView | null>(null);
  protected readonly resumeCards = signal<readonly ResumeCardView[]>([]);

  /**
   * Re-scope every section when the selected cert changes (CERT-21). The
   * first effect run is skipped because `ngOnInit` owns the initial load.
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
    void Promise.all([
      this.loadExamSection(),
      this.loadDomainSection(),
      this.loadResumeSection(),
    ]);
  });

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.loadExamSection(),
      this.loadDomainSection(),
      this.loadResumeSection(),
    ]);
  }

  protected async loadExamSection(): Promise<void> {
    const cert = this.cert();
    if (!cert) {
      this.examState.set('ready');
      return;
    }
    this.examState.set('loading');
    this.examError.set('');
    try {
      const attempts = await this.repository.listAttempts({ cert: cert.code });
      this.metrics.set(buildExamMetrics(attempts));
      this.recentAttempts.set(recentExamAttempts(attempts));
      this.examState.set('ready');
    } catch (error) {
      this.examError.set(messageOf(error));
      this.examState.set('error');
    }
  }

  protected async loadDomainSection(): Promise<void> {
    const cert = this.cert();
    if (!cert) {
      this.domainState.set('ready');
      return;
    }
    this.domainState.set('loading');
    this.domainError.set('');
    try {
      const [attempts, practiceResults, bank] = await Promise.all([
        this.repository.listAttempts({ cert: cert.code }),
        this.repository.listPracticeResults(cert.code),
        loadAllQuestions(cert.code),
      ]);
      const rows = buildDomainPerformance(cert, practiceResults, bank, attempts);
      this.domainRows.set(rows);
      this.nextUp.set(buildNextUp(cert, rows));
      this.domainState.set('ready');
    } catch (error) {
      this.domainError.set(messageOf(error));
      this.domainState.set('error');
    }
  }

  protected async loadResumeSection(): Promise<void> {
    const cert = this.cert();
    if (!cert) {
      this.resumeState.set('ready');
      return;
    }
    this.resumeState.set('loading');
    this.resumeError.set('');
    try {
      const sessions = await this.repository.listSessions();
      this.resumeCards.set(buildResumeCards(sessions, cert));
      this.resumeState.set('ready');
    } catch (error) {
      this.resumeError.set(messageOf(error));
      this.resumeState.set('error');
    }
  }

  protected async resume(card: ResumeCardView): Promise<void> {
    this.resumeActionError.set('');
    try {
      const resumed = await this.resumeForKind(card.kind);
      if (!resumed) {
        await this.loadResumeSection();
        return;
      }
      await this.router.navigateByUrl(this.runnerPath(card.kind));
    } catch (error) {
      this.resumeActionError.set(messageOf(error));
    }
  }

  private resumeForKind(kind: ResumeCardView['kind']): Promise<boolean> {
    const cert = this.cert();
    if (!cert) {
      return Promise.resolve(false);
    }
    switch (kind) {
      case 'mock':
        return this.mockSessions.resume(cert.code);
      case 'study':
        return this.studySessions.resume(cert.code);
      case 'practice':
        return this.practiceSessions.resume(cert.code);
    }
  }

  private runnerPath(kind: ResumeCardView['kind']): string {
    const cert = this.cert();
    if (!cert) {
      return '/tabs/home';
    }
    switch (kind) {
      case 'mock':
        return mockExamRunPath(cert.code);
      case 'study':
        return studyExamRunPath(cert.code);
      case 'practice':
        return practiceRunPath(cert.code);
    }
  }

  protected async goMockExam(): Promise<void> {
    if (this.cert()) {
      await this.router.navigateByUrl(mockExamStartPath(this.cert()!.code));
    }
  }

  protected async goDomainPractice(): Promise<void> {
    if (this.cert()) {
      await this.router.navigateByUrl(practiceConfigPath(this.cert()!.code));
    }
  }

  /** Secondary door until issue 010 expands the Practice screen entry points. */
  protected async goStudyExam(): Promise<void> {
    if (this.cert()) {
      await this.router.navigateByUrl(studyExamStartPath(this.cert()!.code));
    }
  }

  protected async goNextUp(): Promise<void> {
    const next = this.nextUp();
    if (this.cert() && next) {
      await this.router.navigateByUrl(practiceConfigPath(this.cert()!.code, next.domainId));
    }
  }

  protected async goHistory(): Promise<void> {
    await this.router.navigateByUrl('/tabs/history');
  }

  protected levelLabel(cert: Certification): string {
    return cert.level.charAt(0).toUpperCase() + cert.level.slice(1);
  }

  protected examSummary(cert: Certification): string {
    return `${cert.examQuestionCount} questions, ${formatTotalTime(
      Math.round(cert.examTimeSeconds / 60),
    )}, pass at ${cert.passingPercent}%`;
  }

  protected kindLabel(kind: ResumeCardView['kind']): string {
    switch (kind) {
      case 'mock':
        return 'Mock exam';
      case 'study':
        return 'Study exam';
      case 'practice':
        return 'Domain practice';
    }
  }

  protected recentKindLabel(kind: RecentExamAttempt['kind']): string {
    return kind === 'mock' ? 'Mock exam' : 'Study exam';
  }

  protected formatDate(timestamp: number): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(timestamp));
  }

  protected formatDateTime(timestamp: number): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(timestamp));
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
