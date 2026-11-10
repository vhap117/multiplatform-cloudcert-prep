import { Component, inject } from '@angular/core';
import { IonApp, IonButton, IonRouterOutlet } from '@ionic/angular';

import { ScreenAnnouncerService } from './core/a11y/screen-announcer.service';
import { StorageStartupService } from './core/storage/storage-startup.service';

@Component({
  selector: 'app-root',
  imports: [IonApp, IonButton, IonRouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly announcer = inject(ScreenAnnouncerService);
  protected readonly startup = inject(StorageStartupService);

  protected retry(): void {
    void this.startup.start();
  }
}
