import { Component, inject } from '@angular/core';

import { APP_VERSION } from '../../../core/app-info';
import { listCerts } from '../../../core/content/cert-registry';
import { contentVersionFor } from '../../../core/content/content-versions';
import { STUDY_REPOSITORY } from '../../../core/storage/repository-provider';

interface ContentVersionRow {
  readonly code: string;
  readonly version: string;
}

/**
 * App information (CONT-36, CONT-37).
 *
 * The app version and the database schema version are build constants, read
 * live from the repository for the schema. Content freshness is tracked per
 * cert, so it is listed per cert; a cert with no verified bank says so instead
 * of inventing a date (CONT-30, content-versions.ts).
 */
@Component({
  selector: 'app-app-info-section',
  template: `
    <section class="ccp-card app-info-section" aria-labelledby="app-info-heading">
      <h2 id="app-info-heading" class="ccp-card-heading">App information</h2>
      <dl class="fact-list">
        <div class="fact">
          <dt class="ccp-small ccp-muted">App version</dt>
          <dd class="ccp-body">{{ appVersion }}</dd>
        </div>
        <div class="fact">
          <dt class="ccp-small ccp-muted">Database schema version</dt>
          <dd class="ccp-body">{{ schemaVersion }}</dd>
        </div>
        <div class="fact">
          <dt class="ccp-small ccp-muted">Content versions</dt>
          <dd class="ccp-body">
            <ul class="content-versions">
              @for (row of contentVersions; track row.code) {
                <li>{{ row.code }}: {{ row.version }}</li>
              }
            </ul>
          </dd>
        </div>
      </dl>
    </section>
  `,
  styles: [
    `
      .fact-list {
        display: grid;
        gap: var(--ccp-space-md);
        margin: var(--ccp-space-lg) 0 0;
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

      .content-versions {
        list-style: none;
        margin: 0;
        padding: 0;
      }
    `,
  ],
})
export class AppInfoSectionComponent {
  private readonly repository = inject(STUDY_REPOSITORY);

  /**
   * Read through a getter, not a field initializer.
   *
   * A plain field initialized from an imported constant was observed reading
   * undefined inside the merged unit-test bundle (the same bundler quirk the
   * mock exam runner documents for MAX_MULTI_ANSWER). The getter keeps the
   * value tied to the module namespace at read time.
   */
  protected get appVersion(): string {
    return APP_VERSION;
  }

  protected readonly schemaVersion = this.repository.schemaVersion;
  protected readonly contentVersions: readonly ContentVersionRow[] = listCerts().map(
    (cert) => ({
      code: cert.shortName,
      version: contentVersionFor(cert.code) ?? 'Not yet published',
    }),
  );
}
