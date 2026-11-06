import { Component, computed, inject } from '@angular/core';

import {
  MotionService,
  type MotionPreference,
} from '../../../core/motion/motion.service';
import {
  ThemeService,
  type ThemePreference,
} from '../../../core/theme/theme.service';

interface ThemeOption {
  value: ThemePreference;
  label: string;
}

interface MotionOption {
  value: MotionPreference;
  label: string;
}

/**
 * Appearance controls (ACC-16, ACC-21, IONIC-16).
 *
 * Native radio groups bound to the persisted preferences. Both services own the
 * write-through and the live system watch, so selecting System here follows the
 * device without extra wiring.
 */
@Component({
  selector: 'app-appearance-section',
  template: `
    <section class="ccp-card appearance-section" aria-labelledby="appearance-heading">
      <h2 id="appearance-heading" class="ccp-card-heading">Appearance</h2>

      <fieldset class="setting-group">
        <legend class="group-heading">Theme</legend>
        @for (option of themeOptions; track option.value) {
          <label class="setting-option">
            <input
              type="radio"
              name="theme-preference"
              [value]="option.value"
              [checked]="theme.preference() === option.value"
              (change)="setTheme(option.value)"
            />
            <span class="ccp-body">{{ option.label }}</span>
          </label>
        }
        @if (theme.preference() === 'system') {
          <p class="ccp-small ccp-muted" role="status">
            Following your device: {{ resolvedThemeLabel() }}.
          </p>
        }
      </fieldset>

      <fieldset class="setting-group">
        <legend class="group-heading">Motion</legend>
        @for (option of motionOptions; track option.value) {
          <label class="setting-option">
            <input
              type="radio"
              name="motion-preference"
              [value]="option.value"
              [checked]="motion.preference() === option.value"
              (change)="setMotion(option.value)"
            />
            <span class="ccp-body">{{ option.label }}</span>
          </label>
        }
        @if (motion.preference() === 'system') {
          <p class="ccp-small ccp-muted" role="status">
            Following your device: {{ motion.reduced() ? 'reduced motion' : 'full motion' }}.
          </p>
        }
      </fieldset>
    </section>
  `,
  styles: [
    `
      .setting-group {
        border: 0;
        margin: var(--ccp-space-lg) 0 0;
        padding: 0;
      }

      .group-heading {
        font-size: 1rem;
        margin-bottom: var(--ccp-space-sm);
        padding: 0;
      }

      .setting-option {
        align-items: center;
        display: flex;
        gap: var(--ccp-space-sm);
        margin-bottom: var(--ccp-space-sm);
        min-height: var(--ccp-tap-target);
      }
    `,
  ],
})
export class AppearanceSectionComponent {
  private readonly themeService = inject(ThemeService);
  private readonly motionService = inject(MotionService);

  protected readonly theme = this.themeService;
  protected readonly motion = this.motionService;

  protected readonly themeOptions: readonly ThemeOption[] = [
    { value: 'system', label: 'System default' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];

  protected readonly motionOptions: readonly MotionOption[] = [
    { value: 'system', label: 'System default' },
    { value: 'reduce', label: 'Reduce motion' },
    { value: 'full', label: 'Full motion' },
  ];

  protected readonly resolvedThemeLabel = computed(() =>
    this.theme.resolved() === 'dark' ? 'Dark' : 'Light',
  );

  protected setTheme(preference: ThemePreference): void {
    this.theme.setPreference(preference);
  }

  protected setMotion(preference: MotionPreference): void {
    this.motion.setPreference(preference);
  }
}
