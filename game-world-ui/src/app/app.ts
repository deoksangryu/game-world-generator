import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

// Components
import { WorldInputComponent, WorldGenerationOptions } from './components/world-input/world-input';
import { WorldDisplayComponent } from './components/world-display/world-display';
import { NPCProfilesComponent } from './components/npc-profiles/npc-profiles';
import { ChatInterfaceComponent } from './components/chat-interface/chat-interface';
import { VoiceGeneratorComponent } from './components/voice-generator/voice-generator.component';
import { WeaponMakerComponent } from './components/weapon-maker/weapon-maker';
import { SaveLoadModalComponent } from './components/save-load-modal/save-load-modal.component';

// Models & Services
import { GameWorld, NPCProfile, ChatMessage, ServerStatus, HistoryEra, SavedWorldData } from './models/game-world.interface';
import { GameWorldService } from './services/game-world.service';
import { NPCDialogueService, QuestOffer } from './services/npc-dialogue.service';

/**
 * 메인 앱 컴포넌트
 * 게임 월드 생성부터 NPC 상호작용까지의 전체 워크플로우를 관리합니다.
 * 4개의 주요 섹션으로 구성:
 * 1. 세계관 생성 (Section 1)
 * 2. NPC 생성 (Section 2)  
 * 3. AI 이미지 생성 (Section 3)
 * 4. 캐릭터 상호작용 (Section 4)
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    WorldInputComponent,
    WorldDisplayComponent,
    NPCProfilesComponent,
    ChatInterfaceComponent,
    VoiceGeneratorComponent,
    WeaponMakerComponent,
    SaveLoadModalComponent
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  @ViewChild(NPCProfilesComponent) npcProfilesComponent!: NPCProfilesComponent;
  @ViewChild(VoiceGeneratorComponent) voiceGeneratorComponent!: VoiceGeneratorComponent;
  @ViewChild('sectionsContainer') sectionsContainer!: ElementRef;
  
  private destroy$ = new Subject<void>();

  // State
  currentWorld: GameWorld | null = null;
  npcProfiles: NPCProfile[] = [];
  worldHistory: HistoryEra[] = [];
  selectedNPC: NPCProfile | null = null;
  chatMessages: ChatMessage[] = [];

  // Server status
  serverStatus: ServerStatus | null = null;
  serverConnected = false;

  // Tab states
  activeTab = 'world-gen';

  // Loading states
  isGeneratingWorld = false;
  isGeneratingNPCs = false;
  isGeneratingImages = false;
  isCheckingServer = false;

  // Progress tracking
  currentStep = 1;
  showProgress = true;
  showMobileNav = false;

  // 저장/불러오기 모달 상태
  showSaveLoadModal = false;
  saveLoadMode: 'save' | 'load' = 'save';
  savedWorlds: SavedWorldData[] = [];
  isSaveLoadLoading = false;

  constructor(
    private gameWorldService: GameWorldService,
    private npcDialogueService: NPCDialogueService
  ) {}

  ngOnInit() {
    // 서버 상태 확인
    this.checkServerStatus();

    // 디버깅을 위한 키보드 단축키 추가 (Ctrl+Shift+D)
    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        this.debugLocalStorage();
      }
    });

    // Subscribe to service observables
    this.gameWorldService.currentWorld$
      .pipe(takeUntil(this.destroy$))
      .subscribe((world: GameWorld | null) => {
        this.currentWorld = world;
        if (world) {
          this.currentStep = Math.max(this.currentStep, 1);
          this.showProgress = true;
        }
      });

    this.gameWorldService.npcProfiles$
      .pipe(takeUntil(this.destroy$))
      .subscribe((npcs: NPCProfile[]) => {
        const previousNPCCount = this.npcProfiles.length;
        this.npcProfiles = npcs;
        
        // 선택된 NPC가 있다면 업데이트된 데이터로 동기화
        if (this.selectedNPC && npcs.length > 0) {
          const updatedNPC = npcs.find(npc => npc.id === this.selectedNPC!.id);
          if (updatedNPC) {
            this.selectedNPC = updatedNPC;
          }
        } else if (npcs.length > 0 && previousNPCCount === 0) {
          // 세계관 불러오기로 인해 NPC가 새로 로드된 경우 (이전에 없었던 경우)
          // 첫 번째 NPC를 자동 선택하고 대화창 활성화
          const firstNPC = npcs[0];
          console.log(`🎯 세계관 불러오기 후 첫 번째 NPC "${firstNPC.name}" 자동 선택`);
          this.onNPCSelected(firstNPC);
          
          // 대화 탭으로 자동 전환
          // this.setActiveTab('chat'); // 자동 전환 비활성화
        }
        
        if (npcs.length > 0) {
          this.currentStep = Math.max(this.currentStep, 2);
        }
      });

    this.gameWorldService.history$
      .pipe(takeUntil(this.destroy$))
      .subscribe((history: HistoryEra[]) => {
        this.worldHistory = history;
      });

    this.gameWorldService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe((loading: boolean) => {
        this.isGeneratingWorld = loading;
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // 서버 상태 확인
  checkServerStatus(): void {
    this.isCheckingServer = true;
    this.gameWorldService.checkServerStatus().subscribe({
      next: (status: ServerStatus) => {
        this.serverStatus = status;
        this.serverConnected = status.status === 'healthy' || status.status === 'partial';
        this.isCheckingServer = false;
        console.log('Server status:', status);
      },
      error: (error: any) => {
        this.serverConnected = false;
        this.isCheckingServer = false;
        console.warn('Server connection failed:', error);
      }
    });
  }

  // Section Navigation Methods
  scrollToSection(sectionNumber: number): void {
    this.currentStep = sectionNumber;
    const section = document.getElementById(`section-${sectionNumber}`);
    if (section) {
      section.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  }

  proceedToNPCGeneration(): void {
    this.currentStep = 2;
    this.scrollToSection(2);
  }

  proceedToImageGeneration(): void {
    this.currentStep = 3;
    this.scrollToSection(3);
  }

  proceedToWeaponMaking(): void {
    this.currentStep = 4;
    this.scrollToSection(4);
  }

  proceedToVoiceGeneration(): void {
    this.currentStep = 5;
    this.scrollToSection(5);
  }

  proceedToInteraction(): void {
    this.currentStep = 6;
    this.scrollToSection(6);
  }

  // 모바일 네비게이션 토글
  toggleMobileNav(): void {
    this.showMobileNav = !this.showMobileNav;
  }

  // 기본 세계관 생성
  onWorldCreated(options: WorldGenerationOptions) {
    this.isGeneratingWorld = true;
    
    console.log('🎛️ 세계관 생성 옵션:', options);
    
    this.gameWorldService.generateWorldWithOptions(options).subscribe({
      next: (world: GameWorld) => {
        this.gameWorldService.updateCurrentWorld(world);
        this.isGeneratingWorld = false;
        this.currentStep = 1;
        this.showProgress = true;
        // 생성된 월드 미리보기로 스크롤
        setTimeout(() => {
          const worldPreview = document.querySelector('.world-preview');
          if (worldPreview) {
            worldPreview.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      },
      error: (error: any) => {
        console.error('Error generating world:', error);
        this.isGeneratingWorld = false;
      }
    });
  }

  // 통합 세계관 생성 (세계관 + NPC + 이미지)
  onFullWorldCreated(options: WorldGenerationOptions) {
    this.isGeneratingWorld = true;
    this.isGeneratingNPCs = true;
    this.isGeneratingImages = true;
    
    console.log('🚀 통합 세계관 생성 옵션:', options);
    
    this.gameWorldService.generateWorldWithOptions(options).subscribe({
      next: (world: GameWorld) => {
        this.gameWorldService.updateCurrentWorld(world);
        this.isGeneratingWorld = false;
        this.isGeneratingNPCs = false;
        this.isGeneratingImages = false;
        this.currentStep = 3; // 이미지까지 생성되었으므로 3단계로
        this.showProgress = true;
        
        // 생성된 월드 미리보기로 스크롤
        setTimeout(() => {
          const worldPreview = document.querySelector('.world-preview');
          if (worldPreview) {
            worldPreview.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      },
      error: (error: any) => {
        console.error('Error generating full world:', error);
        this.isGeneratingWorld = false;
        this.isGeneratingNPCs = false;
        this.isGeneratingImages = false;
      }
    });
  }

  generateNPCs() {
    if (!this.currentWorld) return;

    this.isGeneratingNPCs = true;
    
    this.gameWorldService.generateNPCs(this.currentWorld.id!).subscribe({
      next: (npcs: NPCProfile[]) => {
        this.gameWorldService.updateNPCProfiles(npcs);
        this.isGeneratingNPCs = false;
        this.currentStep = 2;
        // 좌측 패널 버튼과 동일한 방식으로 정확한 섹션으로 스크롤
        setTimeout(() => {
          this.scrollToSection(2);
        }, 100);
      },
      error: (error: any) => {
        console.error('Error generating NPCs:', error);
        this.isGeneratingNPCs = false;
      }
    });
  }

  generateAllImages() {
    if (this.npcProfiles.length === 0) return;

    this.isGeneratingImages = true;
    
    // 이미지가 없는 NPC들만 필터링
    const npcsWithoutImages = this.npcProfiles.filter(npc => !npc.imageUrl);
    
    if (npcsWithoutImages.length === 0) {
      this.isGeneratingImages = false;
      console.log('모든 NPC가 이미 이미지를 가지고 있습니다.');
      return;
    }
    
    console.log(`${npcsWithoutImages.length}개의 NPC 이미지를 생성합니다...`);
    
    this.gameWorldService.generateMultipleNPCImages(npcsWithoutImages).subscribe({
      next: (results: {npcId: string, imageUrl: string}[]) => {
        // 결과를 NPC 프로필에 업데이트
        this.updateMultipleNPCImages(results);
        
        // 선택된 NPC가 있고 이미지가 새로 생성되었다면 업데이트
        if (this.selectedNPC) {
          const updatedImage = results.find(r => r.npcId === this.selectedNPC!.id);
          if (updatedImage) {
            this.selectedNPC = { ...this.selectedNPC, imageUrl: updatedImage.imageUrl };
          }
        }
        
        this.isGeneratingImages = false;
        this.currentStep = 3;
        
        console.log(`NPC 이미지 생성 완료: ${results.length}개`);
        
        setTimeout(() => {
          this.scrollToSection(3);
        }, 100);
      },
      error: (error: any) => {
        console.error('Error generating NPC images:', error);
        this.isGeneratingImages = false;
      }
    });
  }

  /**
   * 개별 NPC 이미지 생성
   */
  generateSingleNPCImage(npc: NPCProfile) {
    if (!npc) return;

    console.log(`개별 NPC 이미지 생성 시작: ${npc.name}`);
    
    // NPC 프로필 컴포넌트의 이미지 생성 상태 시작
    if (this.npcProfilesComponent) {
      this.npcProfilesComponent.startImageGeneration(npc);
    }
    
    this.gameWorldService.generateNPCImage(npc).subscribe({
      next: (imageUrl: string) => {
        // 해당 NPC의 이미지 업데이트 (서비스 레벨)
        this.updateNPCImage(npc.id, imageUrl);
        
        // NPC 프로필 컴포넌트에서 실시간 업데이트 (모달 포함)
        if (this.npcProfilesComponent) {
          this.npcProfilesComponent.updateNPCImageInStore(npc.id, imageUrl);
        }
        
        // 선택된 NPC라면 바로 업데이트
        if (this.selectedNPC && this.selectedNPC.id === npc.id) {
          this.selectedNPC = { ...this.selectedNPC, imageUrl };
        }
        
        // NPC 프로필 컴포넌트의 이미지 생성 상태 완료
        if (this.npcProfilesComponent) {
          this.npcProfilesComponent.completeImageGeneration(npc.id);
        }
        
        console.log(`NPC 이미지 생성 완료: ${npc.name} -> ${imageUrl}`);
      },
      error: (error: any) => {
        console.error(`Error generating image for ${npc.name}:`, error);
        
        // 에러 발생 시에도 로딩 상태 해제
        if (this.npcProfilesComponent) {
          this.npcProfilesComponent.completeImageGeneration(npc.id);
        }
      }
    });
  }

  // NPC Selection Method
  onNPCSelected(npc: NPCProfile): void {
    this.selectedNPC = npc;
    this.npcDialogueService.selectNPC(npc);
    console.log('Selected NPC:', npc);
    
    // 음성 생성 컴포넌트에 NPC 정보 전달
    if (this.voiceGeneratorComponent) {
      this.voiceGeneratorComponent.setNPCContextExtended(npc.id!, npc.name, npc.role);
      
      // NPC에 이미 할당된 음성 배우가 있는지 확인하고 자동 매핑
      if (npc.voiceActor) {
        console.log(`NPC ${npc.name}에 이미 할당된 음성 배우: ${npc.voiceActor}`);
        // voiceGeneratorComponent에서 해당 배우를 자동 선택하도록 처리
      }
    }
    
    // NPC 대화 서비스에도 기존 음성 매핑이 있다면 설정
    const npcId = `npc_${npc.id}`;
    if (npc.voiceActor) {
      // 음성 배우 이름으로 ID 찾기 (실제로는 음성 배우 ID가 필요)
      // 이는 VoiceGeneratorComponent에서 처리하도록 위임
      console.log(`NPC ${npc.name}의 음성 배우 ${npc.voiceActor} 매핑 예정`);
    }
  }

  onMessageSent(message: string) {
    if (!this.selectedNPC) return;
    
    // 기존 게임 서비스를 통한 메시지 처리는 제거하고
    // NPC 대화 서비스에서 모든 처리를 담당하도록 변경
    console.log('Message sent to NPC:', message);
  }

  /**
   * 퀘스트 수락 처리
   */
  onQuestAccepted(questOffer: QuestOffer) {
    console.log('✅ 퀘스트 수락됨:', questOffer);
    
    // 여기서 퀘스트를 게임 상태에 추가하는 로직 구현
    // 예: 현재 사용자의 활성 퀘스트 목록에 추가
    
    // 성공 메시지 표시
    this.showNotification(`퀘스트 "${questOffer.title}"가 퀘스트 로그에 추가되었습니다!`, 'success');
  }

  /**
   * 퀘스트 거절 처리
   */
  onQuestRejected(questOffer: QuestOffer) {
    console.log('❌ 퀘스트 거절됨:', questOffer);
    
    // 거절 로직 처리
    this.showNotification(`퀘스트 "${questOffer.title}"를 거절했습니다.`, 'info');
  }

  /**
   * 알림 메시지 표시
   */
  private showNotification(message: string, type: 'success' | 'error' | 'info' = 'info') {
    // 간단한 알림 구현 (실제로는 토스트 라이브러리 사용 권장)
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      z-index: 9999;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
      animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // 3초 후 제거
    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  getRoleIcon(role: string): string {
    const roleIcons: { [key: string]: string } = {
      '대장장이': '🔨',
      '길드 담당관': '📋',
      '마법사': '🧙‍♂️',
      '상인': '🛒',
      '농부': '🌾',
      '치료사': '⚕️',
      '모험가': '⚔️',
      '기사': '🛡️',
      '도적': '🗡️',
      '궁수': '🏹',
      '학자': '📚'
    };
    return roleIcons[role] || '👤';
  }

  updateNPCImage(npcId: string, imageUrl: string): void {
    const updatedNPCs = this.npcProfiles.map(npc => 
      npc.id === npcId ? { ...npc, imageUrl } : npc
    );
    this.gameWorldService.updateNPCProfiles(updatedNPCs);
  }

  updateMultipleNPCImages(updates: { npcId: string; imageUrl: string }[]): void {
    let updatedNPCs = [...this.npcProfiles];
    updates.forEach(update => {
      updatedNPCs = updatedNPCs.map(npc => 
        npc.id === update.npcId ? { ...npc, imageUrl: update.imageUrl } : npc
      );
    });
    this.gameWorldService.updateNPCProfiles(updatedNPCs);
  }

  // ==================== 저장/불러오기 기능 ====================

  /**
   * 저장 모달 열기
   */
  openSaveModal(): void {
    console.log('🔍 저장 모달 열기 시도');
    console.log('현재 세계관:', this.currentWorld);
    console.log('현재 NPC들:', this.npcProfiles);
    
    if (!this.currentWorld) {
      console.log('❌ 저장할 세계관이 없음');
      alert('저장할 세계관이 없습니다. 먼저 세계관을 생성해주세요.');
      return;
    }
    
    console.log('✅ 저장 가능, 모달 열기');
    this.saveLoadMode = 'save';
    this.loadSavedWorldsList();
    this.showSaveLoadModal = true;
  }

  /**
   * 불러오기 모달 열기
   */
  openLoadModal(): void {
    console.log('🔍 불러오기 모달 열기 시도');
    this.saveLoadMode = 'load';
    this.loadSavedWorldsList();
    this.showSaveLoadModal = true;
  }

  /**
   * 모달 닫기
   */
  closeSaveLoadModal(): void {
    console.log('🔍 모달 닫기');
    this.showSaveLoadModal = false;
    this.isSaveLoadLoading = false;
  }

  /**
   * 저장된 세계관 목록 불러오기
   */
  loadSavedWorldsList(): void {
    console.log('🔍 저장된 세계관 목록 불러오기 시도');
    this.gameWorldService.getSavedWorldList().subscribe({
      next: (response) => {
        console.log('📝 getSavedWorldList 응답:', response);
        if (response.success) {
          this.savedWorlds = response.worlds;
          console.log('✅ 저장된 세계관들:', this.savedWorlds);
        } else {
          console.error('❌ 저장된 세계관 목록 로드 실패:', response.message);
          this.savedWorlds = [];
        }
      },
      error: (error) => {
        console.error('❌ 저장된 세계관 목록 로드 에러:', error);
        this.savedWorlds = [];
      }
    });
  }

  /**
   * 세계관 저장하기
   */
  onSaveWorld(data: {name: string, description?: string}): void {
    console.log('🔍 세계관 저장 시도:', data);
    console.log('현재 세계관 데이터:', this.currentWorld);
    console.log('현재 NPC 데이터:', this.npcProfiles);
    
    this.isSaveLoadLoading = true;
    
    this.gameWorldService.saveWorldData(data.name, data.description).subscribe({
      next: (response) => {
        console.log('📝 saveWorldData 응답:', response);
        this.isSaveLoadLoading = false;
        
        if (response.success) {
          console.log('✅ 세계관 저장 성공:', response.message);
          alert('세계관이 성공적으로 저장되었습니다!');
          this.loadSavedWorldsList(); // 목록 새로고침
          this.closeSaveLoadModal();
        } else {
          console.error('❌ 세계관 저장 실패:', response.message);
          alert('세계관 저장에 실패했습니다: ' + response.message);
        }
      },
      error: (error) => {
        console.error('❌ 세계관 저장 에러:', error);
        this.isSaveLoadLoading = false;
        alert('세계관 저장 중 오류가 발생했습니다.');
      }
    });
  }

  /**
   * 세계관 불러오기
   */
  onLoadWorld(worldId: string): void {
    console.log('🔍 세계관 불러오기 시도. ID:', worldId);
    this.isSaveLoadLoading = true;
    
    this.gameWorldService.loadWorldData(worldId).subscribe({
      next: (response) => {
        console.log('📝 loadWorldData 응답:', response);
        this.isSaveLoadLoading = false;
        
        if (response.success && response.worldData) {
          console.log('✅ 불러온 세계관 데이터:', response.worldData);
          
          // 불러온 데이터를 현재 상태에 적용
          this.gameWorldService.applyLoadedWorldData(response.worldData);
          
          // UI 상태 업데이트
          this.currentStep = 3; // 이미지 생성까지 완료된 상태로 설정
          this.activeTab = 'world-gen'; // 첫 번째 탭으로 이동
          
          console.log('✅ 세계관 불러오기 성공:', response.message);
          alert('세계관을 성공적으로 불러왔습니다!');
          this.closeSaveLoadModal();
          
          // 첫 번째 섹션으로 스크롤
          setTimeout(() => {
            this.scrollToSection(1);
          }, 100);
        } else {
          console.error('❌ 세계관 불러오기 실패:', response.message);
          alert('세계관 불러오기에 실패했습니다: ' + response.message);
        }
      },
      error: (error) => {
        console.error('❌ 세계관 불러오기 에러:', error);
        this.isSaveLoadLoading = false;
        alert('세계관 불러오기 중 오류가 발생했습니다.');
      }
    });
  }

  /**
   * 저장된 세계관 삭제하기
   */
  onDeleteWorld(worldId: string): void {
    // 임시로 localStorage에서 삭제
    try {
      const saved = localStorage.getItem('savedWorlds');
      if (saved) {
        const worlds = JSON.parse(saved);
        const filteredWorlds = worlds.filter((w: any) => w.id !== worldId);
        localStorage.setItem('savedWorlds', JSON.stringify(filteredWorlds));
        
        // 목록 새로고침
        this.loadSavedWorldsList();
        console.log('✅ 세계관 삭제 완료');
      }
    } catch (error) {
      console.error('Error deleting world:', error);
      alert('세계관 삭제 중 오류가 발생했습니다.');
    }
  }

  // ==================== 역할별 특별 기능 이벤트 핸들러 ====================

  /**
   * 대장장이 무기 제작 이벤트 처리
   * @param npc 대장장이 NPC
   */
  onCraftWeapon(npc: NPCProfile) {
    console.log(`🔨 ${npc.name}에게 무기 제작을 요청합니다.`);
    // TODO: 무기 제작 로직 구현
    // 예: 무기 제작 모달 열기, 재료 선택, 제작 프로세스 등
    alert(`⚒️ ${npc.name}의 대장간에 오신 것을 환영합니다!\n\n무기 제작 기능이 곧 구현될 예정입니다.`);
  }

  /**
   * 마법스크롤 상인 주문 제작 이벤트 처리
   * @param npc 마법스크롤 상인 NPC
   */
  onCraftSpell(npc: NPCProfile) {
    console.log(`📜 ${npc.name}에게 주문 제작을 요청합니다.`);
    // TODO: 주문 제작 로직 구현
    // 예: 주문 제작 모달 열기, 마법 선택, 제작 프로세스 등
    alert(`🔮 ${npc.name}의 마법 상점에 오신 것을 환영합니다!\n\n주문 제작 기능이 곧 구현될 예정입니다.`);
  }

  /**
   * 길드 마스터 퀘스트 의뢰 이벤트 처리
   * @param npc 길드 마스터 NPC
   */
  onAssignQuest(npc: NPCProfile) {
    console.log(`📋 ${npc.name}에게 퀘스트 의뢰를 요청합니다.`);
    // TODO: 퀘스트 의뢰 로직 구현
    // 예: 퀘스트 의뢰 모달 열기, 퀘스트 선택, 의뢰 프로세스 등
    alert(`🏛️ ${npc.name}의 길드에 오신 것을 환영합니다!\n\n퀘스트 의뢰 기능이 곧 구현될 예정입니다.`);
  }

  // Navigation Methods
  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  getPageTitle(): string {
    const titles: { [key: string]: string } = {
      'world-gen': '세계관 생성',
      'npcs': 'NPC 관리',
      'chat': 'NPC 대화',
      'voice': '음성 시스템',
      'weapons': '무기 제작',
      'quests': '퀘스트 관리',
      'magic': '마법 시스템'
    };
    return titles[this.activeTab] || '게임 월드 스튜디오';
  }

  getPageSubtitle(): string {
    const subtitles: { [key: string]: string } = {
      'world-gen': 'AI를 활용한 게임 세계관 생성',
      'npcs': '캐릭터 생성 및 관리',
      'chat': '생성된 NPC와 실시간 대화',
      'voice': 'TTS 음성 생성 및 NPC 음성 매핑',
      'weapons': '무기 및 장비 제작 시스템',
      'quests': '미션 및 임무 관리 (개발 예정)',
      'magic': '마법 시스템 관리 (개발 예정)'
    };
    return subtitles[this.activeTab] || 'AI Game World Generator';
  }

  // Debug method
  debugLocalStorage(): void {
    console.log('=== 🔍 DEBUG: 저장/불러오기 상태 ===');
    console.log('현재 세계관:', this.currentWorld);
    console.log('현재 NPC들:', this.npcProfiles);
    console.log('모달 표시 상태:', this.showSaveLoadModal);
    console.log('저장/불러오기 모드:', this.saveLoadMode);
    console.log('저장된 세계관 목록:', this.savedWorlds);
    console.log('로딩 상태:', this.isSaveLoadLoading);
    
    console.log('--- localStorage 직접 확인 ---');
    const savedWorlds = localStorage.getItem('savedWorlds');
    console.log('localStorage savedWorlds (원본):', savedWorlds);
    
    if (savedWorlds) {
      try {
        const parsed = JSON.parse(savedWorlds);
        console.log('localStorage savedWorlds (파싱됨):', parsed);
        console.log('저장된 세계관 수:', parsed.length);
      } catch (error) {
        console.error('localStorage 파싱 에러:', error);
      }
    } else {
      console.log('localStorage에 저장된 세계관이 없습니다.');
    }
    
    console.log('--- localStorage 전체 키 목록 ---');
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key || '');
      console.log(`${key}: ${value?.substring(0, 100)}${value && value.length > 100 ? '...' : ''}`);
    }
    
    console.log('=== DEBUG 완료 ===');
    
    // UI에도 표시
    alert('디버깅 정보가 콘솔에 출력되었습니다. F12를 눌러 개발자 도구를 확인하세요.');
  }

  /**
   * 음성 배우 매핑 처리 메서드
   */
  onVoiceActorMapped(data: { npcId: string, voiceActorId: string, voiceActorName: string }): void {
    const npcId = `npc_${data.npcId}`;
    
    // NPC 대화 서비스에 음성 매핑 설정
    this.npcDialogueService.setNPCVoiceMapping(npcId, data.voiceActorId);
    
    // NPC 프로필에도 음성 배우 정보 업데이트
    const updatedNPCs = this.npcProfiles.map(npc => 
      npc.id === data.npcId ? { ...npc, voiceActor: data.voiceActorName } : npc
    );
    this.gameWorldService.updateNPCProfiles(updatedNPCs);
    
    // 선택된 NPC도 업데이트
    if (this.selectedNPC && this.selectedNPC.id === data.npcId) {
      this.selectedNPC = { ...this.selectedNPC, voiceActor: data.voiceActorName };
    }
    
    console.log(`✅ NPC ${data.npcId}에 음성 배우 ${data.voiceActorName} (${data.voiceActorId}) 매핑 완료`);
    
    // 사용자에게 알림
    this.showNotification(`NPC에 음성 배우가 성공적으로 할당되었습니다!`, 'success');
  }
}
