/**
 * Leave guard for the mock exam runner (S11, EXAM-16 to EXAM-18).
 *
 * In-app navigation away from an active exam asks the runner page to confirm.
 * Confirming preserves the attempt (nothing is discarded, the session row is
 * untouched) and lets the original navigation continue back to the previous
 * screen. The Android hardware back handler is deferred to the native phase
 * and must reuse this same guard when added (EXAM-19, issue 005 task list).
 */

import { CanDeactivateFn } from '@angular/router';

/** Implemented by pages that can veto leaving while an exam is running. */
export interface MockExamLeaveAware {
  /**
   * Resolve true when leaving is safe or confirmed, false to stay. The page
   * owns the confirmation dialog so the guard stays UI free and testable.
   */
  confirmLeave(): Promise<boolean>;
}

export const mockExamLeaveGuard: CanDeactivateFn<MockExamLeaveAware> = (component) =>
  component.confirmLeave();
