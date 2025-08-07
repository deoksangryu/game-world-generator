import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Magic, MagicEffect } from '../../models/game-world.interface';

@Component({
  selector: 'app-magic-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './magic-viewer.html',
  styleUrls: ['./magic-viewer.scss']
})
export class MagicViewerComponent {
  @Input() magic!: Magic;

  getMagicTypeText(type: string): string {
    const types = {
      spell: '주문',
      enchantment: '인챈트',
      ritual: '의식',
      potion: '물약'
    };
    return types[type as keyof typeof types] || type;
  }

  getMagicTypeColor(type: string): string {
    const colors = {
      spell: '#8b5cf6',
      enchantment: '#06b6d4',
      ritual: '#dc2626',
      potion: '#16a34a'
    };
    return colors[type as keyof typeof colors] || '#6b7280';
  }

  getSchoolColor(school: string): string {
    const colors = {
      '화염': '#ef4444',
      '얼음': '#3b82f6',
      '번개': '#eab308',
      '치유': '#10b981',
      '어둠': '#6b21a8',
      '빛': '#f59e0b',
      '자연': '#16a34a',
      '정신': '#ec4899',
      '변화': '#8b5cf6',
      '소환': '#06b6d4'
    };
    return colors[school as keyof typeof colors] || '#6b7280';
  }

  getLevelColor(level: number): string {
    if (level <= 3) return '#10b981'; // 초급 - 녹색
    if (level <= 6) return '#3b82f6'; // 중급 - 파랑
    if (level <= 8) return '#f59e0b'; // 고급 - 주황
    return '#ef4444'; // 마스터 - 빨강
  }

  getLevelText(level: number): string {
    if (level <= 3) return '초급';
    if (level <= 6) return '중급';
    if (level <= 8) return '고급';
    return '마스터';
  }

  getEffectTypeIcon(type: string): string {
    const icons = {
      damage: '⚔️',
      heal: '💚',
      buff: '⬆️',
      debuff: '⬇️',
      utility: '🔧'
    };
    return icons[type as keyof typeof icons] || '✨';
  }

  getEffectTypeText(type: string): string {
    const types = {
      damage: '피해',
      heal: '치유',
      buff: '강화',
      debuff: '약화',
      utility: '유틸리티'
    };
    return types[type as keyof typeof types] || type;
  }

  getEffectTypeColor(type: string): string {
    const colors = {
      damage: '#ef4444',
      heal: '#10b981',
      buff: '#3b82f6',
      debuff: '#f59e0b',
      utility: '#8b5cf6'
    };
    return colors[type as keyof typeof colors] || '#6b7280';
  }

  formatDuration(duration?: string): string {
    if (!duration) return '즉시';
    return duration;
  }

  getManaCostColor(cost: number): string {
    if (cost <= 10) return '#10b981';
    if (cost <= 25) return '#3b82f6';
    if (cost <= 50) return '#f59e0b';
    return '#ef4444';
  }
} 