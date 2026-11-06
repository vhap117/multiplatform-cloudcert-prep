import { Component } from '@angular/core';

/**
 * Inline privacy statement (PRIV-29 to PRIV-34).
 *
 * Always rendered in Settings, so it is reachable offline. The copy makes the
 * four promises plainly: data stays on the device, nothing is uploaded,
 * deleting the app deletes the data with a backup pointer, and there is no
 * cloud backup, sync, or account recovery.
 */
@Component({
  selector: 'app-privacy-section',
  template: `
    <section class="ccp-card privacy-section" aria-labelledby="privacy-heading">
      <h2 id="privacy-heading" class="ccp-card-heading">Privacy</h2>
      <p class="ccp-body">
        CloudCertPrep is private by default. All of your study data stays on
        this device, and nothing is uploaded. There is no account.
      </p>
      <ul class="promise-list">
        <li class="ccp-body">
          Your answers, scores, and history never leave this device.
        </li>
        <li class="ccp-body">
          Deleting the app deletes your study data. Export a backup first if you
          want to keep your history across reinstalls.
        </li>
        <li class="ccp-body">
          There are no cookies, no tracking, and no consent banner.
        </li>
        <li class="ccp-body">
          There is no cloud backup, no sync, and no account recovery.
        </li>
        <li class="ccp-body">
          Every statistic is computed on this device from your own history,
          never from other users.
        </li>
      </ul>
    </section>
  `,
  styles: [
    `
      .promise-list {
        display: grid;
        gap: var(--ccp-space-sm);
        margin: var(--ccp-space-md) 0 0;
        padding-left: var(--ccp-space-lg);
      }
    `,
  ],
})
export class PrivacySectionComponent {}
