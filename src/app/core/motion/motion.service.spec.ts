import { TestBed } from '@angular/core/testing';
import { MotionService } from './motion.service';

function stubSystemMotion(prefersReduced: boolean): void {
  Object.defineProperty(globalThis, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: query.includes('reduced-motion') ? prefersReduced : false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

describe('MotionService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  it('defaults to following the system preference', () => {
    stubSystemMotion(false);
    const service = TestBed.inject(MotionService);
    expect(service.preference()).toBe('system');
  });

  it('reports no reduction when the system has no preference', () => {
    stubSystemMotion(false);
    const service = TestBed.inject(MotionService);
    expect(service.reduced()).toBe(false);
  });

  it('reports reduction when the system asks for it', () => {
    stubSystemMotion(true);
    const service = TestBed.inject(MotionService);
    expect(service.reduced()).toBe(true);
  });

  it('lets an explicit override force reduction on', () => {
    stubSystemMotion(false);
    const service = TestBed.inject(MotionService);
    service.setPreference('reduce');
    expect(service.reduced()).toBe(true);
    expect(document.documentElement.classList).toContain('reduce-motion');
  });

  it('lets an explicit override force reduction off against the system', () => {
    stubSystemMotion(true);
    const service = TestBed.inject(MotionService);
    service.setPreference('full');
    expect(service.reduced()).toBe(false);
    expect(document.documentElement.classList).not.toContain('reduce-motion');
  });

  it('persists the explicit choice', () => {
    stubSystemMotion(false);
    const service = TestBed.inject(MotionService);
    service.setPreference('reduce');
    expect(localStorage.getItem('ccp.motion')).toBe('reduce');
  });
});
