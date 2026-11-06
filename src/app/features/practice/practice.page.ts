import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';

import { SelectedCertService } from '../../core/content/selected-cert.service';
import { STUDY_REPOSITORY } from '../../core/storage/repository-provider';
import { CertSwitcherComponent } from '../../layout/cert-switcher/cert-switcher.component';
import { CertSwitcherService } from '../../layout/cert-switcher/cert-switcher.service';
import { HomeButtonComponent } from '../../layout/home-button/home-button.component';
import { buildResumeCards, type ResumeCardView } from '../home/dashboard-view.model';
import { mockExamRunPath, mockExamStartPath } from '../mock-exam/mock-exam.routes';
import { MockExamSessionService } from '../mock-exam/session/mock-exam-session.service';
import { studyExamRunPath, studyExamStartPath } from '../study-exam/study-exam.routes';
import { StudyExamSessionService } from '../study-exam/session/study-exam-session.service';

import { PRACTICE_SEGMENT, practiceConfigPath, practiceRunPath } from './practice.routes';
import { PracticeSessionService } from './session/practice-session.service';

/**
 * The Practice tab (CERT-25, CERT-26, CERT-29; PRACT-1 to PRACT-3).
 *
 * Names the selected cert's three study modes and surfaces the most recent
 * in-progress session with a Resume action. The per-domain shortcut list stays
 * underneath so dashboard deep links keep landing on a preselected domain.
 * Switching the cert re-scopes the screen in place (CERT-21).
 */
@Component({
  selector: 'app-practice',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    RouterLink,
    HomeButtonComponent,
    CertSwitcherComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Practice</ion-title>
        <app-home-button />
        <app-cert-switcher />
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="ccp-page">
        <div class="ccp-content">
          <p class="ccp-kicker">Adaptive practice</p>
          <h1 class="ccp-display">Practice</h1>

          @if (cert(); as activeCert) {
            <p class="ccp-body ccp-muted">
              {{ activeCert.name }} ({{ activeCert.shortName }}). Choose a study
              mode for this certification.
            </p>

            <div class="mode-actions">
              <ion-button expand="block" (click)="goMockExam()">Mock exam</ion-button>
              <ion-button expand="block" fill="outline" (click)="goDomainPractice()">
                Domain practice
              </ion-button>
              <ion-button expand="block" fill="clear" (click)="goStudyExam()">
                Study exam
              </ion-button>
            </div>

            @if (resumeState() === 'error') {
              <div class="ccp-card practice-resume" role="alert">
                <p class="ccp-body section-error">{{ resumeError() }}</p>
                <ion-button fill="outline" (click)="loadResumeCard()">Try again</ion-button>
              </div>
            } @else if (resumeCard(); as card) {
              <section class="ccp-card practice-resume" aria-labelledby="practice-resume-heading">
                <h2 id="practice-resume-heading" class="ccp-card-heading">In progress</h2>
                <p class="ccp-small ccp-muted">
                  {{ resumeKindLabel(card.kind) }} · {{ card.answeredCount }} answered
                </p>
                <ion-button fill="outline" (click)="resume()">
                  Resume {{ resumeKindLabel(card.kind) }}
                </ion-button>
                @if (resumeActionError(); as message) {
                  <p class="ccp-body section-error" role="alert">{{ message }}</p>
                }
              </section>
            }

            <button type="button" class="link-button all-certs" (click)="openSwitcher()">
              All certifications
            </button>

            <h2 class="ccp-card-heading domain-heading">Domains</h2>
            <p class="ccp-small ccp-muted">
              Pick one domain and answer a short adaptive session with instant
              feedback.
            </p>

            <ul class="domain-actions">
              @for (domain of activeCert.domains; track domain.id) {
                <li>
                  <a
                    class="practice-domain ccp-card"
                    [routerLink]="configSegments()"
                    [queryParams]="{ domain: domain.id }"
                  >
                    <span class="ccp-body">{{ domain.name }}</span>
                    <span class="ccp-small ccp-muted">Practice this domain</span>
                  </a>
                </li>
              }
            </ul>
          } @else {
            <p class="ccp-body ccp-muted" role="alert">
              No active certification is available for domain practice yet.
            </p>
          }
        </div>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .mode-actions {
        display: flex;
        flex-direction: column;
        gap: var(--ccp-space-sm);
        margin-top: var(--ccp-space-lg);
      }

      .practice-resume {
        margin-top: var(--ccp-space-lg);
      }

      .all-certs {
        margin-top: var(--ccp-space-lg);
      }

      .domain-heading {
        margin-top: var(--ccp-space-lg);
      }

      .domain-actions {
        display: grid;
        gap: var(--ccp-space-md);
        list-style: none;
        margin: var(--ccp-space-lg) 0 0;
        padding: 0;
      }

      .practice-domain {
        color: inherit;
        display: flex;
        flex-direction: column;
        gap: var(--ccp-space-xs);
        text-decoration: none;
      }

      .practice-domain:focus-visible {
        outline: 2px solid rgb(var(--ccp-focus));
        outline-offset: 2px;
      }

      .section-error {
        color: rgb(var(--ccp-danger));
      }
    `,
  ],
})
export class PracticePage implements OnInit {
  private readonly router = inject(Router);
  private readonly repository = inject(STUDY_REPOSITORY);
  private readonly mockSessions = inject(MockExamSessionService);
  private readonly studySessions = inject(StudyExamSessionService);
  private readonly practiceSessions = inject(PracticeSessionService);
  private readonly selectedCert = inject(SelectedCertService);
  private readonly switcher = inject(CertSwitcherService);

  readonly cert = this.selectedCert.cert;

  readonly resumeState = signal<'loading' | 'ready' | 'error'>('loading');
  readonly resumeError = signal('');
  readonly resumeActionError = signal('');
  readonly resumeCard = signal<ResumeCardView | null>(null);

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
    void this.loadResumeCard();
  });

  async ngOnInit(): Promise<void> {
    await this.loadResumeCard();
  }

  async loadResumeCard(): Promise<void> {
    const cert = this.cert();
    this.resumeState.set('loading');
    this.resumeError.set('');
    this.resumeCard.set(null);
    if (!cert) {
      this.resumeState.set('ready');
      return;
    }
    try {
      const sessions = await this.repository.listSessions();
      this.resumeCard.set(buildResumeCards(sessions, cert)[0] ?? null);
      this.resumeState.set('ready');
    } catch (error) {
      this.resumeError.set(messageOf(error));
      this.resumeState.set('error');
    }
  }

  async resume(): Promise<void> {
    const card = this.resumeCard();
    const cert = this.cert();
    if (!card || !cert) {
      return;
    }
    this.resumeActionError.set('');
    try {
      const resumed = await this.resumeForKind(card.kind, cert.code);
      if (!resumed) {
        await this.loadResumeCard();
        return;
      }
      await this.router.navigateByUrl(this.runnerPath(card.kind, cert.code));
    } catch (error) {
      this.resumeActionError.set(messageOf(error));
    }
  }

  resumeKindLabel(kind: ResumeCardView['kind']): string {
    switch (kind) {
      case 'mock':
        return 'Mock exam';
      case 'study':
        return 'Study exam';
      case 'practice':
        return 'Domain practice';
    }
  }

  goMockExam(): void {
    const cert = this.cert();
    if (cert) {
      void this.router.navigateByUrl(mockExamStartPath(cert.code));
    }
  }

  goDomainPractice(): void {
    const cert = this.cert();
    if (cert) {
      void this.router.navigateByUrl(practiceConfigPath(cert.code));
    }
  }

  goStudyExam(): void {
    const cert = this.cert();
    if (cert) {
      void this.router.navigateByUrl(studyExamStartPath(cert.code));
    }
  }

  openSwitcher(): void {
    void this.switcher.open();
  }

  configSegments(): string[] {
    // Absolute on purpose: the Practice tab lives at /tabs/practice, and a
    // relative link there would resolve to /tabs/practice/practice/... .
    const cert = this.cert();
    return cert ? [`/${PRACTICE_SEGMENT}`, cert.code] : ['/tabs/practice'];
  }

  private resumeForKind(kind: ResumeCardView['kind'], code: string): Promise<boolean> {
    switch (kind) {
      case 'mock':
        return this.mockSessions.resume(code);
      case 'study':
        return this.studySessions.resume(code);
      case 'practice':
        return this.practiceSessions.resume(code);
    }
  }

  private runnerPath(kind: ResumeCardView['kind'], code: string): string {
    switch (kind) {
      case 'mock':
        return mockExamRunPath(code);
      case 'study':
        return studyExamRunPath(code);
      case 'practice':
        return practiceRunPath(code);
    }
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
