import { Component, OnInit, OnDestroy, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';

import { NpcVoiceMappingService, NPCVoiceMapping, NPCInfo } from '../../services/npc-voice-mapping.service';
import { VoiceActor } from '../voice-generator/voice-generator.component';
import { GameWorld, NPCProfile } from '../../models/game-world.interface';

// 확장된 게임월드 인터페이스 (NPCs 포함)
interface ExtendedGameWorld extends GameWorld {
  npcs?: NPCProfile[];
  history?: any[];
}

@Component({
  selector: 'app-npc-voice-mapping',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './npc-voice-mapping.component.html',
  styleUrls: ['./npc-voice-mapping.component.scss']
})
export class NpcVoiceMappingComponent implements OnInit, OnDestroy, OnChanges {
  // 입력 데이터
  @Input() gameWorld: ExtendedGameWorld | null = null;

  // 데이터
  voiceActors: VoiceActor[] = [];
  npcMappings: NPCVoiceMapping[] = [];
  availableNPCs: NPCInfo[] = [];

  // 상태
  isLoading = false;
  isLoadingVoices = false;
  errorMessage = '';
  successMessage = '';

  // 새 NPC 추가
  newNPC: NPCInfo = {
    id: '',
    name: '',
    role: '',
    description: ''
  };

  // 필터링 및 검색
  searchTerm = '';
  selectedRole = '';
  showOnlyMapped = false;

  // 통계
  mappingStats = { total: 0, custom: 0, auto: 0 };

  private subscriptions: Subscription[] = [];

  constructor(
    private npcVoiceMappingService: NpcVoiceMappingService,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.loadData();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['gameWorld'] && changes['gameWorld'].currentValue) {
      this.gameWorld = changes['gameWorld'].currentValue;
      this.loadData();
    }
  }

  private async loadData() {
    this.isLoading = true;
    try {
      // 보이스 배우 목록 로드
      await this.loadVoiceActors();
      
      // 매핑 상태 구독
      const mappingSub = this.npcVoiceMappingService.getMappings().subscribe(mappings => {
        this.npcMappings = mappings;
        this.mappingStats = this.npcVoiceMappingService.getMappingStats();
      });
      this.subscriptions.push(mappingSub);

      // 기본 NPC 목록 로드
      this.loadDefaultNPCs();

    } catch (error) {
      console.error('데이터 로드 실패:', error);
      this.errorMessage = '데이터 로드에 실패했습니다.';
    } finally {
      this.isLoading = false;
    }
  }

  private async loadVoiceActors() {
    this.isLoadingVoices = true;
    try {
      const actors = await this.http.get<VoiceActor[]>('/api/voice/actors').toPromise();
      if (actors) {
        this.voiceActors = actors;
        console.log(`음성 배우 ${actors.length}명 로드 완료`);
      }
    } catch (error) {
      console.error('음성 배우 로드 실패:', error);
      this.errorMessage = '음성 배우 목록을 불러올 수 없습니다.';
    } finally {
      this.isLoadingVoices = false;
    }
  }

  private loadDefaultNPCs() {
    // gameWorld에서 NPC 데이터를 가져와서 NPCInfo 형태로 변환
    if (this.gameWorld && this.gameWorld.npcs) {
      this.availableNPCs = this.gameWorld.npcs.map((npc: NPCProfile) => ({
        id: npc.id,
        name: npc.name,
        role: npc.role,
        description: npc.description || npc.background || `${npc.role} 역할을 하는 NPC`
      }));
      
      console.log(`게임 월드에서 NPC ${this.availableNPCs.length}명 로드 완료`);
    } else {
      // gameWorld가 없으면 기본 NPC 목록 사용
      this.availableNPCs = [
        { id: 'blacksmith_001', name: '철수', role: '대장장이', description: '마을의 숙련된 대장장이' },
        { id: 'guild_master_001', name: '영희', role: '길드 담당관', description: '길드의 업무를 담당하는 직원' },
        { id: 'mage_001', name: '마리아', role: '마법사', description: '고대 마법에 정통한 마법사' },
        { id: 'merchant_001', name: '상구', role: '상인', description: '다양한 물건을 파는 상인' },
        { id: 'adventurer_001', name: '모험가 김씨', role: '모험가', description: '경험 많은 모험가' },
        { id: 'scholar_001', name: '박사', role: '학자', description: '고대 유물을 연구하는 학자' },
        { id: 'healer_001', name: '수련', role: '치료사', description: '상처를 치료해주는 치료사' },
        { id: 'alchemist_001', name: '연금술사', role: '연금술사', description: '포션을 만드는 연금술사' },
        { id: 'rogue_001', name: '그림자', role: '도적', description: '정보에 정통한 도적' },
        { id: 'archer_001', name: '활희', role: '궁수', description: '활 솜씨가 뛰어난 궁수' },
        { id: 'knight_001', name: '기사단장', role: '기사', description: '왕국을 지키는 기사' },
        { id: 'farmer_001', name: '농부 이씨', role: '농부', description: '작물을 기르는 농부' },
        { id: 'mayor_001', name: '이장님', role: '마을 이장', description: '마을을 이끄는 이장' },
        { id: 'tavern_owner_001', name: '술집 사장', role: '술집 주인', description: '술집을 운영하는 주인' },
        { id: 'guard_001', name: '경비원', role: '경비병', description: '마을을 지키는 경비병' }
      ];
      
      console.log(`기본 NPC ${this.availableNPCs.length}명 로드 완료`);
    }
  }

  // ==================== NPC 관리 ====================

  addNewNPC() {
    if (!this.newNPC.id || !this.newNPC.name || !this.newNPC.role) {
      this.errorMessage = 'NPC ID, 이름, 역할을 모두 입력해주세요.';
      return;
    }

    // 중복 ID 체크
    if (this.availableNPCs.some(npc => npc.id === this.newNPC.id)) {
      this.errorMessage = '이미 존재하는 NPC ID입니다.';
      return;
    }

    this.availableNPCs.push({ ...this.newNPC });
    
    // 입력 필드 초기화
    this.newNPC = { id: '', name: '', role: '', description: '' };
    this.successMessage = 'NPC가 추가되었습니다.';
    this.clearMessages();
  }

  removeNPC(npcId: string) {
    if (confirm('이 NPC를 제거하시겠습니까?')) {
      this.availableNPCs = this.availableNPCs.filter(npc => npc.id !== npcId);
      this.npcVoiceMappingService.removeVoiceMapping(npcId);
      this.successMessage = 'NPC가 제거되었습니다.';
      this.clearMessages();
    }
  }

  // ==================== 보이스 매핑 관리 ====================

  assignVoiceToNPC(npcId: string, voiceActorId: string) {
    const npc = this.availableNPCs.find(n => n.id === npcId);
    const voice = this.voiceActors.find(v => v.id === voiceActorId);

    if (!npc || !voice) {
      this.errorMessage = 'NPC 또는 음성 배우를 찾을 수 없습니다.';
      return;
    }

    const mapping: NPCVoiceMapping = {
      npcId: npc.id,
      npcName: npc.name,
      npcRole: npc.role,
      voiceActorId: voice.id,
      voiceActorName: voice.name,
      gender: voice.gender,
      personality: voice.description || '일반',
      isCustom: true
    };

    this.npcVoiceMappingService.setVoiceMapping(mapping);
    this.successMessage = `${npc.name}에게 ${voice.name} 목소리가 할당되었습니다.`;
    this.clearMessages();
  }

  removeVoiceMapping(npcId: string) {
    if (confirm('이 보이스 매핑을 제거하시겠습니까?')) {
      this.npcVoiceMappingService.removeVoiceMapping(npcId);
      this.successMessage = '보이스 매핑이 제거되었습니다.';
      this.clearMessages();
    }
  }

  // ==================== 자동 매핑 ====================

  autoAssignAllVoices() {
    if (this.voiceActors.length === 0) {
      this.errorMessage = '음성 배우 목록을 먼저 로드해주세요.';
      return;
    }

    const unmappedNPCs = this.availableNPCs.filter(npc => 
      !this.npcMappings.some(mapping => mapping.npcId === npc.id)
    );

    if (unmappedNPCs.length === 0) {
      this.errorMessage = '자동 할당할 NPC가 없습니다.';
      return;
    }

    const results = this.npcVoiceMappingService.autoAssignVoicesForNPCs(unmappedNPCs, this.voiceActors);
    
    this.successMessage = `${results.length}명의 NPC에 음성이 자동 할당되었습니다.`;
    this.clearMessages();
  }

  autoAssignSingleVoice(npcId: string) {
    const npc = this.availableNPCs.find(n => n.id === npcId);
    if (!npc) {
      this.errorMessage = 'NPC를 찾을 수 없습니다.';
      return;
    }

    const result = this.npcVoiceMappingService.autoAssignVoice(npc, this.voiceActors);
    if (result) {
      this.successMessage = `${npc.name}에게 ${result.voiceActorName} 목소리가 자동 할당되었습니다.`;
    } else {
      this.errorMessage = '적합한 음성 배우를 찾을 수 없습니다.';
    }
    this.clearMessages();
  }

  // ==================== 필터링 및 검색 ====================

  get filteredNPCs(): NPCInfo[] {
    let filtered = [...this.availableNPCs];

    // 검색어 필터
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(npc => 
        npc.name.toLowerCase().includes(term) ||
        npc.role.toLowerCase().includes(term) ||
        npc.id.toLowerCase().includes(term)
      );
    }

    // 역할 필터
    if (this.selectedRole) {
      filtered = filtered.filter(npc => npc.role === this.selectedRole);
    }

    // 매핑 상태 필터
    if (this.showOnlyMapped) {
      filtered = filtered.filter(npc => 
        this.npcMappings.some(mapping => mapping.npcId === npc.id)
      );
    }

    return filtered;
  }

  get availableRoles(): string[] {
    const roles = [...new Set(this.availableNPCs.map(npc => npc.role))];
    return roles.sort();
  }

  // ==================== 유틸리티 ====================

  getVoiceMappingForNPC(npcId: string): NPCVoiceMapping | null {
    return this.npcMappings.find(mapping => mapping.npcId === npcId) || null;
  }

  getVoiceActorName(npcId: string): string {
    const mapping = this.getVoiceMappingForNPC(npcId);
    return mapping ? mapping.voiceActorName : '미할당';
  }

  isNPCMapped(npcId: string): boolean {
    return this.npcMappings.some(mapping => mapping.npcId === npcId);
  }

  getDefaultPreference(role: string): string {
    const pref = this.npcVoiceMappingService.getDefaultPreference(role);
    if (pref) {
      return `${pref.gender === 'male' ? '남성' : '여성'} (${pref.personality.join(', ')})`;
    }
    return '설정 없음';
  }

  // ==================== 데이터 관리 ====================

  exportMappings() {
    const data = {
      mappings: this.npcMappings,
      npcs: this.availableNPCs,
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `npc-voice-mappings-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    this.successMessage = '매핑 데이터가 내보내기되었습니다.';
    this.clearMessages();
  }

  importMappings(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        
        if (data.mappings && Array.isArray(data.mappings)) {
          this.npcVoiceMappingService.setBulkVoiceMappings(data.mappings);
          
          if (data.npcs && Array.isArray(data.npcs)) {
            this.availableNPCs = data.npcs;
          }
          
          this.successMessage = '매핑 데이터가 가져오기되었습니다.';
        } else {
          this.errorMessage = '유효하지 않은 파일 형식입니다.';
        }
      } catch (error) {
        console.error('파일 가져오기 실패:', error);
        this.errorMessage = '파일을 읽을 수 없습니다.';
      }
      
      // 파일 입력 초기화
      input.value = '';
      this.clearMessages();
    };
    
    reader.readAsText(file);
  }

  clearAllMappings() {
    if (confirm('모든 보이스 매핑을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      this.npcVoiceMappingService.clearAllMappings();
      this.successMessage = '모든 매핑이 삭제되었습니다.';
      this.clearMessages();
    }
  }

  refreshVoiceActors() {
    this.loadVoiceActors();
  }

  // ==================== 메시지 관리 ====================

  private clearMessages() {
    setTimeout(() => {
      this.errorMessage = '';
      this.successMessage = '';
    }, 3000);
  }

  clearMessagesNow() {
    this.errorMessage = '';
    this.successMessage = '';
  }

  // ==================== 샘플 재생 및 매핑 ====================

  /**
   * 샘플 재생 후 자동 매핑 여부를 묻는 기능
   */
  async playSampleWithMappingOption(npcId: string, actorId: string) {
    const npc = this.availableNPCs.find(n => n.id === npcId);
    const actor = this.voiceActors.find(a => a.id === actorId);
    
    if (!npc || !actor) return;

    try {
      // 샘플 재생 URL 시도
      const sampleUrl = `/api/voice/actors/${actorId}/sample`;
      
      // 샘플 재생 (간단한 Audio 객체 사용)
      const audio = new Audio(sampleUrl);
      
      audio.addEventListener('loadeddata', () => {
        console.log(`샘플 로드 완료: ${actor.name}`);
      });
      
      audio.addEventListener('ended', () => {
        // 샘플 재생 완료 후 매핑 여부 묻기
        const shouldMap = confirm(
          `"${actor.name}" 목소리가 "${npc.name}"에게 적합하다고 생각하시나요?\n\n확인을 누르면 자동으로 매핑됩니다.`
        );
        
        if (shouldMap) {
          this.assignVoiceToNPC(npcId, actorId);
        }
      });
      
      audio.addEventListener('error', () => {
        this.errorMessage = '샘플 재생에 실패했습니다.';
      });
      
      await audio.play();
      
    } catch (error) {
      console.error('샘플 재생 실패:', error);
      this.errorMessage = '샘플 재생에 실패했습니다.';
    }
  }

  /**
   * 빠른 매핑 기능 - 샘플 듣지 않고 바로 매핑
   */
  quickMapVoiceToNPC(npcId: string, actorId: string) {
    const npc = this.availableNPCs.find(n => n.id === npcId);
    const actor = this.voiceActors.find(a => a.id === actorId);
    
    if (!npc || !actor) return;
    
    const confirmed = confirm(
      `"${actor.name}" 목소리를 "${npc.name}"에게 매핑하시겠습니까?`
    );
    
    if (confirmed) {
      this.assignVoiceToNPC(npcId, actorId);
    }
  }

  /**
   * NPC 역할에 따른 추천 음성 배우 목록 (최대 3명)
   */
  getRecommendedActors(npcRole: string): VoiceActor[] {
    const preference = this.npcVoiceMappingService.getDefaultPreference(npcRole);
    
    if (!preference || this.voiceActors.length === 0) {
      return this.voiceActors.slice(0, 3); // 기본적으로 처음 3명
    }

    // 선호 성별 및 성격에 맞는 배우 찾기
    const preferredActors = this.voiceActors.filter(actor => {
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
      : this.voiceActors.filter(actor => actor.gender === preference.gender);

    // 최대 3명까지 반환
    return fallbackActors.slice(0, 3);
  }

  // ==================== 템플릿 접근용 공개 메서드 ====================

  /**
   * 지원되는 역할 목록을 반환 (템플릿 접근용)
   */
  getSupportedRoles(): string[] {
    return this.npcVoiceMappingService.getSupportedRoles();
  }

  /**
   * 남성 음성 배우 목록을 반환 (템플릿 접근용)
   */
  getMaleVoiceActors(): VoiceActor[] {
    return this.voiceActors.filter(a => a.gender === 'male');
  }

  /**
   * 여성 음성 배우 목록을 반환 (템플릿 접근용)
   */
  getFemaleVoiceActors(): VoiceActor[] {
    return this.voiceActors.filter(a => a.gender === 'female');
  }

  /**
   * 모든 필터를 초기화 (템플릿 접근용)
   */
  resetFilters() {
    this.searchTerm = '';
    this.selectedRole = '';
    this.showOnlyMapped = false;
  }
} 