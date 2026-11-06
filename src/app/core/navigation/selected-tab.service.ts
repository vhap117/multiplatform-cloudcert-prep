import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

import { SETTINGS_KEYS, readSetting, writeSetting } from '../settings/local-settings';

/** The four top-level tabs, in shell order. */
export const TAB_NAMES = ['home', 'practice', 'history', 'settings'] as const;
export type TabName = (typeof TAB_NAMES)[number];

/** Remembered tab for a cold-start redirect, read without Angular injection. */
export function selectedTabRedirect(): string {
  const stored = storedTabFromSettings();
  return `/tabs/${stored}`;
}

/**
 * Remembers the last tab the student used and restores it on a cold start
 * (CERT-14, CERT-32 "a safe home screen").
 *
 * Only tab URLs are recorded; pushed screens always restart at a tab. Cert
 * persistence lives in `SelectedCertService`.
 */
@Injectable({ providedIn: 'root' })
export class SelectedTabService {
  private readonly router = inject(Router);

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.remember(event.urlAfterRedirects));
  }

  /** The stored tab, or home when nothing valid is stored. */
  storedTab(): TabName {
    return storedTabFromSettings();
  }

  private remember(url: string): void {
    const match = /^\/tabs\/([^/?#]+)/.exec(url);
    const tab = match?.[1];
    if (isTabName(tab)) {
      writeSetting(SETTINGS_KEYS.lastTab, tab);
    }
  }
}

function storedTabFromSettings(): TabName {
  const raw = readSetting(SETTINGS_KEYS.lastTab);
  return isTabName(raw) ? raw : 'home';
}

function isTabName(value: string | null | undefined): value is TabName {
  return !!value && (TAB_NAMES as readonly string[]).includes(value);
}
