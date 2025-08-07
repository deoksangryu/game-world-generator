import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { WorldService } from '../../services/world.service';
import { WorldInput, GameWorld } from '../../models';

interface GenreOption {
  value: string;
  icon: string;
  label: string;
}

@Component({
  selector: 'app-worldgen',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './worldgen.component.html',
  styleUrls: ['./worldgen.component.scss']
})
export class WorldgenComponent implements OnDestroy {
  genres: GenreOption[] = [
    { value: 'fantasy', icon: '🧙‍♂️', label: '판타지' },
    { value: 'scifi', icon: '🚀', label: 'SF' },
    { value: 'modern', icon: '🏙️', label: '현대' },
    { value: 'horror', icon: '👻', label: '호러' },
    { value: 'cyberpunk', icon: '🤖', label: '사이버펑크' },
    { value: 'historical', icon: '🏛️', label: '역사' }
  ];

  // Form model
  worldData: WorldInput = {
    gameTitle: '',
    genre: 'fantasy',
    basicSetting: '',
    mainConflict: '',
    uniqueElements: ''
  };

  isGenerating = false;
  errorMessage = '';
  successMessage = '';
  serverConnected = false;

  generatedWorld: GameWorld | null = null;
  
  private subscriptions: Subscription[] = [];

  constructor(public worldService: WorldService) {
    // 구독 설정
    this.subscriptions.push(
      this.worldService.currentWorld$.subscribe(w => (this.generatedWorld = w)),
      this.worldService.loading$.subscribe(loading => (this.isGenerating = loading))
    );
    
    // 서버 상태 확인
    this.checkServerConnection();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  checkServerConnection() {
    this.worldService.checkServerStatus().subscribe({
      next: (status) => {
        this.serverConnected = status.status === 'healthy' || status.status === 'partial';
        if (status.status === 'partial') {
          this.errorMessage = '일부 서비스가 준비되지 않았습니다. 기본 기능만 사용 가능합니다.';
        }
      },
      error: () => {
        this.serverConnected = false;
        this.errorMessage = '서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.';
      }
    });
  }

  selectGenre(g: string) {
    this.worldData.genre = g;
    this.clearMessages();
  }

  generateWorld() {
    if (!this.validateForm()) return;
    
    this.clearMessages();
    
    this.worldService.generateWorld(this.worldData).subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage = `세계관이 성공적으로 생성되었습니다! (${response.generation_time?.toFixed(1)}초)`;
        } else {
          this.errorMessage = response.error || '세계관 생성에 실패했습니다.';
        }
      },
      error: (error) => {
        this.errorMessage = error.message || '세계관 생성 중 오류가 발생했습니다.';
        console.error('World generation error:', error);
      }
    });
  }

  generateFullWorld() {
    if (!this.validateForm()) return;
    
    this.clearMessages();
    
    this.worldService.generateFullWorld(this.worldData, true).subscribe({
      next: (response) => {
        if (response.success) {
          const imageCount = response.npc_images.length;
          this.successMessage = `통합 세계관이 성공적으로 생성되었습니다! NPC 이미지 ${imageCount}개 포함 (${response.generation_time?.toFixed(1)}초)`;
        } else {
          this.errorMessage = response.message || '통합 생성에 실패했습니다.';
        }
      },
      error: (error) => {
        this.errorMessage = error.message || '통합 생성 중 오류가 발생했습니다.';
        console.error('Full generation error:', error);
      }
    });
  }

  loadSample() {
    this.worldService.loadSampleWorld();
    this.successMessage = '샘플 데이터가 로드되었습니다.';
    this.clearError();
  }

  clearData() {
    this.worldService.clearData();
    this.generatedWorld = null;
    this.successMessage = '데이터가 초기화되었습니다.';
    this.clearError();
  }

  private validateForm(): boolean {
    if (!this.worldData.gameTitle.trim()) {
      this.errorMessage = '게임 제목을 입력해주세요.';
      return false;
    }
    if (!this.worldData.basicSetting.trim()) {
      this.errorMessage = '기본 설정을 입력해주세요.';
      return false;
    }
    if (!this.serverConnected) {
      this.errorMessage = '서버에 연결되지 않았습니다.';
      return false;
    }
    return true;
  }

  private clearMessages() {
    this.errorMessage = '';
    this.successMessage = '';
  }

  private clearError() {
    this.errorMessage = '';
  }
} 