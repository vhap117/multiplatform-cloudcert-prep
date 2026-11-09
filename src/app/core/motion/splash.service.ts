import { Injectable } from '@angular/core';

interface SplashHost {
  ccpShowSplash?: (durationMs?: number) => void;
}

/**
 * Replays the boot splash for in-app transitions.
 *
 * The splash itself lives in index.html so it can paint before Angular boots.
 * This service is the Angular seam onto that global so callers stay testable.
 */
@Injectable({ providedIn: 'root' })
export class SplashService {
  show(durationMs = 5000): void {
    (globalThis as SplashHost).ccpShowSplash?.(durationMs);
  }
}
