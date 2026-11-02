import { Routes } from '@angular/router';

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
    path: '**',
    redirectTo: 'tabs/home',
  },
];
