import { Injectable, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ActionSheetController, type ActionSheetButton } from '@ionic/angular';

import { getCert, listCerts } from '../../core/content/cert-registry';
import { SelectedCertService } from '../../core/content/selected-cert.service';
import { SplashService } from '../../core/motion/splash.service';

/**
 * Presents the certification switcher and performs the switch (CERT-6,
 * CERT-7, CERT-8, CERT-21).
 *
 * Active certs are selectable, coming-soon certs stay visible but disabled so
 * nothing opens a broken flow (CERT-2). Leaving a guarded runner screen to
 * switch goes through the router first, which fires the mock or practice leave
 * guard, so the standard confirmation appears and a veto leaves the selection
 * untouched (CERT-8). The preference is written only after the leave is
 * confirmed.
 */
@Injectable({ providedIn: 'root' })
export class CertSwitcherService {
  private readonly actions = inject(ActionSheetController);
  private readonly selected = inject(SelectedCertService);
  private readonly router = inject(Router);
  private readonly splash = inject(SplashService);

  /** CERT-7: a single active cert needs no switcher. */
  readonly visible = computed(() => this.selected.activeCerts().length > 1);

  async open(): Promise<void> {
    const current = this.selected.cert();
    const buttons: ActionSheetButton[] = listCerts().map((cert) => {
      if (cert.status !== 'active') {
        return { text: `${cert.shortName} (coming soon)`, disabled: true };
      }
      const isCurrent = cert.code === current?.code;
      return {
        text: isCurrent ? `${cert.shortName} (current)` : cert.shortName,
        handler: () => {
          void this.switchTo(cert.code);
        },
      };
    });
    buttons.push({ text: 'Cancel', role: 'cancel' });

    const sheet = await this.actions.create({
      header: 'Choose certification',
      subHeader: 'Only active certifications can be studied.',
      buttons,
    });
    await sheet.present();
    await sheet.onDidDismiss();
  }

  /**
   * Switch to an active cert, routing through the leave guard when the current
   * screen is a guarded runner. Returns false when the switch did not happen.
   */
  async switchTo(code: string): Promise<boolean> {
    const target = getCert(code);
    if (!target || target.status !== 'active') {
      return false;
    }
    if (code === this.selected.cert()?.code) {
      return true;
    }
    if (this.isGuardedRunner()) {
      const left = await this.router.navigateByUrl('/tabs/home');
      if (!left) {
        return false;
      }
    }
    const previous = this.selected.cert()?.code ?? null;
    const switched = this.selected.select(code);
    if (switched && previous !== code) {
      this.splash.show(1200);
    }
    return switched;
  }

  private isGuardedRunner(): boolean {
    const url = (this.router.url ?? '').split('?')[0] ?? '';
    return /^\/(?:mock-exam|practice)\/[^/]+\/run\/?$/.test(url);
  }
}
