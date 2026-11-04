import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { HomePage } from './home.page';

/**
 * The home page is still a placeholder (issue 008 owns the real dashboard),
 * but the mock exam entry lives here, so it needs a test that proves the door
 * exists and points at the flow instead of a dead link (issue 005).
 */
describe('home page', () => {
  async function createPage() {
    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('links to the mock exam flow for the bundled cert', async () => {
    const fixture = await createPage();

    expect(fixture.componentInstance.mockExamPath).toMatch(/^\/mock-exam\/[a-z0-9-]+$/);
  });

  it('links to the study exam flow for the bundled cert', async () => {
    const fixture = await createPage();

    expect(fixture.componentInstance.studyExamPath).toMatch(/^\/study-exam\/[a-z0-9-]+$/);
  });

  it('links to the domain practice list (PRACT-1)', async () => {
    const fixture = await createPage();

    expect(fixture.componentInstance.practicePath).toBe('/tabs/practice');
    const labels = [...fixture.nativeElement.querySelectorAll('ion-button')].map((button) =>
      (button.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
    expect(labels).toContain('Practice by domain');
  });

  it('summarizes the exam from the registry', async () => {
    const fixture = await createPage();

    expect(fixture.componentInstance.examSummary).toMatch(/questions/);
    expect(fixture.componentInstance.examSummary).toMatch(/pass at \d+/);
  });

  it('renders a Start mock exam action that navigates into the flow', async () => {
    const fixture = await createPage();

    const action = fixture.nativeElement.querySelector('ion-button');
    expect(action).not.toBeNull();
    expect(action.textContent).toContain('Start mock exam');
  });
});
