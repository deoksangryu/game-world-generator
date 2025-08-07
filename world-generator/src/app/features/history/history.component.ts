import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorldService } from '../../services/world.service';
import { HistoryEra } from '../../models';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.scss']
})
export class HistoryComponent {
  eras: HistoryEra[] = [];

  constructor(private worldService: WorldService) {
    worldService.history$.subscribe(e => (this.eras = e));
  }

  getTypeIcon(type: string): string {
    const typeIcons: Record<string, string> = {
      'creation': '🌟',
      'discovery': '🔍',
      'expansion': '🗺️',
      'conflict': '⚔️',
      'war': '⚔️',
      'peace': '🕊️',
      'alliance': '🤝',
      'magic_discovery': '✨',
      'dark_age': '🌑',
      'renaissance': '🌅',
      'major_event': '📜',
      'disaster': '🌋',
      'rise': '📈',
      'fall': '📉',
      'founding': '🏗️',
      'destruction': '💥'
    };
    return typeIcons[type] || '📜';
  }

  hasRelatedContent(era: HistoryEra): boolean {
    return (era.related.npcs && era.related.npcs.length > 0) ||
           (era.related.monsters && era.related.monsters.length > 0);
  }

  loadSampleHistory(): void {
    // 샘플 역사 데이터 로드
    const sampleHistory: HistoryEra[] = [
      {
        id: 'sample-1',
        type: 'creation',
        title: '세계의 창조',
        date: '태초',
        description: '고대의 신들이 무에서 세계를 창조했다. 대지와 하늘, 바다가 형성되었다.',
        tags: ['창조', '신화', '시작'],
        related: { npcs: [], monsters: [] },
        see_also: []
      },
      {
        id: 'sample-2',
        type: 'discovery',
        title: '마법의 발견',
        date: '제1시대 500년',
        description: '최초의 마법사가 원소를 조작하는 방법을 발견했다.',
        tags: ['마법', '발견', '원소'],
        related: { npcs: ['first-mage'], monsters: [] },
        see_also: []
      },
      {
        id: 'sample-3',
        type: 'expansion',
        title: '대탐험 시대',
        date: '제2시대 100-300년',
        description: '용감한 모험가들이 미지의 대륙을 탐험하기 시작했다.',
        tags: ['탐험', '발견', '모험'],
        related: { npcs: ['explorer-captain'], monsters: ['sea-dragons'] },
        see_also: []
      }
    ];
    
    this.eras = sampleHistory;
  }
} 