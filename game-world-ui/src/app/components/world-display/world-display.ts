import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { GameWorld } from '../../models/game-world.interface';

@Component({
  selector: 'app-world-display',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatExpansionModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatChipsModule
  ],
  templateUrl: './world-display.html',
  styleUrls: ['./world-display.scss']
})
export class WorldDisplayComponent {
  @Input() gameWorld: GameWorld | null = null;
  
  isExpanded = false;
  showRawText = false; // 원본/포맷된 텍스트 토글
  searchQuery = '';
  highlightedText = '';

  constructor(private sanitizer: DomSanitizer) {}

  toggleExpanded() {
    this.isExpanded = !this.isExpanded;
  }

  toggleRawText() {
    this.showRawText = !this.showRawText;
  }

  getShortDescription(): string {
    if (!this.gameWorld?.expandedWorldDescription) return '';
    const maxLength = 300;
    const description = this.gameWorld.expandedWorldDescription;
    
    if (description.length <= maxLength) return description;
    
    return description.substring(0, maxLength) + '...';
  }

  /**
   * 원본 텍스트를 가독성 좋게 포맷팅 (복잡한 파싱 없이)
   */
  getFormattedDescription(): SafeHtml {
    if (!this.gameWorld?.expandedWorldDescription) return '';
    
    const description = this.isExpanded 
      ? this.gameWorld.expandedWorldDescription 
      : this.getShortDescription();

    if (this.showRawText) {
      // 원본 텍스트 그대로 표시 (줄바꿈만 처리)
      const rawHtml = description
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
      
      return this.sanitizer.bypassSecurityTrustHtml(`<div class="raw-text">${rawHtml}</div>`);
    }

    // 기본 포맷팅 (간단한 마크다운 스타일)
    let html = description
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      
      // 마크다운 헤딩
      .replace(/^### (.*$)/gim, '<h3 class="section-h3">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="section-h2">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="section-h1">$1</h1>')
      
      // 먼저 파이프로 구분된 원형 숫자 항목들을 카드 스타일로 처리
      .replace(/^([①②③④⑤⑥⑦⑧⑨⑩⑪⑫])\s*([^|\n]+)\s*\|\s*(.*$)/gim, 
               '<div class="info-card"><h4 class="card-title">$1 $2</h4><p class="card-content">$3</p></div>')
      
      // 그 다음 파이프가 없는 원형 숫자들을 소제목으로 처리
      .replace(/^([①②③④⑤⑥⑦⑧⑨⑩⑪⑫])\s*(.*$)/gim, '<h3 class="circle-heading">$1 $2</h3>')
      
      // 연도 표시를 타임라인 스타일로
      .replace(/^(-?\d{4,5}):\s*(.*$)/gim, 
               '<div class="timeline-entry"><span class="timeline-year">$1</span><span class="timeline-event">$2</span></div>')
      
      // 볼드/이탤릭
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
      
      // 대시 리스트
      .replace(/^\s*-\s+(.*$)/gim, '<li class="bullet-item">$1</li>')
      
      // 빈 줄을 단락 구분으로
      .split('\n\n')
      .map(paragraph => {
        const trimmed = paragraph.trim();
        if (!trimmed) return '';
        
        // 이미 HTML 태그가 있으면 그대로
        if (trimmed.includes('<h') || trimmed.includes('<div') || trimmed.includes('<li')) {
          return trimmed;
        }
        
        // 리스트 아이템들을 ul로 감싸기
        if (trimmed.includes('<li class="bullet-item">')) {
          return `<ul class="bullet-list">${trimmed}</ul>`;
        }
        
        // 일반 텍스트는 p 태그로
        const withBreaks = trimmed.replace(/\n/g, '<br>');
        return `<p class="text-paragraph">${withBreaks}</p>`;
      })
      .filter(p => p)
      .join('\n');

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  /**
   * 텍스트 복사
   */
  copyToClipboard() {
    if (!this.gameWorld?.expandedWorldDescription) return;
    
    navigator.clipboard.writeText(this.gameWorld.expandedWorldDescription).then(() => {
      console.log('✅ 텍스트가 클립보드에 복사되었습니다.');
    }).catch(err => {
      console.error('❌ 복사 실패:', err);
    });
  }

  /**
   * 텍스트 검색 및 하이라이트
   */
  searchText(query: string) {
    this.searchQuery = query;
    if (!query || !this.gameWorld?.expandedWorldDescription) {
      this.highlightedText = '';
      return;
    }

    const text = this.gameWorld.expandedWorldDescription;
    const regex = new RegExp(`(${query})`, 'gi');
    this.highlightedText = text.replace(regex, '<mark>$1</mark>');
  }

  /**
   * 단어 수 계산
   */
  getWordCount(): number {
    if (!this.gameWorld?.expandedWorldDescription) return 0;
    return this.gameWorld.expandedWorldDescription.split(/\s+/).length;
  }

  /**
   * 문자 수 계산
   */
  getCharCount(): number {
    if (!this.gameWorld?.expandedWorldDescription) return 0;
    return this.gameWorld.expandedWorldDescription.length;
  }

  /**
   * 읽기 시간 추정 (분)
   */
  getEstimatedReadTime(): number {
    const wordCount = this.getWordCount();
    return Math.ceil(wordCount / 200); // 평균 읽기 속도 200단어/분
  }

  /**
   * 확장시 추가될 단어 수 계산
   */
  getExpandedWordCount(): number {
    if (!this.gameWorld?.expandedWorldDescription) return 0;
    
    const totalWords = this.getWordCount();
    const shortText = this.getShortDescription();
    const shortWords = shortText ? shortText.split(/\s+/).length : 0;
    
    return Math.max(0, totalWords - shortWords);
  }
}
