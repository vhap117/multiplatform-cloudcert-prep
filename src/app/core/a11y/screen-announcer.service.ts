import { Injectable, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/**
 * Announces screen changes to assistive technology (CERT-34, ACC-18).
 *
 * The route `title` already updates `document.title`. This service mirrors the
 * new title into a polite live region after every navigation so a screen
 * reader speaks the screen change. The app shell renders the region.
 */
@Injectable({ providedIn: 'root' })
export class ScreenAnnouncerService {
  private readonly router = inject(Router);
  private readonly title = inject(Title);

  /** Latest screen title, rendered inside the shell live region. */
  readonly announcement = signal('');

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        const title = this.title.getTitle();
        if (title) {
          this.announcement.set(title);
        }
      });
  }
}
