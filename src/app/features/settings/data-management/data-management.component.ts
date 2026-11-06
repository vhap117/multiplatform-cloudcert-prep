import { Component, computed, inject, signal } from '@angular/core';
import { AlertController, IonButton, IonSpinner } from '@ionic/angular';

import { BackupService, type ImportPreview } from '../../../core/backup/backup.service';
import { SelectedCertService } from '../../../core/content/selected-cert.service';

/**
 * Data management section for Settings (issue 011).
 *
 * Export, import, per-cert reset, and delete-all, all local and offline.
 * Import and reset run only after a confirmation that names the scope; every
 * destructive path ends in a reload overlay so no stale in-memory state
 * survives (see `BackupService`). The device-only, no-sync promise is stated
 * here (OFF-29, OFF-18, PRIV-30, PRIV-32).
 */
@Component({
  selector: 'app-data-management',
  imports: [IonButton, IonSpinner],
  template: `
    <section class="ccp-card data-section" aria-labelledby="data-section-heading">
      <h2 id="data-section-heading" class="ccp-card-heading">Your data</h2>
      <p class="ccp-body ccp-muted">
        Everything stays on this device. Nothing is uploaded, synced, or backed
        up automatically.
      </p>
      <p class="ccp-body ccp-muted">
        Clearing app data or uninstalling the app deletes your study data.
        Export a backup first if you want to keep it across reinstalls.
      </p>

      <h3 class="group-heading">Backup</h3>
      <p class="ccp-small ccp-muted">
        The backup file contains your exam history, practice results, mastery,
        in-progress sessions, and settings. Keep it somewhere safe.
      </p>
      <div class="action-row">
        <ion-button [disabled]="busy()" (click)="exportData()">Export backup</ion-button>
        <ion-button fill="outline" [disabled]="busy()" (click)="importData()">
          Import backup
        </ion-button>
      </div>

      @if (status(); as message) {
        <p class="ccp-body success" role="status">{{ message }}</p>
      }
      @if (error(); as message) {
        <p class="ccp-body failure" role="alert">{{ message }}</p>
      }

      <h3 class="group-heading">Reset</h3>
      <div class="reset-cert">
        <label class="ccp-small" for="reset-cert">Certification to reset</label>
        <select
          id="reset-cert"
          class="reset-select"
          [value]="resetCertCode()"
          [disabled]="busy()"
          (change)="onResetCertChange($event)"
        >
          @for (cert of certs(); track cert.code) {
            <option [value]="cert.code">{{ cert.name }} ({{ cert.shortName }})</option>
          }
        </select>
        <ion-button color="danger" fill="outline" [disabled]="busy()" (click)="resetCert()">
          Reset this certification
        </ion-button>
      </div>

      <div class="reset-all">
        <p class="ccp-small ccp-muted">
          Deleting all local data removes every cert's study data. The app and
          the bundled question bank are not removed.
        </p>
        <ion-button color="danger" [disabled]="busy()" (click)="resetAll()">
          Delete all local data
        </ion-button>
      </div>
    </section>

    @if (overlay(); as message) {
      <div class="data-overlay" role="status" aria-live="polite">
        <ion-spinner name="crescent" aria-hidden="true"></ion-spinner>
        <p class="ccp-body">{{ message }}</p>
      </div>
    }
  `,
  styles: [
    `
      .data-section {
        margin-top: var(--ccp-space-lg);
      }

      .group-heading {
        font-size: 1rem;
        margin: var(--ccp-space-lg) 0 var(--ccp-space-sm);
      }

      .action-row {
        display: flex;
        flex-wrap: wrap;
        gap: var(--ccp-space-sm);
        margin-top: var(--ccp-space-sm);
      }

      .reset-cert {
        display: flex;
        flex-direction: column;
        gap: var(--ccp-space-sm);
        max-width: 22rem;
      }

      .reset-select {
        background: rgb(var(--ccp-bg-card));
        border: 1px solid rgb(var(--ccp-border));
        border-radius: var(--ccp-radius-input);
        color: rgb(var(--ccp-text));
        font: inherit;
        min-height: var(--ccp-tap-target);
        padding: 0 var(--ccp-space-sm);
      }

      .reset-all {
        border-top: 1px solid rgb(var(--ccp-border));
        margin-top: var(--ccp-space-lg);
        padding-top: var(--ccp-space-lg);
      }

      .success {
        color: rgb(var(--ccp-text));
      }

      .failure {
        color: rgb(var(--ccp-danger));
      }

      .data-overlay {
        align-items: center;
        background: rgb(var(--ccp-bg));
        display: flex;
        flex-direction: column;
        gap: var(--ccp-space-md);
        inset: 0;
        justify-content: center;
        position: fixed;
        z-index: 1000;
      }
    `,
  ],
})
export class DataManagementComponent {
  private readonly alerts = inject(AlertController);
  private readonly selectedCert = inject(SelectedCertService);
  protected readonly backup = inject(BackupService);

  protected readonly certs = computed(() => this.selectedCert.activeCerts());
  protected readonly resetCertCode = signal<string>(this.selectedCert.cert()?.code ?? '');
  protected readonly busy = signal(false);
  protected readonly status = signal('');
  protected readonly error = signal('');
  protected readonly overlay = this.backup.overlayMessage;

  protected onResetCertChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.resetCertCode.set(value);
  }

  protected async exportData(): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.status.set('');
    this.error.set('');
    this.busy.set(true);
    try {
      const summary = await this.backup.export();
      this.status.set(`Backup saved as ${summary.fileName}.`);
    } catch (error) {
      this.error.set(messageOf(error));
    } finally {
      this.busy.set(false);
    }
  }

  protected async importData(): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.status.set('');
    this.error.set('');
    this.busy.set(true);
    try {
      const preview = await this.backup.inspectImport();
      if (!preview) {
        return;
      }
      if (!(await this.confirmImport(preview))) {
        return;
      }
      await this.backup.applyImport(preview.backup);
    } catch (error) {
      this.error.set(messageOf(error));
    } finally {
      this.busy.set(false);
    }
  }

  protected async resetCert(): Promise<void> {
    if (this.busy()) {
      return;
    }
    const cert = this.certs().find((candidate) => candidate.code === this.resetCertCode());
    if (!cert) {
      return;
    }
    const confirmed = await this.confirmDestructive({
      header: `Reset ${cert.shortName}?`,
      message: `This deletes every exam attempt, practice record, question result, domain aggregate, mastery row, and in-progress session for ${cert.name}. Other certifications are unaffected. This cannot be undone.`,
      confirmText: 'Reset progress',
    });
    if (!confirmed) {
      return;
    }
    this.status.set('');
    this.error.set('');
    this.busy.set(true);
    try {
      await this.backup.resetCert(cert.code);
    } catch (error) {
      this.error.set(messageOf(error));
    } finally {
      this.busy.set(false);
    }
  }

  protected async resetAll(): Promise<void> {
    if (this.busy()) {
      return;
    }
    const alert = await this.alerts.create({
      header: 'Delete all local data?',
      message:
        'This deletes every exam attempt, practice record, question result, domain aggregate, mastery row, and in-progress session on this device. The app and the bundled question bank are not removed. This cannot be undone. Type DELETE to confirm.',
      inputs: [{ name: 'confirmation', type: 'text', placeholder: 'DELETE' }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete everything',
          role: 'destructive',
          handler: (data) =>
            (data as { confirmation?: string }).confirmation?.trim() === 'DELETE',
        },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'destructive') {
      return;
    }
    this.status.set('');
    this.error.set('');
    this.busy.set(true);
    try {
      await this.backup.resetAll();
    } catch (error) {
      this.error.set(messageOf(error));
    } finally {
      this.busy.set(false);
    }
  }

  private async confirmImport(preview: ImportPreview): Promise<boolean> {
    const counts = preview.counts;
    const skipped =
      preview.skippedRows > 0
        ? ` ${preview.skippedRows} unrecognized rows will be skipped.`
        : '';
    return this.confirmDestructive({
      header: 'Replace all local data?',
      message: `This replaces ALL local study data on this device with the backup from ${formatDate(
        preview.exportedAt,
      )}: ${counts.attempts} exam attempts, ${counts.questionResults} question results, ${
        counts.certProgress
      } domain progress rows, ${counts.questionMastery} mastery rows, and ${
        counts.sessions
      } in-progress sessions. Settings in the backup are applied too.${skipped} This cannot be undone.`,
      confirmText: 'Replace everything',
    });
  }

  private async confirmDestructive(options: {
    header: string;
    message: string;
    confirmText: string;
  }): Promise<boolean> {
    const alert = await this.alerts.create({
      header: options.header,
      message: options.message,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: options.confirmText, role: 'destructive' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'destructive';
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(timestamp));
}
