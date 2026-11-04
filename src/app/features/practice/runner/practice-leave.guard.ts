/**
 * Leave guard for the practice runner (issue 007, PRACT-27 to PRACT-30).
 *
 * In-app navigation away from a running practice session asks the runner page
 * to confirm. Confirming preserves the session for resume; nothing is
 * discarded (PRACT-29). Switching certs goes through the same guard, so a
 * session is never silently lost. The Android hardware back handler is
 * deferred to the native phase and must reuse this guard.
 */

import { CanDeactivateFn } from '@angular/router';

/** Implemented by pages that can veto leaving while practice is running. */
export interface PracticeLeaveAware {
  /** Resolve true when leaving is safe or confirmed, false to stay. */
  confirmLeave(): Promise<boolean>;
}

export const practiceLeaveGuard: CanDeactivateFn<PracticeLeaveAware> = (component) =>
  component.confirmLeave();
