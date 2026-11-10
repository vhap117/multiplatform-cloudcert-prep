import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, vi } from 'vitest';

import { App } from './app';
import { routes } from './app.routes';
import { StorageStartupService } from './core/storage/storage-startup.service';
import type { StorageStartupState } from './core/storage/storage-startup.service';

let startup: {
  state: WritableSignal<StorageStartupState>;
  error: WritableSignal<string>;
  start: ReturnType<typeof vi.fn>;
};

function render(): HTMLElement {
  const fixture = TestBed.createComponent(App);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

beforeEach(async () => {
  startup = {
    state: signal<StorageStartupState>('ready'),
    error: signal(''),
    start: vi.fn().mockResolvedValue(undefined),
  };
  await TestBed.configureTestingModule({
    imports: [App],
    providers: [
      provideRouter(routes),
      { provide: StorageStartupService, useValue: startup },
    ],
  }).compileComponents();
});

afterEach(() => {
  TestBed.resetTestingModule();
});

describe('App', () => {
  it('creates the app shell with an Ionic app container', () => {
    const compiled = render();

    expect(compiled.querySelector('ion-app')).not.toBeNull();
    expect(compiled.querySelector('ion-router-outlet')).not.toBeNull();
  });

  it('blocks the router outlet while preparing storage', () => {
    startup.state.set('loading');
    const compiled = render();

    expect(compiled.querySelector('[role="status"]')?.textContent).toContain(
      'Preparing the local database',
    );
    expect(compiled.querySelector('ion-router-outlet')).toBeNull();
  });

  it('shows a retryable startup error instead of the app', () => {
    startup.state.set('error');
    startup.error.set('Could not open the local database');
    const compiled = render();

    expect(compiled.querySelector('h1')?.textContent).toContain(
      'Could not prepare the local database',
    );
    expect(compiled.querySelector('[role="alert"]')?.textContent).toContain(
      'Could not open the local database',
    );
    expect(compiled.querySelector('ion-router-outlet')).toBeNull();

    const retry = [...compiled.querySelectorAll('button, ion-button')].find(
      (candidate) => (candidate.textContent ?? '').trim() === 'Try again',
    ) as HTMLElement;
    retry.click();

    expect(startup.start).toHaveBeenCalledTimes(1);
  });
});
