import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import type { StorageDiagnostics } from '../../../core/storage/diagnostics';
import { describeStorageError } from '../../../core/storage/errors';
import {
  IS_NATIVE_STORAGE,
  STUDY_REPOSITORY,
} from '../../../core/storage/repository-provider';

type LoadState = 'loading' | 'ready' | 'error' | 'unavailable';

/**
 * Native storage health check.
 *
 * Reports the active SQLite schema version and whether every required table
 * and migration is present. The browser preview uses a different store, so the
 * page is inert there and the Settings entry point is hidden.
 */
@Component({
  selector: 'app-storage-diagnostics',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonButton,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/settings" text="Back"></ion-back-button>
        </ion-buttons>
        <ion-title>Database health</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="ccp-page">
        <div class="ccp-content">
          <p class="ccp-kicker">Settings</p>
          <h1 class="ccp-display">Database health</h1>

          @if (state() === 'loading') {
            <p class="ccp-body ccp-muted" role="status">
              Checking the local database...
            </p>
          }

          @if (state() === 'unavailable') {
            <section class="ccp-card" aria-labelledby="unavailable-heading">
              <h2 id="unavailable-heading" class="ccp-card-heading">Only on a device</h2>
              <p class="ccp-body ccp-muted">
                Storage diagnostics check the SQLite database, which only exists
                in the installed app. This browser preview uses a different local
                store.
              </p>
            </section>
          }

          @if (state() === 'error') {
            <section class="ccp-card" aria-labelledby="error-heading">
              <h2 id="error-heading" class="ccp-card-heading">Check failed</h2>
              <p class="ccp-body failure" role="alert">{{ error() }}</p>
              <ion-button (click)="check()">Try again</ion-button>
            </section>
          }

          @if (diagnostics(); as report) {
            <section class="ccp-card" aria-labelledby="summary-heading">
              <h2 id="summary-heading" class="ccp-card-heading">Summary</h2>
              <p class="ccp-body" [class.failure]="!healthy()" role="status">
                {{
                  healthy()
                    ? 'The local database is healthy.'
                    : 'The local database needs attention.'
                }}
              </p>
              <dl class="fact-list">
                <div class="fact">
                  <dt class="ccp-small ccp-muted">Backend</dt>
                  <dd class="ccp-body">{{ backendLabel(report.backend) }}</dd>
                </div>
                <div class="fact">
                  <dt class="ccp-small ccp-muted">Schema version</dt>
                  <dd class="ccp-body">
                    {{ report.actualSchemaVersion }} of
                    {{ report.expectedSchemaVersion }}
                  </dd>
                </div>
                <div class="fact">
                  <dt class="ccp-small ccp-muted">Migrations</dt>
                  <dd class="ccp-body">{{ migrationsLabel(report) }}</dd>
                </div>
              </dl>
            </section>

            <section class="ccp-card" aria-labelledby="tables-heading">
              <h2 id="tables-heading" class="ccp-card-heading">Required tables</h2>
              <ul class="check-list">
                @for (table of report.tables; track table.name) {
                  <li class="check-row">
                    <span class="ccp-body">{{ table.name }}</span>
                    <span class="status" [class.failure]="!table.present">
                      {{ table.present ? 'Present' : 'Missing' }}
                    </span>
                  </li>
                }
              </ul>
            </section>

            <section class="ccp-card" aria-labelledby="migrations-heading">
              <h2 id="migrations-heading" class="ccp-card-heading">Migrations</h2>
              <ul class="check-list">
                @for (migration of report.migrations; track migration.version) {
                  <li class="check-row">
                    <span class="ccp-body">Version {{ migration.version }}</span>
                    <span class="status" [class.failure]="!migration.applied">
                      {{ migration.applied ? 'Ran' : 'Not run' }}
                    </span>
                  </li>
                }
              </ul>
            </section>
          }
        </div>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .fact-list,
      .check-list {
        display: grid;
        gap: var(--ccp-space-md);
        list-style: none;
        margin: var(--ccp-space-lg) 0 0;
        padding: 0;
      }

      .fact {
        display: flex;
        flex-direction: column;
        gap: var(--ccp-space-xs);
      }

      .fact dt,
      .fact dd {
        margin: 0;
      }

      .check-row {
        align-items: center;
        border-top: 1px solid rgb(var(--ccp-border));
        display: flex;
        gap: var(--ccp-space-sm);
        justify-content: space-between;
        padding-top: var(--ccp-space-sm);
      }

      .check-row:first-child {
        border-top: 0;
        padding-top: 0;
      }

      .status {
        font-size: 0.875rem;
        font-weight: 600;
      }

      .failure {
        color: rgb(var(--ccp-danger));
      }
    `,
  ],
})
export class StorageDiagnosticsPage implements OnInit {
  private readonly repository = inject(STUDY_REPOSITORY);
  private readonly nativeStorage = inject(IS_NATIVE_STORAGE);

  protected readonly state = signal<LoadState>('loading');
  protected readonly diagnostics = signal<StorageDiagnostics | null>(null);
  protected readonly error = signal('');
  protected readonly healthy = computed(() => {
    const report = this.diagnostics();
    return (
      report !== null &&
      report.actualSchemaVersion === report.expectedSchemaVersion &&
      report.tables.every((table) => table.present) &&
      report.migrations.every((migration) => migration.applied)
    );
  });

  ngOnInit(): void {
    if (!this.nativeStorage) {
      this.state.set('unavailable');
      return;
    }
    void this.check();
  }

  protected async check(): Promise<void> {
    this.state.set('loading');
    this.diagnostics.set(null);
    this.error.set('');
    try {
      this.diagnostics.set(await this.repository.diagnose());
      this.state.set('ready');
    } catch (cause) {
      this.error.set(describeStorageError(cause));
      this.state.set('error');
    }
  }

  protected backendLabel(backend: StorageDiagnostics['backend']): string {
    return backend === 'sqlite' ? 'SQLite' : 'IndexedDB';
  }

  protected migrationsLabel(report: StorageDiagnostics): string {
    const applied = report.migrations.filter((migration) => migration.applied).length;
    return `${applied} of ${report.migrations.length} ran`;
  }
}
