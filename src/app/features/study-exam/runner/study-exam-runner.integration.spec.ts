import 'fake-indexeddb/auto';

import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { provideStudyRepository } from '../../../core/storage/repository-provider';
import { StudyExamSessionService } from '../session/study-exam-session.service';
import { StudyExamRunnerPage } from './study-exam-runner.page';

/**
 * Renders the runner against the real session service and the real local
 * store, with no stubs.
 *
 * The component specs stub the service, which is right for interaction, but it
 * means nothing ever proved the exam view renders once a session is live. A
 * headless browser dump cannot prove it either: the local store never settles
 * under `--dump-dom`, which this project already confirmed with a standalone
 * IndexedDB probe.
 */
describe('study exam runner with the real session service', () => {
  it('renders the three progress bars once a session is active', async () => {
    await TestBed.configureTestingModule({
      imports: [StudyExamRunnerPage],
      providers: [provideStudyRepository(), provideRouter([])],
    }).compileComponents();

    const sessions = TestBed.inject(StudyExamSessionService);
    await sessions.start('clf-c02');

    const fixture = TestBed.createComponent(StudyExamRunnerPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const bars = fixture.nativeElement.querySelectorAll('[role="progressbar"]');
    expect(bars.length).toBe(3);
    expect(fixture.nativeElement.textContent).toContain('Answered');
    expect(fixture.nativeElement.textContent).toContain('Correct');
    expect(fixture.nativeElement.textContent).toContain('Wrong');
  });

  it('renders the recoverable empty state when no session exists', async () => {
    await TestBed.configureTestingModule({
      imports: [StudyExamRunnerPage],
      providers: [provideStudyRepository(), provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(StudyExamRunnerPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // The local store settles at once here, so the loading state is gone and
    // the page must state that nothing is running instead of staying blank.
    expect(fixture.nativeElement.textContent).toContain('No study exam running');
    expect(fixture.nativeElement.querySelectorAll('[role="progressbar"]').length).toBe(0);
  });
});
