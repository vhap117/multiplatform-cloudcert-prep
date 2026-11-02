import { Component } from '@angular/core';
import {
  IonLabel,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from '@ionic/angular';
import { Dumbbell, History, House, LucideAngularModule, Settings } from 'lucide-angular';

/**
 * The four-tab shell (CERT-9 to CERT-12).
 *
 * Icons are decorative here: the label carries the meaning, so the icon is
 * hidden from assistive technology (ACC-2).
 */
@Component({
  selector: 'app-tabs',
  imports: [IonTabs, IonTabBar, IonTabButton, IonLabel, LucideAngularModule],
  templateUrl: './tabs.page.html',
  styleUrl: './tabs.page.css',
})
export class TabsPage {
  protected readonly House = House;
  protected readonly Dumbbell = Dumbbell;
  protected readonly History = History;
  protected readonly Settings = Settings;
}
