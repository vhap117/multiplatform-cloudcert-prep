import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';

import { ScreenAnnouncerService } from './screen-announcer.service';

describe('ScreenAnnouncerService (CERT-34)', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('announces the new screen title after every navigation', () => {
    const events = new Subject<unknown>();
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { events } },
        { provide: Title, useValue: { getTitle: () => 'Mock exam in progress' } },
      ],
    });
    const service = TestBed.inject(ScreenAnnouncerService);

    events.next(new NavigationEnd(1, '/mock-exam/clf-c02/run', '/mock-exam/clf-c02/run'));

    expect(service.announcement()).toBe('Mock exam in progress');
  });
});
