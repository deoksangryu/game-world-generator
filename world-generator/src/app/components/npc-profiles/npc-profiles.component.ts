import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NPCProfile } from '../../models';

@Component({
  selector: 'app-npc-profiles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './npc-profiles.component.html',
  styleUrls: ['./npc-profiles.component.scss']
})
export class NPCProfilesComponent {
  @Input() npcProfiles: NPCProfile[] = [];
  @Output() npcSelected = new EventEmitter<NPCProfile>();

  selectedRole: string = '전체';
  searchTerm = '';

  get roles(): string[] {
    return ['전체', ...Array.from(new Set(this.npcProfiles.map(n => n.role || '기타')))] as string[];
  }

  get filtered(): NPCProfile[] {
    let list = this.npcProfiles;

    if (this.selectedRole !== '전체') {
      list = list.filter(n => n.role === this.selectedRole);
    }
    if (this.searchTerm.trim()) {
      const t = this.searchTerm.toLowerCase();
      list = list.filter(n => n.name.toLowerCase().includes(t) || (n.personality||'').toLowerCase().includes(t));
    }
    return list;
  }

  select(npc: NPCProfile) {
    this.npcSelected.emit(npc);
  }

  getRoleIcon(role: string): string {
    const m: Record<string,string> = {
      blacksmith:'🔨', mage:'🧙‍♂️', merchant:'🛒', warrior:'⚔️', healer:'🌿', ranger:'🏹', scholar:'📚', default:'🎭'
    };
    return m[role] ?? m['default'];
  }
} 