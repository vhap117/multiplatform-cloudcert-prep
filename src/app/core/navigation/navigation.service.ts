import { Location } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ActionSheetController, ModalController } from '@ionic/angular';

/**
 * The single in-app back entry point (CERT-15 to CERT-17, ACC-31, ACC-32).
 *
 * Pops one level: an open overlay closes first, then app history, then the
 * dashboard. The native hardware back handler will call exactly this method,
 * so screen code never has to know how back is triggered (issues 000 and 010).
 */
@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly actions = inject(ActionSheetController);
  private readonly modals = inject(ModalController);

  async back(): Promise<void> {
    const sheet = await this.actions.getTop();
    if (sheet) {
      await sheet.dismiss();
      return;
    }
    const modal = await this.modals.getTop();
    if (modal) {
      await modal.dismiss();
      return;
    }
    if (this.hasAppHistory()) {
      this.location.back();
      return;
    }
    await this.router.navigateByUrl('/tabs/home');
  }

  /** True when the current stack has a previous in-app entry to return to. */
  private hasAppHistory(): boolean {
    const state = globalThis.history?.state as
      | { navigationId?: number }
      | null
      | undefined;
    return typeof state?.navigationId === 'number' && state.navigationId > 1;
  }
}
