import { Injectable, computed, signal } from '@angular/core';

import { SETTINGS_KEYS, readSetting, writeSetting } from '../settings/local-settings';

import { getCert, listCerts, type Certification } from './cert-registry';

/**
 * Owns the selected certification (CERT-14, CERT-19, CERT-21).
 *
 * The choice comes from local settings and falls back to the first active
 * certification when nothing valid is stored. The selection is a signal so
 * every cert-scoped surface can re-scope without a reload. Switching never
 * touches study data (CERT-22): only the preference key is written.
 *
 * A stored code is honoured even when the cert is coming soon, because the
 * start screens render that refusal state on purpose (CERT-2). `select` only
 * accepts active certs, so the switcher can never move the app into a broken
 * flow.
 */
@Injectable({ providedIn: 'root' })
export class SelectedCertService {
  private readonly selectedCode = signal<string | null>(
    readSetting(SETTINGS_KEYS.selectedCert),
  );

  /** Certifications a student may actually start studying. */
  readonly activeCerts = computed<readonly Certification[]>(() =>
    listCerts({ activeOnly: true }),
  );

  /** The resolved cert: the stored one when known, else the first active. */
  readonly cert = computed<Certification | null>(() => {
    const code = this.selectedCode();
    const chosen = code ? getCert(code) : null;
    return chosen ?? this.activeCerts()[0] ?? null;
  });

  /** The resolved code, or null when the registry has no active cert. */
  readonly code = computed<string | null>(() => this.cert()?.code ?? null);

  /**
   * Select an active cert. Returns false when the code is unknown or coming
   * soon. Persists best effort: a blocked store keeps the choice for the
   * session, exactly like the theme preference.
   */
  select(code: string): boolean {
    const cert = getCert(code);
    if (!cert || cert.status !== 'active') {
      return false;
    }
    if (cert.code === this.cert()?.code) {
      return true;
    }
    this.selectedCode.set(cert.code);
    writeSetting(SETTINGS_KEYS.selectedCert, cert.code);
    return true;
  }
}
