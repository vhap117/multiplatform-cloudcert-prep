import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SETTINGS_KEYS, readSetting } from '../settings/local-settings';

import { SelectedCertService } from './selected-cert.service';

describe('SelectedCertService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  function create(): SelectedCertService {
    TestBed.configureTestingModule({});
    return TestBed.inject(SelectedCertService);
  }

  it('defaults to the first active cert when nothing is stored', () => {
    const service = create();

    expect(service.cert()?.code).toBe('aif-c01');
    expect(service.activeCerts().every((cert) => cert.status === 'active')).toBe(true);
  });

  it('honours a stored active cert', () => {
    localStorage.setItem(SETTINGS_KEYS.selectedCert, 'aif-c01');

    const service = create();

    expect(service.cert()?.code).toBe('aif-c01');
    expect(service.code()).toBe('aif-c01');
  });

  it('returns a stored coming-soon cert so its screen can render the refusal', () => {
    localStorage.setItem(SETTINGS_KEYS.selectedCert, 'saa-c03');

    const service = create();

    expect(service.cert()?.code).toBe('saa-c03');
    expect(service.select('saa-c03')).toBe(false);
  });

  it('falls back to the first active cert for an unknown stored code', () => {
    localStorage.setItem(SETTINGS_KEYS.selectedCert, 'zzz-999');

    const service = create();

    expect(service.cert()?.code).toBe('aif-c01');
  });

  it('selects an active cert, updates the signal, and persists it', () => {
    const service = create();

    expect(service.select('clf-c02')).toBe(true);
    expect(service.cert()?.code).toBe('clf-c02');
    expect(readSetting(SETTINGS_KEYS.selectedCert)).toBe('clf-c02');
  });

  it('refuses coming-soon and unknown codes without changing the selection', () => {
    const service = create();

    expect(service.select('saa-c03')).toBe(false);
    expect(service.select('missing')).toBe(false);
    expect(service.cert()?.code).toBe('aif-c01');
  });

  it('keeps the in-memory choice when the store is blocked', () => {
    const service = create();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(service.select('clf-c02')).toBe(true);
    expect(service.cert()?.code).toBe('clf-c02');
  });
});
