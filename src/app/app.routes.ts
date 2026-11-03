import { Routes } from '@angular/router';

import { mockExamLeaveGuard } from './features/mock-exam/runner/mock-exam-leave.guard';

/**
 * Tabs are the primary navigation surface (CERT-9 to CERT-12).
 *
 * Each tab is a lazy-loaded standalone page. The native hardware back handler
 * is deferred to a later phase; when it arrives it must call a single back
 * entry point rather than reach into these pages.
 */
export const routes: Routes = [
  {
    path: '',
    redirectTo: 'tabs/home',
    pathMatch: 'full',
  },
  {
    path: 'tabs',
    loadComponent: () => import('./layout/tabs/tabs.page').then((m) => m.TabsPage),
    children: [
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
      {
        path: 'home',
        loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage),
        title: 'Home',
      },
      {
        path: 'practice',
        loadComponent: () =>
          import('./features/practice/practice.page').then((m) => m.PracticePage),
        title: 'Practice',
      },
      {
        path: 'history',
        loadComponent: () =>
          import('./features/history/history.page').then((m) => m.HistoryPage),
        title: 'History',
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.page').then((m) => m.SettingsPage),
        title: 'Settings',
      },
    ],
  },
  {
    /*
     * The mock exam flow runs full screen (issue 005). It is deliberately not a
     * child of the tabs shell: an exam in progress must not expose tab
     * navigation, and leaving the runner has to go through the leave guard.
     */
    path: 'mock-exam/:certCode',
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/mock-exam/start/mock-exam-start.page').then(
            (m) => m.MockExamStartPage,
          ),
        title: 'Mock exam',
      },
      {
        path: 'run',
        canDeactivate: [mockExamLeaveGuard],
        loadComponent: () =>
          import('./features/mock-exam/runner/mock-exam-runner.page').then(
            (m) => m.MockExamRunnerPage,
          ),
        title: 'Mock exam in progress',
      },
      {
        path: 'results',
        loadComponent: () =>
          import('./features/mock-exam/results/mock-exam-results.page').then(
            (m) => m.MockExamResultsPage,
          ),
        title: 'Mock exam results',
      },
    ],
  },
  {
    /*
     * The study exam runs full screen too. It deliberately has no leave guard:
     * progress is saved after every graded answer, so walking away never
     * discards anything (STUDY-52).
     */
    path: 'study-exam/:certCode',
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/study-exam/start/study-exam-start.page').then(
            (m) => m.StudyExamStartPage,
          ),
        title: 'Study exam',
      },
      {
        path: 'run',
        loadComponent: () =>
          import('./features/study-exam/runner/study-exam-runner.page').then(
            (m) => m.StudyExamRunnerPage,
          ),
        title: 'Study exam in progress',
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'tabs/home',
  },
];
