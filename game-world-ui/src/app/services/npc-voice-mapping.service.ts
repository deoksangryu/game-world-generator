import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface NPCVoiceMapping {
  npcId: string;
  npcName: string;
  npcRole: string;
  voiceActorId: string;
  voiceActorName: string;
  gender: string;
  personality: string;
  isCustom: boolean; // 사용자가 직접 설정했는지 여부
}

export interface NPCInfo {
  id: string;
  name: string;
  role: string;
  gender?: string;
  personality?: string;
  description?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NpcVoiceMappingService {
  private mappings: Map<string, NPCVoiceMapping> = new Map();
  private mappingsSubject = new BehaviorSubject<NPCVoiceMapping[]>([]);
  
  // NPC 역할별 기본 보이스 선호도
  private defaultVoicePreferences: Record<string, { gender: string; personality: string[] }> = {
    '대장장이': { gender: 'male', personality: ['신뢰', '묵직', '차분'] },
    '길드 담당관': { gender: 'female', personality: ['스마트한', '신뢰', '차분'] },
    '마법사': { gender: 'female', personality: ['개성적인', '스마트한', '차분'] },
    '상인': { gender: 'male', personality: ['밝음', '희망', '스마트한'] },
    '모험가': { gender: 'male', personality: ['진취', '힘있는', '밝음'] },
    '학자': { gender: 'male', personality: ['스마트한', '차분', '신뢰'] },
    '치료사': { gender: 'female', personality: ['차분', '편안', '신뢰'] },
    '연금술사': { gender: 'female', personality: ['개성적인', '스마트한', '차분'] },
    '도적': { gender: 'male', personality: ['시크한', '개성적인'] },
    '궁수': { gender: 'female', personality: ['차분', '시크한'] },
    '기사': { gender: 'male', personality: ['신뢰', '묵직', '진취'] },
    '농부': { gender: 'male', personality: ['밝음', '희망', '차분'] },
    '마을 이장': { gender: 'male', personality: ['신뢰', '묵직', '차분'] },
    '술집 주인': { gender: 'female', personality: ['밝음', '희망', '스마트한'] },
    '경비병': { gender: 'male', personality: ['신뢰', '묵직', '진취'] }
  };

  constructor() {
    this.loadMappingsFromStorage();
  }

  /**
   * 모든 NPC 보이스 매핑 조회
   */
  getMappings(): Observable<NPCVoiceMapping[]> {
    return this.mappingsSubject.asObservable();
  }

  /**
   * 특정 NPC의 보이스 매핑 조회
   */
  getVoiceMappingForNPC(npcId: string): NPCVoiceMapping | null {
    return this.mappings.get(npcId) || null;
  }

  /**
   * NPC의 보이스 ID만 조회
   */
  getVoiceIdForNPC(npcId: string): string | null {
    const mapping = this.mappings.get(npcId);
    return mapping ? mapping.voiceActorId : null;
  }

  /**
   * NPC 보이스 매핑 설정
   */
  setVoiceMapping(mapping: NPCVoiceMapping): void {
    this.mappings.set(mapping.npcId, mapping);
    this.updateSubject();
    this.saveMappingsToStorage();
  }

  /**
   * 여러 NPC 보이스 매핑 일괄 설정
   */
  setBulkVoiceMappings(mappings: NPCVoiceMapping[]): void {
    mappings.forEach(mapping => {
      this.mappings.set(mapping.npcId, mapping);
    });
    this.updateSubject();
    this.saveMappingsToStorage();
  }

  /**
   * NPC 보이스 매핑 제거
   */
  removeVoiceMapping(npcId: string): void {
    this.mappings.delete(npcId);
    this.updateSubject();
    this.saveMappingsToStorage();
  }

  /**
   * 모든 보이스 매핑 초기화
   */
  clearAllMappings(): void {
    this.mappings.clear();
    this.updateSubject();
    this.saveMappingsToStorage();
  }

  /**
   * NPC 정보를 기반으로 자동 보이스 매핑 생성
   */
  autoAssignVoice(npcInfo: NPCInfo, availableVoiceActors: any[]): NPCVoiceMapping | null {
    // 이미 매핑이 있으면 건너뛰기
    if (this.mappings.has(npcInfo.id)) {
      return this.mappings.get(npcInfo.id)!;
    }

    const preference = this.defaultVoicePreferences[npcInfo.role];
    
    if (!preference || availableVoiceActors.length === 0) {
      return null;
    }

    // 선호 성별 및 성격에 맞는 배우 찾기
    const preferredActors = availableVoiceActors.filter(actor => {
      if (actor.gender !== preference.gender) return false;
      
      // 성격이 일치하는지 확인
      const actorPersonality = actor.name.toLowerCase();
      return preference.personality.some(pref => 
        actorPersonality.includes(pref.toLowerCase())
      );
    });

    // 선호 배우가 없으면 성별만 맞는 배우 찾기
    const fallbackActors = preferredActors.length > 0 
      ? preferredActors 
      : availableVoiceActors.filter(actor => actor.gender === preference.gender);

    if (fallbackActors.length === 0) {
      return null;
    }

    // 랜덤 선택 (다양성을 위해)
    const selectedActor = fallbackActors[Math.floor(Math.random() * fallbackActors.length)];
    
    const mapping: NPCVoiceMapping = {
      npcId: npcInfo.id,
      npcName: npcInfo.name,
      npcRole: npcInfo.role,
      voiceActorId: selectedActor.id,
      voiceActorName: selectedActor.name,
      gender: selectedActor.gender,
      personality: this.extractPersonality(selectedActor.name),
      isCustom: false
    };

    this.setVoiceMapping(mapping);
    return mapping;
  }

  /**
   * 여러 NPC에 대해 자동 보이스 매핑
   */
  autoAssignVoicesForNPCs(npcs: NPCInfo[], availableVoiceActors: any[]): NPCVoiceMapping[] {
    const results: NPCVoiceMapping[] = [];
    const usedVoiceIds = new Set<string>();

    npcs.forEach(npc => {
      // 중복되지 않는 보이스 배우 선택
      const availableActors = availableVoiceActors.filter(actor => 
        !usedVoiceIds.has(actor.id)
      );

      const mapping = this.autoAssignVoice(npc, availableActors);
      if (mapping) {
        results.push(mapping);
        usedVoiceIds.add(mapping.voiceActorId);
      }
    });

    return results;
  }

  /**
   * 보이스 배우 이름에서 성격 추출
   */
  private extractPersonality(actorName: string): string {
    const parts = actorName.split('(')[1]?.split(')')[0];
    return parts || '일반';
  }

  /**
   * Subject 업데이트
   */
  private updateSubject(): void {
    const mappingArray = Array.from(this.mappings.values());
    this.mappingsSubject.next(mappingArray);
  }

  /**
   * 로컬 스토리지에 매핑 저장
   */
  private saveMappingsToStorage(): void {
    try {
      const mappingArray = Array.from(this.mappings.values());
      localStorage.setItem('npc-voice-mappings', JSON.stringify(mappingArray));
    } catch (error) {
      console.error('NPC 보이스 매핑 저장 실패:', error);
    }
  }

  /**
   * 로컬 스토리지에서 매핑 로드
   */
  private loadMappingsFromStorage(): void {
    try {
      const stored = localStorage.getItem('npc-voice-mappings');
      if (stored) {
        const mappingArray: NPCVoiceMapping[] = JSON.parse(stored);
        mappingArray.forEach(mapping => {
          this.mappings.set(mapping.npcId, mapping);
        });
        this.updateSubject();
      }
    } catch (error) {
      console.error('NPC 보이스 매핑 로드 실패:', error);
    }
  }

  /**
   * 매핑 통계
   */
  getMappingStats(): { total: number; custom: number; auto: number } {
    const mappingArray = Array.from(this.mappings.values());
    return {
      total: mappingArray.length,
      custom: mappingArray.filter(m => m.isCustom).length,
      auto: mappingArray.filter(m => !m.isCustom).length
    };
  }

  /**
   * 특정 역할의 기본 보이스 선호도 조회
   */
  getDefaultPreference(role: string): { gender: string; personality: string[] } | null {
    return this.defaultVoicePreferences[role] || null;
  }

  /**
   * 지원되는 NPC 역할 목록
   */
  getSupportedRoles(): string[] {
    return Object.keys(this.defaultVoicePreferences);
  }
} 