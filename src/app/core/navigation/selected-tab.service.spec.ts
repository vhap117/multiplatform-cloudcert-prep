import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SETTINGS_KEYS, readSetting } from '../settings/local-settings';

import { SelectedTabService } from './selected-tab.service';

let events: Subject<unknown>;

function create(): SelectedTabService {
  TestBed.configureTestingModule({
    providers: [{ provide: Router, useValue: { events } }],
  });
  return TestBed.inject(SelectedTabService);
}

beforeEach(() => {
  localStorage.clear();
  events = new Subject<unknown>();
});

afterEach(() => {
  localStorage.clear();
  TestBed.resetTestingModule();
});

describe('SelectedTabService (CERT-14, CERT-32)', () => {
  it('defaults to home when nothing is stored', () => {
    expect(create().storedTab()).toBe('home');
  });

  it('records the last tab visited', () => {
    const service = create();

    events.next(new NavigationEnd(1, '/tabs/practice', '/tabs/practice'));

    expect(readSetting(SETTINGS_KEYS.lastTab)).toBe('practice');
    expect(service.storedTab()).toBe('practice');
  });

  it('ignores pushed screens and unknown tabs', () => {
    create();

    events.next(new NavigationEnd(1, '/mock-exam/clf-c02/run', '/mock-exam/clf-c02/run'));
    events.next(new NavigationEnd(2, '/tabs/nope', '/tabs/nope'));

    expect(readSetting(SETTINGS_KEYS.lastTab)).toBeNull();
  });

  it('falls back to home for an invalid stored value', () => {
    localStorage.setItem(SETTINGS_KEYS.lastTab, 'deleted-tab');

    expect(create().storedTab()).toBe('home');
  });
});
