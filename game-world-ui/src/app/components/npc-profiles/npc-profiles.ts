import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NPCProfile, Weapon, Quest, Magic, NPCProduct, GameWorld } from '../../models/game-world.interface';
import { GameWorldService } from '../../services/game-world.service';
import { WeaponViewerComponent } from '../weapon-viewer/weapon-viewer';
import { QuestViewerComponent } from '../quest-viewer/quest-viewer';
import { MagicViewerComponent } from '../magic-viewer/magic-viewer';

/**
 * NPC 프로필 컴포넌트
 * 생성된 NPC들의 목록을 표시하고 관리하는 컴포넌트입니다.
 * 
 * 주요 기능:
 * - NPC 카드 그리드 표시 (컴팩트 모드 / 상세 모드)
 * - NPC 상세 정보 모달
 * - 역할별 필터링 및 검색
 * - NPC 생산품 관리 (무기, 퀘스트, 마법, 아이템)
 * - 이미지 로딩 및 업데이트 관리
 */
@Component({
  selector: 'app-npc-profiles',
  standalone: true,
  imports: [CommonModule, FormsModule, WeaponViewerComponent, QuestViewerComponent, MagicViewerComponent],
  templateUrl: './npc-profiles.html',
  styleUrls: ['./npc-profiles.scss']
})
export class NPCProfilesComponent implements OnInit, OnDestroy, OnChanges {
  // ==================== 입력/출력 속성 ====================
  
  @Input() gameWorld: GameWorld | null = null;
  /** 표시할 NPC 프로필 목록 */
  @Input() npcProfiles: NPCProfile[] = [];
  
  /** 이미지 생성 중 여부 (부모 컴포넌트에서 전달) */
  @Input() isGeneratingImages = false;
  
  /** 컴팩트 모드 여부 (true: 그리드형, false: 상세형) */
  @Input() compactMode = false;
  
  /** NPC 선택 시 부모 컴포넌트로 이벤트 전달 */
  @Output() npcSelected = new EventEmitter<NPCProfile>();
  
  /** 이미지 생성 요청 시 부모 컴포넌트로 이벤트 전달 */
  @Output() generateImages = new EventEmitter<void>();

  /** 개별 NPC 이미지 생성 요청 시 부모 컴포넌트로 이벤트 전달 */
  @Output() generateSingleImage = new EventEmitter<NPCProfile>();

  /** 대장장이 무기 제작 요청 시 부모 컴포넌트로 이벤트 전달 */
  @Output() craftWeapon = new EventEmitter<NPCProfile>();

  /** 마법스크롤 상인 주문 제작 요청 시 부모 컴포넌트로 이벤트 전달 */
  @Output() craftSpell = new EventEmitter<NPCProfile>();

  /** 길드 마스터 퀘스트 의뢰 요청 시 부모 컴포넌트로 이벤트 전달 */
  @Output() assignQuest = new EventEmitter<NPCProfile>();

  // ==================== 상태 관리 ====================
  
  /** 확장된 NPC ID 집합 (상세 정보를 보여주는 NPC들) */
  expandedNPCs: Set<string> = new Set();
  
  /** 생산품 로딩 중인 NPC ID 집합 */
  loadingProducts: Set<string> = new Set();
  
  /** 상세 보기용으로 선택된 NPC (사이드바 표시용) */
  selectedNPCForDetails: NPCProfile | null = null;
  
  // ==================== 필터링 관련 속성 ====================
  
  /** 현재 선택된 역할 필터 */
  selectedRole: string = '전체';
  
  /** 검색어 */
  searchTerm: string = '';
  
  // ==================== 모달 상태 관리 ====================
  
  /** 모달 열림 여부 */
  isModalOpen: boolean = false;
  
  /** 모달에 표시할 NPC */
  modalNPC: NPCProfile | null = null;
  
  /** 현재 활성화된 탭 ('character': 캐릭터 정보, 'products': 생산품) */
  activeTab: 'basic' | 'character' | 'products' = 'basic';
  
  // ==================== 이미지 관리 상태 ====================
  
  /** 각 NPC의 이미지 로딩 상태 */
  imageLoadingStates: Map<string, boolean> = new Map();
  
  /** 각 NPC의 개별 이미지 생성 중 상태 */
  generatingImageStates: Map<string, boolean> = new Map();
  
  /** 프리로드할 이미지 URL 맵 (부드러운 이미지 전환용) */
  preloadImages: Map<string, string> = new Map();
  
  /** 프리로드 이미지의 준비 상태 */
  preloadImageStates: Map<string, boolean> = new Map();
  
  /** 현재 이미지 생성 중인 NPC (waiting dialog 표시용) */
  currentGeneratingNPC: NPCProfile | null = null;

  // ==================== 계산된 속성 ====================
  
  /**
   * 사용 가능한 역할 목록을 반환합니다.
   * '전체' 옵션과 함께 현재 NPC들의 고유 역할들을 포함합니다.
   */
  get availableRoles(): string[] {
    const roles = ['전체', ...new Set(this.npcProfiles.map(npc => npc.role))];
    return roles;
  }

  /**
   * 필터링된 NPC 목록을 반환합니다.
   * 역할 필터와 검색어를 적용한 결과입니다.
   */
  get filteredNPCs(): NPCProfile[] {
    let filtered = this.npcProfiles;
    
    // 역할 필터 적용
    if (this.selectedRole !== '전체') {
      filtered = filtered.filter(npc => npc.role === this.selectedRole);
    }
    
    // 검색 필터 적용 (이름, 설명, 배경에서 검색)
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(npc => 
        npc.name.toLowerCase().includes(term) ||
        (npc.description?.toLowerCase().includes(term) ?? false) ||
        (npc.background?.toLowerCase().includes(term) ?? false)
      );
    }
    
    return filtered;
  }

  constructor(private gameWorldService: GameWorldService, private changeDetectorRef: ChangeDetectorRef) {}

  /**
   * @Input 프로퍼티 변경 시 호출됩니다.
   * @param changes 변경된 프로퍼티들
   */
  ngOnChanges(changes: SimpleChanges) {
    if (changes['npcProfiles'] && changes['npcProfiles'].currentValue) {
      // npcProfiles가 변경되었을 때 필요한 경우에만 생산품 생성
      const npcs = changes['npcProfiles'].currentValue as NPCProfile[];
      npcs.forEach(npc => {
        // 서버에서 받은 퀘스트가 이미 있는지 확인
        const hasServerQuests = npc.products && npc.products.some(product => 
          product.type === 'quest' && product.id.includes('_quest_')
        );
        
        // 서버 퀘스트가 없고 생산품 생성이 필요한 역할인 경우에만 생성
        if (this.shouldGenerateProducts(npc.role) && !hasServerQuests && (!npc.products || npc.products.length === 0)) {
          console.log(`Generating products for NPC ${npc.name} - no server quests found`);
          this.generateNPCProducts(npc);
        } else if (hasServerQuests) {
          console.log(`Skipping product generation for NPC ${npc.name} - already has server quests`);
        }
      });
      this.changeDetectorRef.detectChanges();
    }
  }

  /**
   * 컴포넌트 초기화
   */
  ngOnInit() {
    // 초기 로드시에만 실행
  }

  ngOnDestroy() {
    // 현재는 특별한 정리 작업이 없지만, 필요시 추가 가능
  }

  // ==================== 키보드 이벤트 처리 ====================
  
  /**
   * ESC 키 누름 시 모달을 닫습니다.
   * @param event 키보드 이벤트
   */
  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: Event) {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.key === 'Escape' && this.isModalOpen) {
      this.closeNPCModal();
    }
  }

  // ==================== 이미지 관리 메서드 ====================

  /**
   * 특정 NPC의 이미지가 로딩 중인지 확인합니다.
   * @param npcId NPC ID
   * @returns 로딩 중이면 true
   */
  isImageLoading(npcId: string): boolean {
    return this.imageLoadingStates.get(npcId) || false;
  }

  /**
   * 이미지 로딩 완료 시 호출됩니다.
   * @param npcId NPC ID
   */
  onImageLoad(npcId: string): void {
    this.imageLoadingStates.set(npcId, false);
  }

  /**
   * 이미지 로딩 실패 시 호출됩니다.
   * @param npcId NPC ID
   */
  onImageError(npcId: string): void {
    this.imageLoadingStates.set(npcId, false);
    console.warn(`Failed to load image for NPC ${npcId}`);
  }

  // ==================== 프리로딩 이미지 관리 ====================

  /**
   * 프리로딩할 이미지 URL을 가져옵니다.
   * @param npcId NPC ID
   * @returns 프리로딩 이미지 URL 또는 null
   */
  getPreloadImageUrl(npcId: string): string | null {
    return this.preloadImages.get(npcId) || null;
  }

  /**
   * 프리로딩 이미지가 준비되었는지 확인합니다.
   * @param npcId NPC ID
   * @returns 준비되었으면 true
   */
  isPreloadImageReady(npcId: string): boolean {
    return this.preloadImageStates.get(npcId) || false;
  }

  /**
   * 프리로딩 이미지가 준비되었을 때 호출됩니다.
   * 부드러운 전환 효과와 함께 기본 이미지를 교체합니다.
   * @param npcId NPC ID
   */
  onPreloadImageReady(npcId: string): void {
    this.preloadImageStates.set(npcId, true);
    
    // 부드러운 전환을 위해 약간의 지연 후 기본 이미지를 교체
    setTimeout(() => {
      const npc = this.npcProfiles.find(n => n.id === npcId);
      if (npc && this.preloadImages.has(npcId)) {
        npc.imageUrl = this.preloadImages.get(npcId)!;
        this.preloadImages.delete(npcId);
        this.preloadImageStates.delete(npcId);
      }
    }, 300); // fade-in 애니메이션 시간과 맞춤
  }

  /**
   * 프리로딩 이미지 로딩 실패 시 호출됩니다.
   * @param npcId NPC ID
   */
  onPreloadImageError(npcId: string): void {
    this.preloadImages.delete(npcId);
    this.preloadImageStates.delete(npcId);
    console.warn(`Failed to preload image for NPC ${npcId}`);
  }

  /**
   * 외부에서 호출 가능한 이미지 업데이트 메서드
   * 파이프라인이나 배치 처리에서 사용됩니다.
   * @param npcId 업데이트할 NPC ID
   * @param newImageUrl 새로운 이미지 URL
   */
  updateNPCImage(npcId: string, newImageUrl: string): void {
    const npc = this.npcProfiles.find(n => n.id === npcId);
    if (!npc) return;

    if (npc.imageUrl) {
      // 기존 이미지가 있으면 프리로딩으로 부드러운 전환
      this.preloadImages.set(npcId, newImageUrl);
      this.preloadImageStates.set(npcId, false);
    } else {
      // 기존 이미지가 없으면 직접 설정
      this.imageLoadingStates.set(npcId, true);
      npc.imageUrl = newImageUrl;
    }
    
    // 모달에 표시된 NPC가 업데이트된 NPC와 동일하다면 모달도 업데이트
    if (this.modalNPC && this.modalNPC.id === npcId) {
      this.modalNPC = { ...this.modalNPC, imageUrl: newImageUrl };
    }
  }

  /**
   * NPC 프로필 store 업데이트와 함께 모달 NPC도 업데이트하는 메서드
   * 개별 이미지 생성 완료 시 실시간 UI 업데이트용
   * @param npcId 업데이트할 NPC ID
   * @param newImageUrl 새로운 이미지 URL
   */
  updateNPCImageInStore(npcId: string, newImageUrl: string): void {
    // 로컬 npcProfiles 배열에서 해당 NPC 업데이트
    const npcIndex = this.npcProfiles.findIndex(n => n.id === npcId);
    if (npcIndex !== -1) {
      this.npcProfiles[npcIndex] = { ...this.npcProfiles[npcIndex], imageUrl: newImageUrl };
    }
    
    // 모달에 표시된 NPC가 업데이트된 NPC와 동일하다면 모달도 업데이트
    if (this.modalNPC && this.modalNPC.id === npcId) {
      this.modalNPC = { ...this.modalNPC, imageUrl: newImageUrl };
    }
    
    // 변경 감지 트리거
    this.changeDetectorRef.detectChanges();
  }

  // ==================== NPC 선택 및 상호작용 ====================

  /**
   * NPC를 선택하여 대화 화면으로 이동합니다.
   * @param npc 선택된 NPC
   */
  onSelectNPC(npc: NPCProfile) {
    this.npcSelected.emit(npc);
  }

  /**
   * 모든 NPC 이미지 생성 요청을 부모 컴포넌트로 전달합니다.
   */
  onGenerateImages() {
    this.generateImages.emit();
  }

  /**
   * 개별 NPC 이미지 생성 요청을 부모 컴포넌트로 전달합니다.
   * @param npc 이미지를 생성할 NPC
   */
  onGenerateSingleImage(npc: NPCProfile) {
    this.generateSingleImage.emit(npc);
  }

  /**
   * 특정 NPC가 이미지 생성 중인지 확인합니다.
   * @param npcId NPC ID
   * @returns 이미지 생성 중이면 true
   */
  isGeneratingImage(npcId: string): boolean {
    return this.generatingImageStates.get(npcId) || false;
  }
  
  /**
   * NPC 이미지 생성 시작 시 호출됩니다.
   * @param npc 이미지 생성을 시작할 NPC
   */
  startImageGeneration(npc: NPCProfile): void {
    this.generatingImageStates.set(npc.id, true);
    this.currentGeneratingNPC = npc;
  }
  
  /**
   * NPC 이미지 생성 완료 시 호출됩니다.
   * @param npcId 이미지 생성이 완료된 NPC ID
   */
  completeImageGeneration(npcId: string): void {
    this.generatingImageStates.set(npcId, false);
    if (this.currentGeneratingNPC?.id === npcId) {
      this.currentGeneratingNPC = null;
    }
  }

  // ==================== NPC 확장/축소 관리 ====================

  /**
   * NPC 카드의 확장/축소 상태를 토글합니다.
   * @param npcId 토글할 NPC ID
   */
  toggleNPCExpansion(npcId: string) {
    if (this.expandedNPCs.has(npcId)) {
      this.expandedNPCs.delete(npcId);
    } else {
      this.expandedNPCs.add(npcId);
    }
  }

  /**
   * NPC가 확장된 상태인지 확인합니다.
   * @param npcId NPC ID
   * @returns 확장되어 있으면 true
   */
  isNPCExpanded(npcId: string): boolean {
    return this.expandedNPCs.has(npcId);
  }

  // ==================== 생산품 관리 ====================

  /**
   * 특정 NPC의 생산품이 로딩 중인지 확인합니다.
   * @param npcId NPC ID
   * @returns 로딩 중이면 true
   */
  isLoadingProducts(npcId: string): boolean {
    return this.loadingProducts.has(npcId);
  }

  /**
   * 해당 역할이 생산품 생성이 필요한지 확인합니다.
   * 현재는 모든 NPC가 생산품을 가질 수 있도록 설정
   * @param role NPC 역할
   * @returns 생산품 생성이 필요하면 true
   */
  shouldGenerateProducts(role: string): boolean {
    return true; // 모든 NPC가 생산품 생성 가능
  }

  /**
   * NPC의 생산품을 생성합니다.
   * @param npc 생산품을 생성할 NPC
   */
  generateNPCProducts(npc: NPCProfile) {
    if (npc.products?.length) {
      return; // 이미 생산품이 있으면 생성하지 않음
    }

    this.loadingProducts.add(npc.id);
    
    this.gameWorldService.generateNPCProducts(npc.id, npc.role).subscribe({
      next: (products) => {
        // 로컬 npcProfiles 배열에서 해당 NPC를 찾아 업데이트
        const npcIndex = this.npcProfiles.findIndex(n => n.id === npc.id);
        if (npcIndex !== -1) {
          this.npcProfiles[npcIndex] = { ...this.npcProfiles[npcIndex], products };
          
          // 모달에 표시된 NPC도 업데이트
          if (this.modalNPC && this.modalNPC.id === npc.id) {
            this.modalNPC = { ...this.modalNPC, products };
          }
        }
        
        // GameWorldService에도 업데이트 (다른 컴포넌트와 동기화)
        this.gameWorldService.updateNPCWithProducts(npc.id, products);
        
        this.loadingProducts.delete(npc.id);
        this.changeDetectorRef.detectChanges();
      },
      error: (error) => {
        console.error('Error generating NPC products:', error);
        this.loadingProducts.delete(npc.id);
      }
    });
  }

  // ==================== 생산품 분류 메서드 ====================

  /**
   * NPC의 무기 목록을 가져옵니다.
   * @param npc NPC 프로필
   * @returns 무기 배열
   */
  getWeapons(npc: NPCProfile): Weapon[] {
    return (npc.products || []).filter(p => p.type === 'weapon') as Weapon[];
  }

  /**
   * NPC의 퀘스트 목록을 가져옵니다.
   * @param npc NPC 프로필
   * @returns 퀘스트 배열
   */
  getQuests(npc: NPCProfile): Quest[] {
    return (npc.products || []).filter(p => p.type === 'quest') as Quest[];
  }

  /**
   * NPC의 마법 목록을 가져옵니다.
   * @param npc NPC 프로필
   * @returns 마법 배열
   */
  getMagic(npc: NPCProfile): Magic[] {
    return (npc.products || []).filter(p => p.type === 'magic') as Magic[];
  }

  /**
   * NPC의 일반 아이템 목록을 가져옵니다.
   * @param npc NPC 프로필
   * @returns 아이템 배열
   */
  getItems(npc: NPCProfile): NPCProduct[] {
    return (npc.products || []).filter(p => p.type === 'item');
  }

  // ==================== NPC 선택 관련 메서드 ====================

  /**
   * NPC를 선택하여 상세 정보 모달을 엽니다.
   * @param npc 선택된 NPC
   */
  selectNPCForDetails(npc: NPCProfile): void {
    this.openNPCModal(npc);
  }

  /**
   * 선택된 NPC가 상세 정보 모달에 표시되는지 확인합니다.
   * @param npc 확인할 NPC
   * @returns 표시되면 true
   */
  isSelectedForDetails(npc: NPCProfile): boolean {
    return this.selectedNPCForDetails?.id === npc.id;
  }

  // ==================== 모달 관리 메서드 ====================

  /**
   * NPC 상세 정보 모달을 엽니다.
   * @param npc 표시할 NPC
   */
  openNPCModal(npc: NPCProfile): void {
    this.modalNPC = npc;
    this.isModalOpen = true;
    this.activeTab = 'character';
    // 생산품이 없으면 자동 생성
    if (this.shouldGenerateProducts(npc.role) && (!npc.products || npc.products.length === 0)) {
      this.generateNPCProducts(npc);
    }
    // 스크롤 방지
    document.body.style.overflow = 'hidden';
  }

  /**
   * NPC 상세 정보 모달을 닫습니다.
   */
  closeNPCModal(): void {
    this.isModalOpen = false;
    this.modalNPC = null;
    // 스크롤 복원
    document.body.style.overflow = '';
  }

  /**
   * 모달 배경 클릭 시 모달을 닫습니다.
   * @param event 클릭 이벤트
   */
  onModalBackgroundClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.closeNPCModal();
    }
  }

  // ==================== 탭 관리 메서드 ====================

  /**
   * 현재 활성화된 탭을 설정합니다.
   * @param tab 활성화할 탭
   */
  setActiveTab(tab: 'basic' | 'character' | 'products'): void {
    this.activeTab = tab;
  }

  /**
   * 특정 탭이 활성화되었는지 확인합니다.
   * @param tab 확인할 탭
   * @returns 활성화되었으면 true
   */
  isActiveTab(tab: 'basic' | 'character' | 'products'): boolean {
    return this.activeTab === tab;
  }

  // ==================== 성능 최적화를 위한 trackBy 함수 ====================

  /**
   * NPC ID를 기준으로 필터링된 인덱스를 반환합니다.
   * @param index 인덱스
   * @param npc NPC 프로필
   * @returns NPC ID
   */
  trackByNPCId(index: number, npc: NPCProfile): string {
    return npc.id;
  }

  // ==================== 생산품 보유 여부 확인 메서드 ====================

  /**
   * NPC가 무기를 보유하고 있는지 확인합니다.
   * @param npc NPC 프로필
   * @returns 무기가 있으면 true
   */
  hasWeapons(npc: NPCProfile): boolean {
    return this.getWeapons(npc).length > 0;
  }

  /**
   * NPC가 퀘스트를 보유하고 있는지 확인합니다.
   * @param npc NPC 프로필
   * @returns 퀘스트가 있으면 true
   */
  hasQuests(npc: NPCProfile): boolean {
    return this.getQuests(npc).length > 0;
  }

  /**
   * NPC가 마법을 보유하고 있는지 확인합니다.
   * @param npc NPC 프로필
   * @returns 마법이 있으면 true
   */
  hasMagic(npc: NPCProfile): boolean {
    return this.getMagic(npc).length > 0;
  }

  /**
   * NPC가 일반 아이템을 보유하고 있는지 확인합니다.
   * @param npc NPC 프로필
   * @returns 아이템이 있으면 true
   */
  hasItems(npc: NPCProfile): boolean {
    return this.getItems(npc).length > 0;
  }

  // ==================== UI 표시 유틸리티 메서드 ====================

  /**
   * NPC 역할에 따른 아이콘을 반환합니다.
   * @param role NPC의 역할
   * @returns 해당 역할의 이모지 아이콘
   */
  getRoleIcon(role: string): string {
    const icons = {
      '대장장이': '🔨',
      '길드 담당관': '📋',
      '마법사': '🔮',
      '상인': '💰',
      '모험가': '⚔️',
      '학자': '📚',
      '치료사': '💊',
      '연금술사': '⚗️',
      '도적': '🗡️',
      '궁수': '🏹',
      '기사': '🛡️',
      '농부': '🌾'
    };
    return icons[role as keyof typeof icons] || '👤';
  }

  /**
   * NPC 역할에 따른 테마 색상을 반환합니다.
   * @param role NPC의 역할
   * @returns 해당 역할의 색상 코드
   */
  getRoleColor(role: string): string {
    const colors = {
      '대장장이': '#ff6b35',
      '길드 담당관': '#4dabf7',
      '마법사': '#9775fa',
      '상인': '#ffd43b',
      '모험가': '#69db7c',
      '학자': '#74c0fc',
      '치료사': '#ff8cc8',
      '연금술사': '#51cf66',
      '도적': '#495057',
      '궁수': '#8ce99a',
      '기사': '#ffd43b',
      '농부': '#74c0fc'
    };
    return colors[role as keyof typeof colors] || 'var(--accent-color)';
  }

  /**
   * NPC가 보유한 생산품 유형에 따라 동적인 제목을 생성합니다.
   * @param npc NPC 프로필
   * @returns 생산품 제목 (예: "무기 & 퀘스트", "마법" 등)
   */
  getProductsTitle(npc: NPCProfile): string {
    const weapons = this.hasWeapons(npc);
    const quests = this.hasQuests(npc);
    const magic = this.hasMagic(npc);
    const items = this.hasItems(npc);

    const titles: string[] = [];
    
    if (weapons) titles.push('무기');
    if (quests) titles.push('퀘스트');
    if (magic) titles.push('마법');
    if (items) titles.push('아이템');

    if (titles.length === 0) return '생산품';
    if (titles.length === 1) return titles[0];
    return titles.join(' & ');
  }

  // ==================== 필터링 관련 메서드 ====================

  /**
   * 역할 필터를 변경합니다.
   * @param role 새로 선택된 역할
   */
  onRoleFilterChange(role: string): void {
    this.selectedRole = role;
    console.log('Role filter changed to:', role);
  }

  // ==================== 역할별 특별 기능 메서드 ====================

  /**
   * 대장장이인지 확인
   * @param npc NPC 프로필
   * @returns 대장장이이면 true
   */
  isBlacksmith(npc: NPCProfile): boolean {
    return npc.role === '대장장이';
  }

  /**
   * 마법스크롤 상인인지 확인
   * @param npc NPC 프로필
   * @returns 마법스크롤 상인이면 true
   */
  isMagicScrollMerchant(npc: NPCProfile): boolean {
    return npc.role === '마법스크롤 상인' || npc.role === '마법사';
  }

  /**
   * 길드 마스터인지 확인
   * @param npc NPC 프로필
   * @returns 길드 마스터이면 true
   */
  isGuildMaster(npc: NPCProfile): boolean {
    return npc.role === '길드 마스터' || npc.role === '길드 담당관';
  }

  /**
   * 대장장이 무기 제작 이벤트 처리
   * @param npc 대장장이 NPC
   */
  onCraftWeapon(npc: NPCProfile): void {
    console.log(`🔨 ${npc.name}에게 무기 제작을 요청합니다.`);
    this.craftWeapon.emit(npc);
  }

  /**
   * 마법스크롤 상인 주문 제작 이벤트 처리
   * @param npc 마법스크롤 상인 NPC
   */
  onCraftSpell(npc: NPCProfile): void {
    console.log(`📜 ${npc.name}에게 주문 제작을 요청합니다.`);
    this.craftSpell.emit(npc);
  }

  /**
   * 길드 마스터 퀘스트 의뢰 이벤트 처리
   * @param npc 길드 마스터 NPC
   */
  onAssignQuest(npc: NPCProfile): void {
    console.log(`📋 ${npc.name}에게 퀘스트 의뢰를 요청합니다.`);
    this.assignQuest.emit(npc);
  }

  // ==================== 새로운 대시보드 액션 메서드들 ====================

  /**
   * 이미지를 보유한 캐릭터 수를 반환합니다.
   */
  getCharactersWithImages(): number {
    return this.npcProfiles.filter(npc => npc.imageUrl).length;
  }

  /**
   * 이미지를 보유하지 않은 캐릭터 수를 반환합니다.
   */
  getCharactersWithoutImages(): number {
    return this.npcProfiles.filter(npc => !npc.imageUrl).length;
  }

  /**
   * 전체 NPC 이미지 생성을 요청합니다.
   */
  onGenerateAllImages(): void {
    if (this.isGeneratingImages) {
      return;
    }

    // 이미지가 없는 캐릭터들의 개수 확인
    const charactersWithoutImages = this.getCharactersWithoutImages();
    
    if (charactersWithoutImages === 0) {
      console.log('모든 캐릭터가 이미 이미지를 보유하고 있습니다.');
      return;
    }

    console.log(`${charactersWithoutImages}개 캐릭터의 이미지 생성을 시작합니다.`);
    
    // 부모 컴포넌트의 전체 이미지 생성 메서드 호출
    this.generateImages.emit();
  }

  /**
   * 캐릭터 목록을 새로고침합니다.
   */
  onRefreshCharacters(): void {
    // 현재 선택 상태 초기화
    this.selectedNPCForDetails = null;
    this.expandedNPCs.clear();
    this.closeNPCModal();
    
    // 이미지 관련 상태 초기화
    this.imageLoadingStates.clear();
    this.generatingImageStates.clear();
    this.preloadImages.clear();
    this.preloadImageStates.clear();
    
    console.log('캐릭터 목록이 새로고침되었습니다.');
    
    // 변경 감지 트리거
    this.changeDetectorRef.detectChanges();
  }
}
