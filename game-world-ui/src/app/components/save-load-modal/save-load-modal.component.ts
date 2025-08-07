import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SavedWorldData } from '../../models/game-world.interface';

/**
 * 세계관 저장/불러오기 모달 컴포넌트
 * 저장된 세계관 목록 표시 및 새로운 저장, 불러오기 기능 제공
 */
@Component({
  selector: 'app-save-load-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './save-load-modal.component.html',
  styleUrls: ['./save-load-modal.component.scss']
})
export class SaveLoadModalComponent {
  @Input() mode: 'save' | 'load' = 'save';
  @Input() savedWorlds: SavedWorldData[] = [];
  @Input() isLoading = false;

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<{name: string, description?: string}>();
  @Output() load = new EventEmitter<string>();
  @Output() delete = new EventEmitter<string>();

  // 저장 폼 데이터
  saveName = '';
  saveDescription = '';
  selectedWorldId = '';

  /**
   * 모달 닫기
   */
  onClose(): void {
    console.log('🔍 [Modal] 모달 닫기 요청');
    this.close.emit();
    this.resetForm();
  }

  /**
   * 저장하기
   */
  onSave(): void {
    console.log('🔍 [Modal] 저장하기 요청:', {
      name: this.saveName,
      description: this.saveDescription
    });
    
    if (this.saveName.trim()) {
      const saveData = {
        name: this.saveName.trim(),
        description: this.saveDescription.trim() || undefined
      };
      
      console.log('📤 [Modal] save 이벤트 발생:', saveData);
      this.save.emit(saveData);
      this.resetForm();
    } else {
      console.log('❌ [Modal] 저장 이름이 비어있음');
    }
  }

  /**
   * 불러오기
   */
  onLoad(worldId?: string): void {
    const targetId = worldId || this.selectedWorldId;
    console.log('🔍 [Modal] 불러오기 요청. ID:', targetId);
    
    if (targetId) {
      console.log('📤 [Modal] load 이벤트 발생:', targetId);
      this.load.emit(targetId);
      this.onClose();
    } else {
      console.log('❌ [Modal] 선택된 세계관 ID가 없음');
    }
  }

  /**
   * 삭제하기
   */
  onDelete(worldId: string): void {
    console.log('🔍 [Modal] 삭제 요청. ID:', worldId);
    
    if (confirm('정말로 이 세계관을 삭제하시겠습니까?')) {
      console.log('📤 [Modal] delete 이벤트 발생:', worldId);
      this.delete.emit(worldId);
    } else {
      console.log('❌ [Modal] 삭제 취소됨');
    }
  }

  /**
   * 세계관 선택
   */
  selectWorld(worldId: string): void {
    console.log('🔍 [Modal] 세계관 선택:', worldId);
    this.selectedWorldId = worldId;
  }

  /**
   * 폼 초기화
   */
  private resetForm(): void {
    this.saveName = '';
    this.saveDescription = '';
    this.selectedWorldId = '';
  }

  /**
   * 날짜 포맷팅
   */
  formatDate(date: Date): string {
    return new Date(date).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
} 