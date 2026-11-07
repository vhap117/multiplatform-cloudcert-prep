import type { Routes } from '@angular/router';

/**
 * Development-only routes.
 *
 * `angular.json` replaces this file with `dev.routes.prod.ts` for a production
 * build, so the seed screen and its chunk never ship. Keeping the dynamic
 * import here (rather than inline in `app.routes.ts`) is what lets the
 * replacement drop the chunk from the production graph (CONT-38).
 */
export const devRoutes: Routes = [
  {
    path: '__dev/seed',
    loadComponent: () => import('./seed/seed.page').then((m) => m.SeedPage),
    title: 'Development seed',
  },
];
