import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Quest, QuestObjective, QuestReward } from '../../models/game-world.interface';

@Component({
  selector: 'app-quest-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quest-viewer.html',
  styleUrls: ['./quest-viewer.scss']
})
export class QuestViewerComponent {
  @Input() quest!: Quest;

  getQuestTypeText(type: string): string {
    const types = {
      main: '메인 퀘스트',
      side: '서브 퀘스트',
      daily: '일일 퀘스트',
      epic: '에픽 퀘스트'
    };
    return types[type as keyof typeof types] || type;
  }

  getQuestTypeColor(type: string): string {
    const colors = {
      main: '#f59e0b',
      side: '#10b981',
      daily: '#3b82f6',
      epic: '#8b5cf6'
    };
    return colors[type as keyof typeof colors] || '#9ca3af';
  }

  getDifficultyText(difficulty: string): string {
    const difficulties = {
      easy: '쉬움',
      normal: '보통',
      hard: '어려움',
      extreme: '극한'
    };
    return difficulties[difficulty as keyof typeof difficulties] || difficulty;
  }

  getDifficultyColor(difficulty: string): string {
    const colors = {
      easy: '#10b981',
      normal: '#3b82f6',
      hard: '#f59e0b',
      extreme: '#ef4444'
    };
    return colors[difficulty as keyof typeof colors] || '#9ca3af';
  }

  getObjectiveTypeIcon(type: string): string {
    const icons = {
      kill: '⚔️',
      collect: '📦',
      deliver: '🚚',
      interact: '💬',
      explore: '🗺️'
    };
    return icons[type as keyof typeof icons] || '📋';
  }

  getRewardTypeIcon(type: string): string {
    const icons = {
      experience: '⭐',
      gold: '💰',
      item: '🎁',
      skill: '📚'
    };
    return icons[type as keyof typeof icons] || '🏆';
  }

  getRewardTypeText(type: string): string {
    const types = {
      experience: '경험치',
      gold: '골드',
      item: '아이템',
      skill: '스킬'
    };
    return types[type as keyof typeof types] || type;
  }

  formatTime(minutes: number): string {
    if (minutes < 60) {
      return `${minutes}분`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours}시간`;
    }
    return `${hours}시간 ${remainingMinutes}분`;
  }

  getCompletedObjectivesCount(): number {
    return this.quest.objectives.filter(obj => obj.completed).length;
  }

  getProgressPercentage(): number {
    if (this.quest.objectives.length === 0) return 0;
    return (this.getCompletedObjectivesCount() / this.quest.objectives.length) * 100;
  }
} 