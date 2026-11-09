import { Component, computed, inject, input } from '@angular/core';
import { IonButton, IonButtons } from '@ionic/angular';
import { ChevronDown, LucideAngularModule } from 'lucide-angular';

import type { Certification } from '../../core/content/cert-registry';
import { SelectedCertService } from '../../core/content/selected-cert.service';

import { CertSwitcherService } from './cert-switcher.service';

/**
 * Toolbar certification switcher (CERT-6, CERT-7).
 *
 * The button names the current cert and opens the shared action sheet. It is
 * hidden when only one active cert exists. The text label carries the meaning
 * for assistive technology; the chevron is decorative.
 */
@Component({
  selector: 'app-cert-switcher',
  imports: [IonButton, IonButtons, LucideAngularModule],
  host: { slot: 'end' },
  template: `
    @if (show()) {
      <ion-buttons>
        <ion-button fill="clear" (click)="open()" [attr.aria-label]="label()">
          {{ current()?.shortName }}
          <lucide-icon
            [name]="ChevronDown"
            [size]="14"
            aria-hidden="true"
            focusable="false"
          ></lucide-icon>
        </ion-button>
      </ion-buttons>
    }
  `,
})
export class CertSwitcherComponent {
  private readonly selected = inject(SelectedCertService);
  private readonly switcher = inject(CertSwitcherService);

  /** Test and host seam: override the active list to exercise CERT-7. */
  readonly certs = input<readonly Certification[] | undefined>(undefined);

  protected readonly ChevronDown = ChevronDown;

  protected readonly activeCerts = computed(
    () => this.certs() ?? this.selected.activeCerts(),
  );
  protected readonly current = computed(() => this.selected.cert());
  protected readonly show = computed(() => this.activeCerts().length > 1);
  protected readonly label = computed(() => {
    const current = this.current();
    return current
      ? `Switch certification, current: ${current.shortName}`
      : 'Switch certification';
  });

  protected open(): void {
    void this.switcher.open();
  }
}
