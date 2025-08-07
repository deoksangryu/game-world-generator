import { Component, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

// 세계관 생성 옵션 인터페이스
export interface WorldGenerationOptions {
  input: string;
  theme: string;
  setting: string;
  additionalInfo: string;
  useWebSearch: boolean;
  includeNPCs: boolean;
  npcCount: number;
  generationType: 'simple' | 'complex';
}

@Component({
  selector: 'app-world-input',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    MatSlideToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatTooltipModule
  ],
  templateUrl: './world-input.html',
  styleUrls: ['./world-input.scss']
})
export class WorldInputComponent {
  @Input() isLoading = false;
  @Input() serverConnected = false;
  @Output() worldCreated = new EventEmitter<WorldGenerationOptions>();
  @Output() fullWorldCreated = new EventEmitter<WorldGenerationOptions>();

  // 폼 데이터
  worldInput = '';
  theme = '';
  setting = '';
  additionalInfo = '';
  useWebSearch = true; // 기본값: 웹 검색 활성화
  includeNPCs = true;
  npcCount = 3; // 기본값 3명 (UI에는 표시하지 않음)
  
  placeholder = '게임 세계관의 기본 컨셉을 설명해주세요... (예: "플레이어가 자원과 정치를 관리하는 SF 콜로니")';

  // 테마 예시 목록
  themeExamples = [
    'fantasy', 'cyberpunk', 'steampunk', 'space-opera', 'post-apocalyptic', 
    'medieval', 'modern', 'horror', 'superhero', 'western'
  ];

  // 설정 예시 목록
  settingExamples = [
    '미래 도시', '중세 왕국', '우주 정거장', '마법 학교', '좀비 아포칼립스', 
    '해상 요새', '지하 도시', '떠다니는 섬', '타임 루프', '가상 현실'
  ];

  onSubmit() {
    if (this.isFormValid() && !this.isLoading) {
      const options: WorldGenerationOptions = {
        input: this.worldInput.trim(),
        theme: this.theme.trim(),
        setting: this.setting.trim(),
        additionalInfo: this.additionalInfo.trim(),
        useWebSearch: this.useWebSearch,
        includeNPCs: this.includeNPCs,
        npcCount: this.npcCount,
        generationType: 'simple'
      };
      this.worldCreated.emit(options);
    }
  }

  onFullSubmit() {
    if (this.isFormValid() && !this.isLoading && this.serverConnected) {
      console.log('onFullSubmit', {
        input: this.worldInput.trim(),
        theme: this.theme.trim(), 
        setting: this.setting.trim(),
        additionalInfo: this.additionalInfo.trim(),
        useWebSearch: this.useWebSearch
      });
      const options: WorldGenerationOptions = {
        input: this.worldInput.trim(),
        theme: this.theme.trim(),
        setting: this.setting.trim(),
        additionalInfo: this.additionalInfo.trim(),
        useWebSearch: this.useWebSearch,
        includeNPCs: this.includeNPCs,
        npcCount: this.npcCount,
        generationType: 'complex'
      };
      this.fullWorldCreated.emit(options);
    }
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && event.ctrlKey) {
      this.onSubmit();
    } else if (event.key === 'Enter' && event.shiftKey && this.serverConnected) {
      this.onFullSubmit();
    }
  }

  /**
   * 폼 유효성 검사
   */
  isFormValid(): boolean {
    return this.worldInput.trim().length > 0 && 
           this.theme.trim().length > 0 && 
           this.setting.trim().length > 0;
  }

  /**
   * 예시 아이디어 설정
   */
  setExampleIdea(example: 'cyberpunk' | 'space' | 'nature') {
    switch (example) {
      case 'cyberpunk':
        this.worldInput = '해커들이 가상 네트워크를 통해 현실을 조작하는 미래 사회';
        this.theme = 'cyberpunk';
        this.setting = '네온 조명이 빛나는 메가시티';
        this.additionalInfo = '기업 간 정보 전쟁, AI 반란, 가상현실 중독';
        break;
      case 'space':
        this.worldInput = '서로 다른 외계 종족들이 생존을 위해 협력해야 하는 우주 정거장';
        this.theme = 'space-opera';
        this.setting = '은하계 변두리의 거대한 우주 정거장';
        this.additionalInfo = '자원 부족, 종족 간 갈등, 우주 해적';
        break;
      case 'nature':
        this.worldInput = '자연이 진화하여 문명을 되찾은 포스트 아포칼립스 세계';
        this.theme = 'post-apocalyptic';
        this.setting = '식물과 동물이 지배하는 폐허가 된 도시';
        this.additionalInfo = '변이된 생물체, 자연과의 공존, 과거 기술 발굴';
        break;
    }
  }
}
