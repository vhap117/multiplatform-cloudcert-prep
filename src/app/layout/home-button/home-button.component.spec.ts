import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HomeButtonComponent } from './home-button.component';

describe('HomeButtonComponent', () => {
  let router: { navigateByUrl: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    router = { navigateByUrl: vi.fn().mockResolvedValue(true) };
    await TestBed.configureTestingModule({
      imports: [HomeButtonComponent],
      providers: [
        provideIonicAngular(),
        { provide: Router, useValue: router },
      ],
    }).compileComponents();
  });

  it('renders a Home action that navigates to the dashboard', () => {
    const fixture = TestBed.createComponent(HomeButtonComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const button = el.querySelector('ion-button') as HTMLElement;

    expect(el.getAttribute('slot')).toBe('end');
    expect(button.textContent?.trim()).toBe('Home');
    expect(button.getAttribute('aria-label')).toBe('Go to the homepage');

    button.click();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/tabs/home');
  });
});
