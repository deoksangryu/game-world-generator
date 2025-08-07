import { Routes } from '@angular/router';
import { WorldgenComponent } from './features/worldgen/worldgen.component';
import { HistoryComponent } from './features/history/history.component';
import { NpcsComponent } from './features/npcs/npcs.component';
import { ExportComponent } from './features/export/export.component';
import { SettingsComponent } from './features/settings/settings.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'worldgen' },
  { path: 'worldgen', component: WorldgenComponent },
  { path: 'history', component: HistoryComponent },
  { path: 'npcs', component: NpcsComponent },
  { path: 'export', component: ExportComponent },
  { path: 'settings', component: SettingsComponent },
];
