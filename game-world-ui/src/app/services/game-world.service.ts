import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, of, delay, switchMap, throwError, catchError, map, forkJoin } from 'rxjs';
import { 
  GameWorld, 
  NPCProfile, 
  ChatMessage, 
  ChatSession, 
  NPCProduct, 
  Weapon, 
  Quest, 
  Magic, 
  QuestObjective, 
  QuestReward, 
  MagicEffect,
  WorldGenerationRequest,
  WorldGenerationResponse,
  FullGenerationRequest,
  FullGenerationResponse,
  ServerStatus,
  HistoryEra,
  SavedWorldData,
  SaveWorldRequest,
  SaveWorldResponse,
  LoadWorldResponse,
  WorldListResponse
} from '../models/game-world.interface';
import { WeaponCraftingService } from './weapon-crafting.service';
import { environment } from '../../environments/environment';
import { WorldGenerationOptions } from '../components/world-input/world-input';

@Injectable({
  providedIn: 'root'
})
export class GameWorldService {
  private currentWorldSubject = new BehaviorSubject<GameWorld | null>(null);
  private npcProfilesSubject = new BehaviorSubject<NPCProfile[]>([]);
  private chatSessionsSubject = new BehaviorSubject<ChatSession[]>([]);
  private historySubject = new BehaviorSubject<HistoryEra[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);

  currentWorld$ = this.currentWorldSubject.asObservable();
  npcProfiles$ = this.npcProfilesSubject.asObservable();
  chatSessions$ = this.chatSessionsSubject.asObservable();
  history$ = this.historySubject.asObservable();
  loading$ = this.loadingSubject.asObservable();

  private readonly API_URL = environment.apiUrl;
  private useServerAPI = true; // true: 서버 API 사용, false: Mock 데이터 사용

  constructor(
    private http: HttpClient,
    private weaponCraftingService: WeaponCraftingService
  ) {
    this.checkServerStatus();
  }

  /**
   * 서버 상태 확인
   */
  checkServerStatus(): Observable<ServerStatus> {
    return this.http.get<ServerStatus>(`${this.API_URL}/health`).pipe(
      map(status => {
        this.useServerAPI = status.status === 'healthy' || status.status === 'partial';
        console.log('Server Status:', status, 'Using API:', this.useServerAPI);
        return status;
      }),
      catchError(error => {
        this.useServerAPI = false;
        console.warn('Server unavailable, falling back to mock data:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * 세계관 생성 (서버 API 또는 Mock)
   */
  generateWorld(input: string): Observable<GameWorld> {
    if (this.useServerAPI) {
      return this.generateWorldFromAPI(input);
    } else {
      return this.generateMockWorld(input);
    }
  }

  /**
   * 서버 API를 통한 세계관 생성
   */
  private generateWorldFromAPI(input: string): Observable<GameWorld> {
    this.loadingSubject.next(true);
    
    const worldRequest: WorldGenerationRequest = {
      prompt: input,
      theme: this.extractTheme(input),
      setting: input,
      additionalInfo: this.extractConflict(input) + ', ' + this.extractUniqueElements(input),
      useWebSearch: true
    };

    return this.http.post<WorldGenerationResponse>(`${this.API_URL}/generate-world`, worldRequest).pipe(
      map(response => {
        if (response.success && response.world_data) {
          const world = response.world_data.world;
          const npcs = response.world_data.npcs;
          const history = response.world_data.lore;

          // 서버 데이터를 UI 모델에 맞춰 변환
          const gameWorld: GameWorld = {
            id: Date.now().toString(),
            originalInput: input,
            expandedWorldDescription: world.expandedWorldDescription,
            theme: world.theme,
            setting: world.setting,
            createdAt: new Date()
          };

          // NPC 데이터 변환 및 저장
          const convertedNPCs = npcs.map(npc => ({
            ...npc,
            description: npc.background || npc.personality,
            background: npc.background || '',
            appearance: npc.appearance_features || '',
            worldId: gameWorld.id,
            products: []
          }));

          this.updateNPCProfiles(convertedNPCs);
          this.historySubject.next(history);
          this.loadingSubject.next(false);

          return gameWorld;
        } else {
          throw new Error(response.error || 'World generation failed');
        }
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        console.error('API World generation failed, falling back to mock:', error);
        return this.generateMockWorld(input);
      })
    );
  }

  /**
   * 통합 생성 (세계관 + NPC 이미지)
   */
  generateFullWorld(input: string, generateImages: boolean = true): Observable<GameWorld> {
    if (!this.useServerAPI) {
      return this.generateMockWorld(input);
    }

    this.loadingSubject.next(true);
    
    const worldRequest: WorldGenerationRequest = {
      prompt: input,
      theme: this.extractTheme(input),
      setting: input,
      additionalInfo: this.extractConflict(input) + ', ' + this.extractUniqueElements(input),
      useWebSearch: true
    };

    const request: FullGenerationRequest = {
      world_request: worldRequest,
      generate_npc_images: generateImages,
      max_npc_images: 5
    };

    return this.http.post<FullGenerationResponse>(`${this.API_URL}/generate-full`, request).pipe(
      map(response => {
        if (response.success && response.world_data) {
          const world = response.world_data.world;
          const npcs = response.world_data.npcs;
          const history = response.world_data.lore;

          const gameWorld: GameWorld = {
            id: Date.now().toString(),
            originalInput: input,
            expandedWorldDescription: world.expandedWorldDescription,
            theme: world.theme,
            setting: world.setting,
            createdAt: new Date()
          };

          // NPC 이미지 URL 매핑
          const npcsWithImages = npcs.map(npc => {
            const imageData = response.npc_images.find(img => img.npc_id === npc.id);
            return {
              ...npc,
              description: npc.background || npc.personality,
              background: npc.background || '',
              appearance: npc.appearance_features || '',
              imageUrl: imageData ? imageData.image_url : undefined,
              worldId: gameWorld.id,
              products: []
            };
          });

          this.updateNPCProfiles(npcsWithImages);
          this.historySubject.next(history);
          this.loadingSubject.next(false);

          console.log(`Generated world with ${response.npc_images.length} NPC images`);
          return gameWorld;
        } else {
          throw new Error(response.message || 'Full generation failed');
        }
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        console.error('API Full generation failed, falling back to mock:', error);
        return this.generateMockWorld(input);
      })
    );
  }

  /**
   * Mock 세계관 생성 (기존 로직)
   */
  private generateMockWorld(input: string): Observable<GameWorld> {
    const mockWorld: GameWorld = {
      id: Date.now().toString(),
      originalInput: input,
      expandedWorldDescription: this.generateMockWorldDescription(input),
      theme: '사이버펑크',
      setting: '미래 도시',
      createdAt: new Date()
    };

    return of(mockWorld).pipe(
      delay(2000) // 로딩 시뮬레이션
    );
  }

  // 입력에서 테마 추출
  private extractTheme(input: string): string {
    const themes = ['fantasy', 'scifi', 'cyberpunk', 'medieval', 'modern', 'horror'];
    for (const theme of themes) {
      if (input.toLowerCase().includes(theme)) {
        return theme;
      }
    }
    return 'fantasy'; // 기본값
  }

  // 입력에서 설정 추출
  private extractSetting(input: string): string {
    // 간단한 키워드 기반 설정 추출
    if (input.includes('도시') || input.includes('마을')) return '도시';
    if (input.includes('숲') || input.includes('자연')) return '자연';
    if (input.includes('우주') || input.includes('행성')) return '우주';
    if (input.includes('바다') || input.includes('섬')) return '해양';
    return '미지의 세계';
  }

  // 입력에서 갈등 추출
  private extractConflict(input: string): string {
    if (input.includes('전쟁') || input.includes('war')) return '전쟁';
    if (input.includes('마법') || input.includes('magic')) return '마법 갈등';
    if (input.includes('기술') || input.includes('tech')) return '기술 갈등';
    return '선악 대립';
  }

  // 입력에서 독특한 요소 추출
  private extractUniqueElements(input: string): string {
    return input.split(' ').slice(-3).join(' '); // 마지막 3단어를 독특한 요소로
  }

  generateNPCs(worldId: string): Observable<NPCProfile[]> {
    // Mock data - 실제 구현에서는 API 호출
    const mockNPCs: NPCProfile[] = [
      {
        id: '1',
        name: '아이언마스터 코간',
        description: '베테랑 대장장이로 고품질 무기 제작 전문가',
        background: '30년간 철과 불을 다뤄온 숙련된 대장장이',
        personality: '과묵하지만 실력에 대한 자부심이 강함',
        role: '대장장이',
        appearance: '건장한 체격에 수염이 많고 화상 자국이 있는 손',
        worldId: worldId,
        products: [] // 나중에 생산품이 추가됨
      },
      {
        id: '2',
        name: '퀘스트마스터 엘리나',
        description: '모험가 길드의 퀘스트 담당관',
        background: '전직 모험가로 현재는 새로운 모험가들을 도움',
        personality: '친절하고 도움이 되려고 하지만 규칙에 엄격함',
        role: '길드 담당관',
        appearance: '단정한 길드 유니폼을 입고 항상 메모를 들고 다님',
        worldId: worldId,
        products: []
      },
      {
        id: '3',
        name: '아케인 세라핀',
        description: '고대 마법을 연구하는 마법사',
        background: '마법 대학에서 수십 년간 연구에 몰두',
        personality: '지적 호기심이 강하고 새로운 마법에 관심이 많음',
        role: '마법사',
        appearance: '긴 로브를 입고 항상 마법서를 들고 다님',
        worldId: worldId,
        products: []
      }
    ];

    return of(mockNPCs).pipe(
      delay(1500)
    );
  }

  generateNPCProducts(npcId: string, npcRole: string): Observable<NPCProduct[]> {
    let products: NPCProduct[] = [];

    // 현재 NPC가 이미 퀘스트를 가지고 있는지 확인
    const currentNPC = this.npcProfilesSubject.value.find(npc => npc.id === npcId);
    const hasExistingQuests = currentNPC?.products?.some(product => product.type === 'quest') || false;

    // 서버에서 받은 퀘스트가 없는 경우에만 Mock 퀘스트 생성
    if (!hasExistingQuests) {
      products.push(...this.generateQuests(npcId));
    }

    // 역할에 따른 추가 생산품
    switch (npcRole) {
      case '대장장이':
        return this.weaponCraftingService.generateWeaponsForNPC(npcId, npcRole).pipe(
          switchMap(weapons => {
            products.push(...weapons);
            return of(products).pipe(delay(1000));
          })
        );
      case '마법사':
      case '연금술사':
        products.push(...this.generateMagic(npcId));
        break;
      case '상인':
      case '농부':
        products.push(...this.generateItems(npcId));
        break;
      case '길드 담당관':
      case '길드 마스터':
        // 이미 퀘스트가 있는 경우에도 특별 퀘스트는 추가 (하지만 기본 퀘스트는 추가하지 않음)
        if (!hasExistingQuests) {
          products.push(...this.generateSpecialQuests(npcId));
        }
        break;
      case '치료사':
        products.push(...this.generateMagic(npcId)); // 치료 마법
        products.push(...this.generateItems(npcId)); // 치료 아이템
        break;
      case '모험가':
      case '기사':
        return this.weaponCraftingService.generateWeaponsForNPC(npcId, npcRole).pipe(
          switchMap(weapons => {
            products.push(...weapons);
            return of(products).pipe(delay(1000));
          })
        );
      case '도적':
      case '궁수':
        return this.weaponCraftingService.generateWeaponsForNPC(npcId, npcRole).pipe(
          switchMap(weapons => {
            products.push(...weapons);
            products.push(...this.generateItems(npcId));
            return of(products).pipe(delay(1000));
          })
        );
      case '학자':
      case '마도학자':
        products.push(...this.generateMagic(npcId));
        break;
      default:
        break;
    }

    return of(products).pipe(
      delay(1000)
    );
  }

  private generateQuests(npcId: string): Quest[] {
    return [
      {
        id: '1',
        npcId: npcId,
        type: 'quest',
        name: '고블린 소굴 정리',
        description: '상인들을 괴롭히는 고블린들을 처치하고 평화를 되찾아주세요',
        createdAt: new Date(),
        questType: 'side',
        difficulty: 'normal',
        estimatedTime: 120,
        objectives: [
          {
            id: '1',
            description: '고블린 우두머리 처치',
            type: 'kill',
            target: '고블린 우두머리',
            quantity: 1,
            completed: false
          },
          {
            id: '2',
            description: '훔쳐간 상품 회수',
            type: 'collect',
            target: '상인의 상품',
            quantity: 5,
            completed: false
          }
        ],
        rewards: [
          {
            type: 'gold',
            amount: 500
          },
          {
            type: 'experience',
            amount: 1200
          },
          {
            type: 'item',
            amount: 1,
            itemName: '고블린 우두머리의 반지'
          }
        ]
      },
      {
        id: '2',
        npcId: npcId,
        type: 'quest',
        name: '잃어버린 마법서 탐색',
        description: '고대 유적에서 잃어버린 마법서를 찾아주세요',
        createdAt: new Date(),
        questType: 'main',
        difficulty: 'hard',
        estimatedTime: 240,
        objectives: [
          {
            id: '1',
            description: '고대 유적 입구 발견',
            type: 'explore',
            target: '고대 유적',
            quantity: 1,
            completed: false
          }
        ],
        rewards: [
          {
            type: 'experience',
            amount: 2500
          },
          {
            type: 'item',
            amount: 1,
            itemName: '고대 마법서'
          }
        ]
      }
    ];
  }

  private generateMagic(npcId: string): Magic[] {
    return [
      {
        id: '1',
        npcId: npcId,
        type: 'magic',
        name: '화염구',
        description: '강력한 화염의 구체를 발사하는 마법',
        createdAt: new Date(),
        magicType: 'spell',
        school: '화염',
        level: 3,
        manaCost: 15,
        castingTime: '1 액션',
        duration: '즉시',
        range: '120 피트',
        components: ['언어', '신체', '재료 (황 덩어리)'],
        effects: [
          {
            type: 'damage',
            value: 28, // 8d6 평균
            description: '8d6 화염 피해'
          }
        ]
      },
      {
        id: '2',
        npcId: npcId,
        type: 'magic',
        name: '치료',
        description: '상처를 치유하는 기본적인 치료 마법',
        createdAt: new Date(),
        magicType: 'spell',
        school: '치유',
        level: 1,
        manaCost: 5,
        castingTime: '1 액션',
        duration: '즉시',
        range: '접촉',
        components: ['언어', '신체'],
        effects: [
          {
            type: 'heal',
            value: 9, // 1d8+1 평균
            description: '1d8+1 생명력 회복'
          }
        ]
      }
    ];
  }

  generateImages(npcIds: string[]): Observable<string[]> {
    // Mock image generation
    const mockImages = npcIds.map(id => `https://via.placeholder.com/300x400?text=NPC+${id}`);
    return of(mockImages).pipe(
      delay(3000) // 이미지 생성 시뮬레이션
    );
  }

  /**
   * 개별 NPC 이미지 생성
   */
  generateNPCImage(npc: NPCProfile): Observable<string> {
    if (!this.useServerAPI) {
      // Mock 이미지 반환
      return of(`https://via.placeholder.com/300x400?text=${npc.name}`).pipe(delay(2000));
    }

    const request = {
      name: npc.name,
      role: npc.role,
      gender: this.extractGender(npc),
      age: this.extractAge(npc),
      description: npc.description,
      personality: { traits: npc.personality || '친근함' },
      appearance_features: npc.appearance || '일반적인 외모'  // appearance_features로 수정
    };

    return this.http.post<any>(`${this.API_URL}/generate-npc-image`, request).pipe(
      map(response => {
        if (response.success && response.image_url) {
          console.log(`NPC 이미지 생성 완료: ${npc.name}`);
          console.log(`이미지 URL 타입:`, typeof response.image_url);
          console.log(`이미지 URL 길이:`, response.image_url.length);
          console.log(`이미지 URL 미리보기:`, response.image_url.substring(0, 100) + '...');
          
          // 즉시 NPC 프로필 업데이트
          this.updateNPCImageInStore(npc.id, response.image_url);
          
          return response.image_url;
        } else {
          throw new Error(response.error || 'NPC 이미지 생성 실패');
        }
      }),
      catchError(error => {
        console.error(`NPC 이미지 생성 실패 (${npc.name}):`, error);
        // 실패 시 플레이스홀더 이미지 반환
        return of(`https://via.placeholder.com/300x400?text=${encodeURIComponent(npc.name)}`);
      })
    );
  }

  /**
   * 여러 NPC 이미지를 배치로 생성
   */
  generateMultipleNPCImages(npcs: NPCProfile[]): Observable<{npcId: string, imageUrl: string}[]> {
    const imageRequests = npcs.map(npc => 
      this.generateNPCImage(npc).pipe(
        map(imageUrl => ({ npcId: npc.id, imageUrl })),
        catchError(error => {
          console.error(`NPC 이미지 생성 실패 (${npc.name}):`, error);
          return of({ npcId: npc.id, imageUrl: `https://via.placeholder.com/300x400?text=${encodeURIComponent(npc.name)}` });
        })
      )
    );

    // 모든 이미지 생성 요청을 병렬로 처리
    return forkJoin(imageRequests);
  }

  /**
   * NPC 데이터에서 성별 추출
   */
  private extractGender(npc: NPCProfile): string {
    const name = npc.name.toLowerCase();
    const desc = (npc.description + ' ' + npc.personality + ' ' + npc.appearance).toLowerCase();
    
    if (desc.includes('여성') || desc.includes('female') || desc.includes('그녀')) {
      return 'female';
    } else if (desc.includes('남성') || desc.includes('male') || desc.includes('그가')) {
      return 'male';
    } else {
      // 이름으로 추정
      const femaleNames = ['아리엘', '엘리나', '세라핀', '엘웬', '리라', '세렌', '카라'];
      const maleNames = ['코간', '마르노', '아샤르', '브루크', '녹스'];
      
      if (femaleNames.some(fname => name.includes(fname.toLowerCase()))) {
        return 'female';
      } else if (maleNames.some(mname => name.includes(mname.toLowerCase()))) {
        return 'male';
      }
      
      return 'unknown';
    }
  }

  /**
   * NPC 데이터에서 나이 추출
   */
  private extractAge(npc: NPCProfile): string {
    const desc = (npc.description + ' ' + npc.background + ' ' + npc.personality).toLowerCase();
    
    if (desc.includes('어린') || desc.includes('젊은') || desc.includes('youth')) {
      return 'young';
    } else if (desc.includes('늙은') || desc.includes('고령') || desc.includes('old') || desc.includes('veteran')) {
      return 'old';
    } else if (desc.includes('중년') || desc.includes('middle')) {
      return 'middle-aged';
    }
    
    return 'adult';
  }

  /**
   * 캐릭터와 메시지 주고받기
   */
  sendMessage(npcId: string, message: string): Observable<ChatMessage> {
    const payload = {
      npc_id: npcId,
      message: message
    };

    return this.http.post<any>(`${this.API_URL}/api/game-world/chat`, payload)
      .pipe(
        map((response: any) => {
          if (response.success) {
            return {
              id: Date.now().toString(),
              senderId: npcId,
              senderName: response.response?.character_name || 'NPC',
              content: response.response?.message || response.message,
              timestamp: new Date(),
              isUser: false
            };
          } else {
            throw new Error(response.message || 'Failed to send message');
          }
        }),
        catchError(this.handleError<ChatMessage>('sendMessage'))
      );
  }

  updateCurrentWorld(world: GameWorld): void {
    this.currentWorldSubject.next(world);
  }

  updateNPCProfiles(npcs: NPCProfile[]): void {
    this.npcProfilesSubject.next(npcs);
  }

  /**
   * 특정 NPC의 이미지를 즉시 업데이트
   */
  updateNPCImageInStore(npcId: string, imageUrl: string): void {
    const currentNPCs = this.npcProfilesSubject.value;
    const updatedNPCs = currentNPCs.map(npc => 
      npc.id === npcId ? { ...npc, imageUrl } : npc
    );
    this.npcProfilesSubject.next(updatedNPCs);
    console.log(`NPC ${npcId} 이미지 업데이트 완료`);
  }

  updateNPCWithProducts(npcId: string, products: NPCProduct[]): void {
    const currentNPCs = this.npcProfilesSubject.value;
    const updatedNPCs = currentNPCs.map(npc => 
      npc.id === npcId ? { ...npc, products } : npc
    );
    this.npcProfilesSubject.next(updatedNPCs);
  }

  private generateMockWorldDescription(input: string): string {
    return `${input}을 바탕으로 한 놀라운 세계가 펼쳐집니다. 이곳은 고도로 발달한 기술과 마법이 공존하는 독특한 공간입니다.`;
  }

  private getNPCName(npcId: string): string {
    const npc = this.npcProfilesSubject.value.find(n => n.id === npcId);
    return npc?.name || 'Unknown NPC';
  }

  private generateItems(npcId: string): NPCProduct[] {
    return [
      {
        id: '1',
        npcId: npcId,
        type: 'item',
        name: '치료 물약',
        description: '상처를 치유하는 마법의 물약',
        createdAt: new Date()
      },
      {
        id: '2',
        npcId: npcId,
        type: 'item',
        name: '마나 물약',
        description: '마법력을 회복시키는 파란색 물약',
        createdAt: new Date()
      }
    ];
  }

  private generateSpecialQuests(npcId: string): Quest[] {
    return [
      {
        id: '3',
        npcId: npcId,
        type: 'quest',
        name: '드래곤 토벌',
        description: '마을을 위협하는 고대 드래곤을 처치하세요',
        createdAt: new Date(),
        questType: 'epic',
        difficulty: 'extreme',
        estimatedTime: 480,
        objectives: [
          {
            id: '1',
            description: '고대 드래곤 처치',
            type: 'kill',
            target: '고대 드래곤',
            quantity: 1,
            completed: false
          }
        ],
        rewards: [
          {
            type: 'experience',
            amount: 10000
          },
          {
            type: 'gold',
            amount: 5000
          },
          {
            type: 'item',
            amount: 1,
            itemName: '드래곤의 심장'
          }
        ]
      }
    ];
  }

  generateWorldWithOptions(options: WorldGenerationOptions): Observable<GameWorld> {
    if (options.generationType === 'complex') {
      // 통합 생성: generate-full 엔드포인트 사용
      return this.generateFullWorldWithOptions(options);
    } else {
      // 기본 생성: generate-world-complex 엔드포인트 사용
      return this.generateComplexWorldWithOptions(options);
    }
  }

  /**
   * 복잡한 세계관 생성 (generate-world-complex 엔드포인트)
   */
  private generateComplexWorldWithOptions(options: WorldGenerationOptions): Observable<GameWorld> {
    this.loadingSubject.next(true);
    
    const worldRequest = {
      theme: options.theme || this.extractTheme(options.input),
      setting: options.setting || this.extractSetting(options.input),
      conflict: this.extractConflict(options.input),
      unique_elements: options.additionalInfo || this.extractUniqueElements(options.input),
      use_search: options.useWebSearch
    };

    return this.http.post<any>(`${this.API_URL}/generate-world-complex`, worldRequest).pipe(
      map(response => {
        if (response.success && response.world_data) {
          const world = response.world_data.world;
          const npcs = response.world_data.npcs;
          const history = response.world_data.lore;

          const gameWorld: GameWorld = {
            id: Date.now().toString(),
            originalInput: options.input,
            expandedWorldDescription: world.expandedWorldDescription || world.description || '세계관이 생성되었습니다.',
            theme: world.theme || options.theme || this.extractTheme(options.input),
            setting: world.setting || options.setting || this.extractSetting(options.input),
            createdAt: new Date()
          };

          // NPC 데이터가 있으면 변환하여 저장 (서버 퀘스트 정보 보존)
          if (options.includeNPCs && npcs && npcs.length > 0) {
            const convertedNPCs = npcs.map((npc: any) => {
              const baseNPC: NPCProfile = {
                id: (Date.now() + Math.random()).toString(),
                name: npc.name || 'Unknown NPC',
                role: npc.role || '모험가',
                description: npc.description || npc.background || 'No description',
                background: npc.background || '',
                appearance: npc.appearance || npc.appearance_features || '',
                personality: npc.personality || '',
                worldId: gameWorld.id,
                products: []
              };

              // 서버에서 받은 퀘스트 정보를 Quest 형태로 변환
              if (npc.quests && Array.isArray(npc.quests)) {
                const serverQuests: Quest[] = npc.quests.map((questTitle: string, index: number) => ({
                  id: `${baseNPC.id}_quest_${index}`,
                  npcId: baseNPC.id,
                  type: 'quest',
                  name: questTitle,
                  description: `${npc.name}이(가) 제공하는 ${questTitle} 퀘스트입니다.`,
                  createdAt: new Date(),
                  questType: 'side',
                  difficulty: this.getDifficultyByRole(npc.role),
                  estimatedTime: 120 + (index * 60),
                  objectives: [
                    {
                      id: '1',
                      description: questTitle,
                      type: 'custom',
                      target: questTitle,
                      quantity: 1,
                      completed: false
                    }
                  ],
                  rewards: [
                    {
                      type: 'experience',
                      amount: 1000 + (index * 500)
                    },
                    {
                      type: 'gold',
                      amount: 200 + (index * 100)
                    }
                  ]
                }));
                
                baseNPC.products = [...serverQuests];
              }

              return baseNPC;
            });
            
            this.updateNPCProfiles(convertedNPCs);
          }
          
          if (history) {
            this.historySubject.next(history);
          }
          
          this.loadingSubject.next(false);
          return gameWorld;
        } else {
          throw new Error(response.error || 'World generation failed');
        }
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        console.error('Complex world generation failed, falling back to mock:', error);
        return this.generateMockWorld(options.input);
      })
    );
  }

  /**
   * 통합 생성 (generate-full 엔드포인트)
   */
  private generateFullWorldWithOptions(options: WorldGenerationOptions): Observable<GameWorld> {
    this.loadingSubject.next(true);
    
    const worldRequest = {
      theme: options.theme || this.extractTheme(options.input),
      setting: options.setting || this.extractSetting(options.input),
      conflict: this.extractConflict(options.input),
      unique_elements: options.additionalInfo || this.extractUniqueElements(options.input),
      use_search: options.useWebSearch
    };

    const request = {
      world_request: worldRequest,
      generate_npc_images: options.includeNPCs,
      max_npc_images: options.npcCount
    };

    return this.http.post<any>(`${this.API_URL}/generate-full`, request).pipe(
      map(response => {
        if (response.success && response.world_data) {
          const world = response.world_data.world;
          const npcs = response.world_data.npcs;
          const history = response.world_data.lore;

          const gameWorld: GameWorld = {
            id: Date.now().toString(),
            originalInput: options.input,
            expandedWorldDescription: world.expandedWorldDescription || world.description || '세계관이 생성되었습니다.',
            theme: world.theme || options.theme || this.extractTheme(options.input),
            setting: world.setting || options.setting || this.extractSetting(options.input),
            createdAt: new Date()
          };

          // NPC 데이터가 있으면 변환하여 저장 (서버 퀘스트 정보 보존)
          if (options.includeNPCs && npcs && npcs.length > 0) {
            const convertedNPCs = npcs.map((npc: any) => {
              const baseNPC: NPCProfile = {
                id: (Date.now() + Math.random()).toString(),
                name: npc.name || 'Unknown NPC',
                role: npc.role || '모험가',
                description: npc.description || npc.background || 'No description',
                background: npc.background || '',
                appearance: npc.appearance || npc.appearance_features || '',
                personality: npc.personality || '',
                worldId: gameWorld.id,
                products: []
              };

              // 서버에서 받은 퀘스트 정보를 Quest 형태로 변환
              if (npc.quests && Array.isArray(npc.quests)) {
                const serverQuests: Quest[] = npc.quests.map((questTitle: string, index: number) => ({
                  id: `${baseNPC.id}_quest_${index}`,
                  npcId: baseNPC.id,
                  type: 'quest',
                  name: questTitle,
                  description: `${npc.name}이(가) 제공하는 ${questTitle} 퀘스트입니다.`,
                  createdAt: new Date(),
                  questType: 'side',
                  difficulty: this.getDifficultyByRole(npc.role),
                  estimatedTime: 120 + (index * 60),
                  objectives: [
                    {
                      id: '1',
                      description: questTitle,
                      type: 'custom',
                      target: questTitle,
                      quantity: 1,
                      completed: false
                    }
                  ],
                  rewards: [
                    {
                      type: 'experience',
                      amount: 1000 + (index * 500)
                    },
                    {
                      type: 'gold',
                      amount: 200 + (index * 100)
                    }
                  ]
                }));
                
                baseNPC.products = [...serverQuests];
              }

              return baseNPC;
            });
            
            this.updateNPCProfiles(convertedNPCs);
          }
          
          if (history) {
            this.historySubject.next(history);
          }
          
          this.loadingSubject.next(false);
          return gameWorld;
        } else {
          throw new Error(response.error || 'World generation failed');
        }
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        console.error('Full world generation failed, falling back to mock:', error);
        return this.generateMockWorld(options.input);
      })
    );
  }

  /**
   * 역할에 따른 퀘스트 난이도 결정
   */
  private getDifficultyByRole(role: string): 'easy' | 'normal' | 'hard' | 'extreme' | 'epic' {
    const roleDifficultyMap: { [key: string]: 'easy' | 'normal' | 'hard' | 'extreme' | 'epic' } = {
      '대장장이': 'normal',
      '마법사': 'hard',
      '길드 마스터': 'extreme',
      '공작': 'epic',
      '성기사단장': 'hard',
      '마도학자': 'normal',
      '정보상인': 'normal',
      '주술사': 'hard',
      '정찰대장': 'normal',
      '대사제': 'extreme'
    };
    
    return roleDifficultyMap[role] || 'normal';
  }

  // ==================== 세계관 저장/불러오기 기능 ====================

  /**
   * 현재 세계관 데이터를 저장합니다
   * @param name 저장할 이름
   * @param description 설명 (선택사항)
   * @returns 저장 결과
   */
  saveWorldData(name: string, description?: string): Observable<SaveWorldResponse> {
    console.log('🔍 [Service] saveWorldData 호출됨:', { name, description });
    
    const currentWorld = this.currentWorldSubject.value;
    const currentNPCs = this.npcProfilesSubject.value;
    const currentHistory = this.historySubject.value;

    console.log('📝 [Service] 현재 상태:', {
      world: currentWorld,
      npcs: currentNPCs,
      history: currentHistory
    });

    if (!currentWorld) {
      console.log('❌ [Service] 저장할 세계관 데이터가 없음');
      return throwError(() => new Error('저장할 세계관 데이터가 없습니다.'));
    }

    const saveRequest: SaveWorldRequest = {
      name,
      description,
      world: currentWorld,
      npcs: currentNPCs,
      history: currentHistory
    };

    console.log('📦 [Service] 저장 요청 생성:', saveRequest);

    // 서버 API 호출 (향후 구현)
    // return this.http.post<SaveWorldResponse>(`${this.baseUrl}/api/game-world/save`, saveRequest)
    //   .pipe(catchError(this.handleError<SaveWorldResponse>('saveWorldData')));

    // 임시로 localStorage 사용
    return this.saveToLocalStorage(saveRequest);
  }

  /**
   * 저장된 세계관 목록을 가져옵니다
   * @returns 저장된 세계관 목록
   */
  getSavedWorldList(): Observable<WorldListResponse> {
    console.log('🔍 [Service] getSavedWorldList 호출됨');
    
    // 서버 API 호출 (향후 구현)
    // return this.http.get<WorldListResponse>(`${this.baseUrl}/api/game-world/saves`)
    //   .pipe(catchError(this.handleError<WorldListResponse>('getSavedWorldList')));

    // 임시로 localStorage 사용
    return this.getFromLocalStorage();
  }

  /**
   * 저장된 세계관을 불러옵니다
   * @param worldId 불러올 세계관 ID
   * @returns 불러온 세계관 데이터
   */
  loadWorldData(worldId: string): Observable<LoadWorldResponse> {
    console.log('🔍 [Service] loadWorldData 호출됨. ID:', worldId);
    
    // 서버 API 호출 (향후 구현)
    // return this.http.get<LoadWorldResponse>(`${this.baseUrl}/api/game-world/load/${worldId}`)
    //   .pipe(catchError(this.handleError<LoadWorldResponse>('loadWorldData')));

    // 임시로 localStorage 사용
    return this.loadFromLocalStorage(worldId);
  }

  /**
   * 불러온 세계관 데이터를 현재 상태에 적용합니다
   * @param worldData 불러온 세계관 데이터
   */
  applyLoadedWorldData(worldData: SavedWorldData): void {
    console.log('🔍 [Service] applyLoadedWorldData 호출됨:', worldData);
    
    this.updateCurrentWorld(worldData.world);
    this.updateNPCProfiles(worldData.npcs);
    this.updateHistory(worldData.history);
    
    console.log('✅ [Service] 세계관 데이터 적용 완료');
    console.log('🌍 세계관 데이터 불러오기 완료:', worldData.name);
  }

  /**
   * 역사 데이터 업데이트
   */
  updateHistory(history: HistoryEra[]): void {
    this.historySubject.next(history);
  }

  /**
   * HTTP 에러 핸들러
   */
  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(`${operation} failed:`, error);
      // 기본값 반환
      return of(result as T);
    };
  }

  // ==================== localStorage 임시 구현 ====================

  private saveToLocalStorage(saveRequest: SaveWorldRequest): Observable<SaveWorldResponse> {
    console.log('🔍 [localStorage] saveToLocalStorage 시작:', saveRequest);
    
    return new Observable(observer => {
      try {
        const savedData: SavedWorldData = {
          id: Date.now().toString(),
          name: saveRequest.name,
          description: saveRequest.description,
          world: saveRequest.world,
          npcs: saveRequest.npcs,
          history: saveRequest.history,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        console.log('📦 [localStorage] 저장할 데이터 생성:', savedData);

        // 기존 저장 목록 가져오기
        const existingSaves = this.getLocalStorageWorldList();
        console.log('📋 [localStorage] 기존 저장 목록:', existingSaves);
        
        existingSaves.push(savedData);
        console.log('📋 [localStorage] 새로운 저장 목록:', existingSaves);

        // localStorage에 저장
        const dataToStore = JSON.stringify(existingSaves);
        console.log('💾 [localStorage] 저장할 JSON 크기:', dataToStore.length, 'characters');
        
        localStorage.setItem('savedWorlds', dataToStore);
        console.log('✅ [localStorage] localStorage에 저장 완료');

        // 저장 확인
        const verification = localStorage.getItem('savedWorlds');
        console.log('🔍 [localStorage] 저장 확인:', verification ? '성공' : '실패');

        const response: SaveWorldResponse = {
          success: true,
          message: '세계관이 성공적으로 저장되었습니다.',
          savedData
        };

        console.log('📤 [localStorage] 응답 전송:', response);
        observer.next(response);
        observer.complete();
      } catch (error) {
        console.error('❌ [localStorage] 저장 중 오류:', error);
        
        const response: SaveWorldResponse = {
          success: false,
          message: '세계관 저장 중 오류가 발생했습니다.',
          error: error instanceof Error ? error.message : String(error)
        };
        observer.next(response);
        observer.complete();
      }
    });
  }

  private getFromLocalStorage(): Observable<WorldListResponse> {
    console.log('🔍 [localStorage] getFromLocalStorage 시작');
    
    return new Observable(observer => {
      try {
        const worlds = this.getLocalStorageWorldList();
        console.log('📋 [localStorage] 불러온 세계관 목록:', worlds);
        
        const response: WorldListResponse = {
          success: true,
          message: '저장된 세계관 목록을 불러왔습니다.',
          worlds
        };
        
        console.log('📤 [localStorage] 응답 전송:', response);
        observer.next(response);
        observer.complete();
      } catch (error) {
        console.error('❌ [localStorage] 목록 로드 중 오류:', error);
        
        const response: WorldListResponse = {
          success: false,
          message: '저장된 세계관 목록을 불러오는데 실패했습니다.',
          worlds: [],
          error: error instanceof Error ? error.message : String(error)
        };
        observer.next(response);
        observer.complete();
      }
    });
  }

  private loadFromLocalStorage(worldId: string): Observable<LoadWorldResponse> {
    console.log('🔍 [localStorage] loadFromLocalStorage 시작. ID:', worldId);
    
    return new Observable(observer => {
      try {
        const worlds = this.getLocalStorageWorldList();
        console.log('📋 [localStorage] 전체 목록:', worlds);
        
        const worldData = worlds.find(w => w.id === worldId);
        console.log('🔍 [localStorage] 찾은 세계관:', worldData);

        if (worldData) {
          const response: LoadWorldResponse = {
            success: true,
            message: '세계관을 성공적으로 불러왔습니다.',
            worldData
          };
          console.log('📤 [localStorage] 성공 응답 전송:', response);
          observer.next(response);
        } else {
          console.log('❌ [localStorage] 해당 ID의 세계관을 찾을 수 없음');
          const response: LoadWorldResponse = {
            success: false,
            message: '해당 세계관을 찾을 수 없습니다.',
            error: 'World not found'
          };
          observer.next(response);
        }
        observer.complete();
      } catch (error) {
        console.error('❌ [localStorage] 불러오기 중 오류:', error);
        
        const response: LoadWorldResponse = {
          success: false,
          message: '세계관을 불러오는데 실패했습니다.',
          error: error instanceof Error ? error.message : String(error)
        };
        observer.next(response);
        observer.complete();
      }
    });
  }

  private getLocalStorageWorldList(): SavedWorldData[] {
    console.log('🔍 [localStorage] getLocalStorageWorldList 시작');
    
    try {
      const saved = localStorage.getItem('savedWorlds');
      console.log('📋 [localStorage] localStorage에서 가져온 원본:', saved);
      
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('📦 [localStorage] 파싱된 데이터:', parsed);
        
        // Date 객체 복원
        const restored = parsed.map((item: any) => ({
          ...item,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt)
        }));
        
        console.log('✅ [localStorage] Date 복원 완료:', restored);
        return restored;
      }
      
      console.log('📋 [localStorage] 저장된 데이터 없음, 빈 배열 반환');
      return [];
    } catch (error) {
      console.error('❌ [localStorage] 목록 파싱 중 오류:', error);
      return [];
    }
  }
} 