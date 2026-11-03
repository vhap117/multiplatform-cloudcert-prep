/**
 * Test environment shims.
 *
 * The Vitest runner exposes `window` and `document` through jsdom but leaves
 * `localStorage` and `sessionStorage` undefined, so specs that persist a
 * preference cannot run. jsdom itself provides both, so this only fills the gap
 * the runner leaves, and never shadows a real implementation.
 */
class MemoryStorage {
  private readonly entries = new Map<string, string>();

  get length(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  getItem(key: string): string | null {
    return this.entries.has(key) ? (this.entries.get(key) as string) : null;
  }

  key(index: number): string | null {
    return [...this.entries.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }
}

function install(name: 'localStorage' | 'sessionStorage'): void {
  if (typeof globalThis[name] !== 'undefined') {
    return;
  }
  Object.defineProperty(globalThis, name, {
    value: new MemoryStorage(),
    writable: true,
    configurable: true,
  });
}

install('localStorage');
install('sessionStorage');
