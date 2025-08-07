import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorldService } from '../../services/world.service';
import { NPCProfile } from '../../models';
import { NPCProfilesComponent } from '../../components/npc-profiles/npc-profiles.component';

@Component({
  selector: 'app-npcs',
  standalone: true,
  imports: [CommonModule, NPCProfilesComponent],
  templateUrl: './npcs.component.html',
  styleUrls: ['./npcs.component.scss']
})
export class NpcsComponent {
  npcs: NPCProfile[] = [];

  constructor(private worldService: WorldService) {
    worldService.npcProfiles$.subscribe(n => (this.npcs = n));
  }
} 