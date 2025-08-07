import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Subscription, interval } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

// NPC 보이스 매핑 서비스 추가
import { NpcVoiceMappingService } from '../../services/npc-voice-mapping.service';
// NPCProfile 인터페이스 추가
import { NPCProfile } from '../../models/game-world.interface';
// GameWorldService 추가 (NPC 프로필 업데이트용)
import { GameWorldService } from '../../services/game-world.service';

export interface VoiceActor {
  id: string;
  name: string;
  gender: string;
  description: string;
  sample_path?: string;
  total_duration?: number;
  file_count?: number;
}

export interface VoiceGenerationRequest {
  text: string;
  actor_id: string;
  speed?: number;
  pitch?: number;
  emotion?: string;
}

export interface VoiceGenerationResponse {
  success: boolean;
  message: string;
  audio_url?: string;
  audio_data?: string;
  generation_time?: number;
  error?: string;
}

export interface ServerStatus {
  status: string;
  message: string;
  actors_loaded: number;
  total_actors: number;
  model_loaded: boolean;
  uptime: string;
}

@Component({
  selector: 'app-voice-generator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './voice-generator.component.html',
  styleUrls: ['./voice-generator.component.scss']
})
export class VoiceGeneratorComponent implements OnInit, OnDestroy {
  @Input() npcName: string = '';
  @Input() npcRole: string = '';
  @Input() npcId: string = ''; // NPC ID 추가
  @Input() npcProfiles: NPCProfile[] = []; // NPC 프로필 목록 추가
  @Input() selectedNPC: NPCProfile | null = null; // 선택된 NPC 추가
  @Input() autoSelectActor: boolean = true;
  @Input() autoGenerateOnTextReceived: boolean = false; // 텍스트 수신 시 자동 생성 여부

  // 이벤트 출력
  @Output() voiceActorMapped = new EventEmitter<{npcId: string, voiceActorId: string, voiceActorName: string}>();

  // 상태 관리
  voiceActors: VoiceActor[] = [];
  selectedActor: VoiceActor | null = null;
  generatedAudioUrl: string | null = null;
  isGenerating: boolean = false;
  isLoadingActors: boolean = false;
  serverStatus: ServerStatus | null = null;
  isServerHealthy: boolean = false;

  // NPC 선택 관리
  currentSelectedNPC: NPCProfile | null = null;

  // 샘플 재생 관리
  currentPlayingSample: string | null = null;
  sampleAudios: Map<string, HTMLAudioElement> = new Map();

  // 입력 필드
  inputText: string = '';
  speed: number = 1.0;
  pitch: number = 0;
  emotion: string = 'neutral';

  // 에러 및 메시지
  errorMessage: string = '';
  successMessage: string = '';

  // 구독 관리
  private statusSubscription?: Subscription;
  private generationSubscription?: Subscription;

  // 서버 설정
  private readonly BASE_URL = '/api/voice';

  // 감정 옵션
  emotionOptions = [
    { value: 'neutral', label: '중립' },
    { value: 'happy', label: '기쁨' },
    { value: 'sad', label: '슬픔' },
    { value: 'angry', label: '분노' },
    { value: 'surprised', label: '놀람' },
    { value: 'calm', label: '차분함' }
  ];

  constructor(
    private http: HttpClient,
    private npcVoiceMappingService: NpcVoiceMappingService, // NPC 보이스 매핑 서비스 추가
    private gameWorldService: GameWorldService // GameWorldService 추가 (NPC 프로필 업데이트용)
  ) {}

  ngOnInit() {
    this.initializeComponent();
  }

  ngOnDestroy() {
    this.cleanup();
  }

  private async initializeComponent() {
    console.log('VoiceGenerator 초기화 시작');
    
    // 초기 선택된 NPC 설정
    this.currentSelectedNPC = this.selectedNPC;
    
    // 서버 상태 확인 및 주기적 모니터링 시작
    await this.checkServerHealth();
    this.startStatusMonitoring();
    
    // 음성 배우 목록 로드
    await this.loadVoiceActors();
    
    // NPC 정보가 있으면 자동 선택
    if (this.currentSelectedNPC && this.autoSelectActor) {
      this.autoSelectActorForNPC();
    } else if (this.npcName && this.autoSelectActor) {
      this.autoSelectActorForNPC();
    }
  }

  private cleanup() {
    if (this.statusSubscription) {
      this.statusSubscription.unsubscribe();
    }
    if (this.generationSubscription) {
      this.generationSubscription.unsubscribe();
    }
    
    // 생성된 오디오 URL 정리
    if (this.generatedAudioUrl) {
      URL.revokeObjectURL(this.generatedAudioUrl);
    }

    // 샘플 오디오 정리
    this.stopAllSamples();
    this.sampleAudios.clear();
  }

  // ==================== 서버 상태 관리 ====================

  private async checkServerHealth(): Promise<void> {
    try {
      console.log('서버 상태 확인 중...');
      const response = await this.http.get<ServerStatus>(`${this.BASE_URL}/health`).toPromise();
      
      if (response) {
        this.serverStatus = response;
        this.isServerHealthy = response.status === 'healthy';
        console.log('서버 상태:', response);
        
        if (!this.isServerHealthy) {
          this.errorMessage = `서버 상태: ${response.message}`;
        }
      }
    } catch (error) {
      console.error('서버 상태 확인 실패:', error);
      this.isServerHealthy = false;
      this.errorMessage = '음성 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.';
    }
  }

  private startStatusMonitoring() {
    // 30초마다 서버 상태 확인
    this.statusSubscription = interval(30000)
      .pipe(
        switchMap(() => this.http.get<ServerStatus>(`${this.BASE_URL}/health`)),
        catchError(error => {
          console.error('상태 모니터링 에러:', error);
          return of(null);
        })
      )
      .subscribe(status => {
        if (status) {
          this.serverStatus = status;
          this.isServerHealthy = status.status === 'healthy';
        } else {
          this.isServerHealthy = false;
        }
      });
  }

  // ==================== 음성 배우 관리 ====================

  private async loadVoiceActors(): Promise<void> {
    if (!this.isServerHealthy) {
      console.log('서버가 준비되지 않아 음성 배우 로드를 건너뜁니다.');
      return;
    }

    this.isLoadingActors = true;
    this.errorMessage = '';

    try {
      console.log('음성 배우 목록 로드 중...');
      const actors = await this.http.get<VoiceActor[]>(`${this.BASE_URL}/actors`).toPromise();
      
      if (actors) {
        this.voiceActors = actors;
        console.log(`음성 배우 ${actors.length}명 로드 완료:`, actors);
        
        if (actors.length === 0) {
          this.errorMessage = '사용 가능한 음성 배우가 없습니다.';
        }
      }
    } catch (error) {
      console.error('음성 배우 로드 실패:', error);
      this.handleError(error, '음성 배우 목록을 불러오는데 실패했습니다.');
    } finally {
      this.isLoadingActors = false;
    }
  }

  private autoSelectActorForNPC() {
    if (this.voiceActors.length === 0) return;

    // 1. NPC ID가 있으면 매핑 서비스에서 보이스 ID 확인
    if (this.npcId) {
      const voiceId = this.npcVoiceMappingService.getVoiceIdForNPC(this.npcId);
      if (voiceId) {
        const mappedActor = this.voiceActors.find(actor => actor.id === voiceId);
        if (mappedActor) {
          this.selectedActor = mappedActor;
          console.log(`NPC "${this.npcName}" (ID: ${this.npcId})에 매핑된 음성 배우 선택:`, mappedActor);
          return;
        }
      }
    }

    // 2. 기존 역할 기반 자동 선택 로직
    const roleGenderMap: Record<string, string> = {
      '대장장이': 'male',
      '길드 담당관': 'female',
      '마법사': 'female',
      '상인': 'male',
      '모험가': 'male',
      '학자': 'male',
      '치료사': 'female',
      '연금술사': 'female',
      '도적': 'male',
      '궁수': 'female',
      '기사': 'male',
      '농부': 'male'
    };

    const preferredGender = roleGenderMap[this.npcRole] || 'male';
    
    // 선호 성별의 배우 찾기
    let candidate = this.voiceActors.find(actor => 
      actor.gender.toLowerCase() === preferredGender.toLowerCase()
    );
    
    // 선호 성별이 없으면 첫 번째 배우 선택
    if (!candidate && this.voiceActors.length > 0) {
      candidate = this.voiceActors[0];
    }
    
    if (candidate) {
      this.selectedActor = candidate;
      console.log(`NPC "${this.npcName}" (${this.npcRole})에 대해 자동 선택된 음성 배우:`, candidate);
    }
  }

  // ==================== 음성 생성 ====================

  async generateVoice() {
    if (!this.selectedActor || !this.inputText.trim()) {
      this.errorMessage = '음성 배우와 텍스트를 모두 선택해주세요.';
      return;
    }

    if (!this.isServerHealthy) {
      this.errorMessage = '서버가 준비되지 않았습니다. 잠시 후 다시 시도해주세요.';
      return;
    }

    this.isGenerating = true;
    this.errorMessage = '';
    this.successMessage = '';

    // 이전 오디오 URL 정리
    if (this.generatedAudioUrl) {
      URL.revokeObjectURL(this.generatedAudioUrl);
      this.generatedAudioUrl = null;
    }

    const request: VoiceGenerationRequest = {
      text: this.inputText.trim(),
      actor_id: this.selectedActor.id,
      speed: this.speed,
      pitch: this.pitch,
      emotion: this.emotion
    };

    try {
      console.log('음성 생성 요청:', request);
      
      const response = await this.http.post<VoiceGenerationResponse>(
        `${this.BASE_URL}/generate`,
        request
      ).toPromise();

      if (response) {
        await this.handleGenerationResponse(response);
      }
    } catch (error) {
      console.error('음성 생성 실패:', error);
      this.handleError(error, '음성 생성에 실패했습니다.');
    } finally {
      this.isGenerating = false;
    }
  }

  private async handleGenerationResponse(response: VoiceGenerationResponse) {
    if (response.success && response.audio_url) {
      console.log('=== 오디오 응답 처리 시작 ===');
      console.log('서버 응답:', response);
      
      // 여러 URL 형태 시도
      const urlsToTry = this.generateAudioUrls(response.audio_url);
      console.log('시도할 URL들:', urlsToTry);
      
      for (let i = 0; i < urlsToTry.length; i++) {
        const audioUrl = urlsToTry[i];
        console.log(`URL 시도 ${i + 1}/${urlsToTry.length}: ${audioUrl}`);
        
        try {
          const success = await this.tryLoadAudio(audioUrl, i + 1);
          if (success) {
            this.successMessage = `음성이 성공적으로 생성되었습니다! (${response.generation_time?.toFixed(2)}초 소요, 방법 ${i + 1} 사용)`;
            console.log('=== 오디오 로드 성공 ===');
            return;
          }
        } catch (error) {
          console.warn(`URL ${i + 1} 실패:`, error);
          continue;
        }
      }
      
      // 모든 방법 실패
      console.error('=== 모든 오디오 로드 방법 실패 ===');
      this.errorMessage = '생성된 음성 파일을 불러오는데 실패했습니다. 여러 방법을 시도했지만 모두 실패했습니다.';
      
    } else {
      this.errorMessage = response.error || '음성 생성에 실패했습니다.';
    }
  }

  private generateAudioUrls(originalUrl: string): string[] {
    const filename = originalUrl.split('/').pop() || '';
    const urls = [];
    
    // 방법 1: 프록시를 통한 접근
    if (originalUrl.startsWith('/api/voice/audio/')) {
      urls.push(originalUrl);
    } else {
      urls.push(`/api/voice/audio/${filename}`);
    }
    
    // 방법 2: 직접 서버 접근 (개발 환경)
    urls.push(`http://localhost:5001/api/voice/audio/${filename}`);
    
    // 방법 3: 상대 경로 변형들
    if (originalUrl.startsWith('audio/')) {
      urls.push(`/api/voice/${originalUrl}`);
    }
    
    // 방법 4: 원본 URL 그대로
    if (!urls.includes(originalUrl)) {
      urls.push(originalUrl);
    }
    
    return urls;
  }

  private async tryLoadAudio(audioUrl: string, methodNumber: number): Promise<boolean> {
    console.log(`방법 ${methodNumber}: ${audioUrl} 시도 중...`);
    
    try {
      // 1단계: HEAD 요청으로 파일 존재 확인
      const headResponse = await fetch(audioUrl, { method: 'HEAD' });
      console.log(`HEAD 응답 (방법 ${methodNumber}):`, headResponse.status, headResponse.statusText);
      
      if (!headResponse.ok) {
        throw new Error(`HEAD 요청 실패: ${headResponse.status}`);
      }
      
      // 2단계: 강화된 다운로드 메서드 사용
      const audioBlob = await this.downloadAudioBlob(audioUrl);
      
      if (audioBlob && audioBlob.size > 0) {
        // 이전 URL 정리
        if (this.generatedAudioUrl) {
          URL.revokeObjectURL(this.generatedAudioUrl);
        }
        
        this.generatedAudioUrl = URL.createObjectURL(audioBlob);
        console.log(`오디오 로드 성공 (방법 ${methodNumber}):`, {
          url: this.generatedAudioUrl,
          blobSize: audioBlob.size,
          blobType: audioBlob.type
        });
        
        // 자동으로 오디오 엘리먼트 설정
        setTimeout(() => this.setupAudioElement(), 100);
        return true;
      } else {
        // 3단계: 직접 URL 할당 시도 (Blob 실패 시)
        console.log(`Blob 실패, 직접 URL 시도 (방법 ${methodNumber})`);
        this.generatedAudioUrl = audioUrl;
        
        // 오디오 엘리먼트로 검증
        const isPlayable = await this.testAudioPlayability(audioUrl);
        if (isPlayable) {
          console.log(`직접 URL 검증 성공 (방법 ${methodNumber})`);
          setTimeout(() => this.setupAudioElement(), 100);
          return true;
        } else {
          console.log(`직접 URL 검증 실패 (방법 ${methodNumber})`);
        }
      }
      
    } catch (error) {
      console.error(`방법 ${methodNumber} 전체 실패:`, error);
    }
    
    return false;
  }

  private async testAudioPlayability(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      const testAudio = new Audio(url);
      const timeout = setTimeout(() => {
        testAudio.remove();
        resolve(false);
      }, 5000);
      
      testAudio.addEventListener('loadedmetadata', () => {
        clearTimeout(timeout);
        testAudio.remove();
        resolve(true);
      });
      
      testAudio.addEventListener('error', () => {
        clearTimeout(timeout);
        testAudio.remove();
        resolve(false);
      });
      
      testAudio.load();
    });
  }

  // 오디오 엘리먼트 설정
  private setupAudioElement() {
    const audioElement = document.querySelector('.audio-element') as HTMLAudioElement;
    if (audioElement && this.generatedAudioUrl) {
      audioElement.load(); // 오디오 엘리먼트 다시 로드
      console.log('오디오 엘리먼트 설정 완료:', audioElement.src);
    }
  }

  // ==================== 테스트 및 유틸리티 ====================

  async testGeneration() {
    const testTexts = [
      '안녕하세요! 저는 게임 월드의 NPC입니다.',
      '무엇을 도와드릴까요?',
      '모험가님, 환영합니다!'
    ];

    const randomText = testTexts[Math.floor(Math.random() * testTexts.length)];
    this.inputText = randomText;
    
    await this.generateVoice();
  }

  async refreshActors() {
    await this.loadVoiceActors();
  }

  async refreshServerStatus() {
    await this.checkServerHealth();
  }

  setNPCContext(name: string, role: string) {
    this.npcName = name;
    this.npcRole = role;
    
    if (this.autoSelectActor) {
      this.autoSelectActorForNPC();
    }
    
    // NPC 컨텍스트에 맞는 기본 텍스트 설정
    this.inputText = `안녕하세요, 저는 ${name}입니다. 저는 ${role}로 일하고 있어요.`;
  }

  // ==================== NPC 연동 메서드 ====================

  /**
   * NPC 채팅 응답을 받았을 때 자동으로 음성 생성
   */
  async generateVoiceForNPCResponse(responseText: string, npcId?: string): Promise<void> {
    // NPC ID 업데이트
    if (npcId && npcId !== this.npcId) {
      this.npcId = npcId;
      // 매핑된 보이스 배우로 자동 선택
      this.autoSelectActorForNPC();
    }

    // 텍스트 설정 및 음성 생성
    this.inputText = responseText;
    await this.generateVoice();
  }

  /**
   * NPC 정보 설정 (확장된 버전)
   */
  setNPCContextExtended(npcId: string, name: string, role: string) {
    this.npcId = npcId;
    this.npcName = name;
    this.npcRole = role;
    
    // 매핑된 보이스 배우 선택
    if (this.autoSelectActor) {
      this.autoSelectActorForNPC();
    }
    
    // NPC 컨텍스트에 맞는 기본 텍스트 설정
    this.inputText = `안녕하세요, 저는 ${name}입니다. 저는 ${role}로 일하고 있어요.`;
  }

  /**
   * 현재 선택된 NPC의 보이스 매핑 정보 확인
   */
  getCurrentNPCVoiceMapping() {
    if (!this.npcId) return null;
    return this.npcVoiceMappingService.getVoiceMappingForNPC(this.npcId);
  }

  /**
   * 현재 NPC에 음성 배우 매핑
   */
  mapCurrentNPCToVoice() {
    if (!this.npcId || !this.selectedActor || !this.npcName || !this.npcRole) {
      this.errorMessage = 'NPC 정보와 선택된 음성 배우가 필요합니다.';
      return;
    }

    const mapping = {
      npcId: this.npcId,
      npcName: this.npcName,
      npcRole: this.npcRole,
      voiceActorId: this.selectedActor.id,
      voiceActorName: this.selectedActor.name,
      gender: this.selectedActor.gender,
      personality: this.selectedActor.description || '일반',
      isCustom: true
    };

    this.npcVoiceMappingService.setVoiceMapping(mapping);
    this.successMessage = `${this.npcName}에게 ${this.selectedActor.name} 목소리가 매핑되었습니다.`;
    
    setTimeout(() => {
      this.successMessage = '';
    }, 3000);

    // 이벤트 emit (필요한 필드만 포함)
    this.voiceActorMapped.emit({
      npcId: this.npcId,
      voiceActorId: this.selectedActor.id,
      voiceActorName: this.selectedActor.name
    });
  }

  /**
   * 빠른 NPC 음성 생성 (채팅 시스템에서 사용)
   */
  async quickGenerateForNPC(npcId: string, responseText: string): Promise<string | null> {
    try {
      // NPC 매핑 확인
      const voiceId = this.npcVoiceMappingService.getVoiceIdForNPC(npcId);
      if (!voiceId) {
        console.warn(`NPC ${npcId}에 매핑된 음성 배우가 없습니다.`);
        return null;
      }

      // 음성 배우 확인
      const voiceActor = this.voiceActors.find(actor => actor.id === voiceId);
      if (!voiceActor) {
        console.warn(`음성 배우 ${voiceId}를 찾을 수 없습니다.`);
        return null;
      }

      // 빠른 음성 생성 요청
      const request = {
        text: responseText.trim(),
        actor_id: voiceId,
        speed: this.speed,
        pitch: this.pitch,
        emotion: this.emotion
      };

      const response = await this.http.post<VoiceGenerationResponse>(
        `${this.BASE_URL}/generate`,
        request
      ).toPromise();

      if (response && response.success && response.audio_url) {
        return response.audio_url;
      }

      return null;
    } catch (error) {
      console.error('빠른 NPC 음성 생성 실패:', error);
      return null;
    }
  }

  // ==================== 게터 메서드 확장 ====================

  get hasNPCMapping(): boolean {
    return !!this.npcId && !!this.npcVoiceMappingService.getVoiceIdForNPC(this.npcId);
  }

  get npcMappingInfo(): string {
    if (!this.hasNPCMapping) return '매핑 없음';
    
    const mapping = this.getCurrentNPCVoiceMapping();
    if (mapping) {
      return `${mapping.voiceActorName} (${mapping.isCustom ? '수동' : '자동'})`;
    }
    
    return '매핑 정보 없음';
  }

  // ==================== 이벤트 핸들러 ====================

  onActorSelect(actor: VoiceActor) {
    console.log('음성 배우 선택:', actor);
    this.selectedActor = actor;
    
    // 선택된 NPC가 있다면 음성 배우 정보를 NPC 프로필에 저장
    if (this.currentSelectedNPC) {
      this.assignVoiceActorToNPC(this.currentSelectedNPC, actor);
    }
    
    this.clearMessages();
  }

  /**
   * NPC에 음성 배우 할당 및 프로필 업데이트
   */
  private assignVoiceActorToNPC(npc: NPCProfile, actor: VoiceActor) {
    console.log(`NPC ${npc.name}에 음성 배우 ${actor.name} 할당`);
    
    // NPC 프로필에 음성 정보 추가
    const updatedNPC = {
      ...npc,
      voiceActor: actor.name,
      voiceGender: actor.gender as 'male' | 'female',
      voiceStyle: this.generateVoiceStyleFromNPC(npc, actor)
    };
    
    // GameWorldService를 통해 NPC 프로필 업데이트
    this.updateNPCProfile(updatedNPC);
    
    // 로컬 상태 업데이트
    this.currentSelectedNPC = updatedNPC;
    
    // 성공 메시지 표시
    this.successMessage = `${npc.name}의 목소리를 ${actor.name}으로 설정했습니다.`;
    
    // 음성 배우 매핑 이벤트 emit
    this.voiceActorMapped.emit({
      npcId: npc.id!,
      voiceActorId: actor.id,
      voiceActorName: actor.name
    });
    
    console.log('NPC 음성 정보 업데이트 완료:', {
      npcName: npc.name,
      voiceActor: actor.name,
      voiceGender: actor.gender,
      voiceStyle: updatedNPC.voiceStyle
    });
    
    console.log('음성 배우 매핑 이벤트 발생:', {
      npcId: npc.id,
      voiceActorId: actor.id,
      voiceActorName: actor.name
    });
  }

  /**
   * NPC와 음성 배우 정보를 바탕으로 음성 스타일 생성
   */
  private generateVoiceStyleFromNPC(npc: NPCProfile, actor: VoiceActor): string {
    const personality = npc.personality?.toLowerCase() || '';
    const role = npc.role?.toLowerCase() || '';
    
    // 역할과 성격에 따른 스타일 매핑
    if (role.includes('대장장이') || role.includes('전사')) {
      return '강인하고 거친';
    } else if (role.includes('마법사') || role.includes('학자')) {
      return '지혜롭고 신비한';
    } else if (role.includes('상인') || role.includes('길드')) {
      return '친근하고 상업적인';
    } else if (role.includes('귀족') || role.includes('왕족')) {
      return '위엄있고 고상한';
    } else if (personality.includes('친근') || personality.includes('밝은')) {
      return '친근하고 따뜻한';
    } else if (personality.includes('냉정') || personality.includes('차가운')) {
      return '차분하고 냉정한';
    } else if (personality.includes('신중') || personality.includes('조심스러운')) {
      return '신중하고 사려깊은';
    }
    
    return '자연스럽고 균형잡힌';
  }

  /**
   * GameWorldService를 통한 NPC 프로필 업데이트
   */
  private updateNPCProfile(updatedNPC: NPCProfile) {
    // 현재 NPC 목록을 가져와서 해당 NPC만 업데이트
    this.gameWorldService.npcProfiles$.subscribe(currentNPCs => {
      const updatedNPCs = currentNPCs.map(npc => 
        npc.id === updatedNPC.id ? updatedNPC : npc
      );
      this.gameWorldService.updateNPCProfiles(updatedNPCs);
    }).unsubscribe(); // 일회성 구독이므로 즉시 해제
  }

  onSpeedChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.speed = parseFloat(target.value);
  }

  onPitchChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.pitch = parseInt(target.value);
  }

  downloadAudio() {
    if (!this.generatedAudioUrl) return;

    const link = document.createElement('a');
    link.href = this.generatedAudioUrl;
    link.download = `voice_${this.selectedActor?.id || 'generated'}_${Date.now()}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // 오디오 재생 관련 추가 메서드들
  async playAudio() {
    const audioElement = document.querySelector('.audio-element') as HTMLAudioElement;
    if (audioElement) {
      try {
        // 브라우저 자동재생 정책 우회를 위한 사용자 상호작용 확인
        await audioElement.play();
        console.log('오디오 재생 시작');
      } catch (error: any) {
        console.error('오디오 재생 실패:', error);
        
        // Chrome 자동재생 정책 에러인 경우
        if (error.name === 'NotAllowedError') {
          this.errorMessage = '브라우저 자동재생 정책으로 인해 재생이 차단되었습니다. 브라우저 설정을 확인하거나 사용자 상호작용 후 재시도해주세요.';
        } else {
          this.errorMessage = `오디오 재생에 실패했습니다: ${error.message || error}`;
        }
      }
    } else {
      this.errorMessage = '오디오 엘리먼트를 찾을 수 없습니다.';
    }
  }

  pauseAudio() {
    const audioElement = document.querySelector('.audio-element') as HTMLAudioElement;
    if (audioElement) {
      audioElement.pause();
      console.log('오디오 일시정지');
    }
  }

  // 강제 오디오 재생 시도 (사용자 상호작용으로 인한 호출)
  async forcePlayAudio() {
    if (!this.generatedAudioUrl) {
      this.errorMessage = '재생할 오디오가 없습니다.';
      return;
    }

    try {
      // 새로운 Audio 객체 생성하여 재생 시도
      const audio = new Audio(this.generatedAudioUrl);
      
      audio.addEventListener('loadstart', () => console.log('오디오 로드 시작'));
      audio.addEventListener('canplay', () => console.log('오디오 재생 준비 완료'));
      audio.addEventListener('error', (e) => {
        console.error('Audio 객체 에러:', e);
        this.errorMessage = '오디오 파일 로드에 실패했습니다.';
      });
      
      await audio.play();
      this.successMessage = '오디오 재생이 시작되었습니다.';
      console.log('Audio 객체로 재생 성공');
      
    } catch (error: any) {
      console.error('Audio 객체 재생 실패:', error);
      this.errorMessage = `Audio 재생 실패: ${error.message || error}`;
    }
  }

  async testAudioUrl() {
    if (!this.generatedAudioUrl) return;
    
    try {
      console.log('오디오 URL 테스트:', this.generatedAudioUrl);
      
      // URL이 유효한지 테스트
      const response = await fetch(this.generatedAudioUrl, { method: 'HEAD' });
      if (response.ok) {
        console.log('오디오 URL 접근 성공');
        this.successMessage = '오디오 파일에 정상적으로 접근할 수 있습니다.';
      } else {
        console.error('오디오 URL 접근 실패:', response.status);
        this.errorMessage = `오디오 파일 접근 실패 (${response.status})`;
      }
    } catch (error) {
      console.error('오디오 URL 테스트 실패:', error);
      this.errorMessage = '오디오 파일 테스트에 실패했습니다.';
    }
  }

  // 오디오 메타데이터 로드 이벤트 핸들러
  onAudioLoadedMetadata(event: Event) {
    const audio = event.target as HTMLAudioElement;
    console.log('오디오 메타데이터 로드됨:', {
      duration: audio.duration,
      src: audio.src
    });
  }

  // 오디오 로드 에러 핸들러
  onAudioError(event: Event) {
    const audio = event.target as HTMLAudioElement;
    console.error('오디오 로드 에러:', audio.error);
    this.errorMessage = '오디오 파일을 불러올 수 없습니다. 파일이 손상되었거나 접근할 수 없습니다.';
  }

  // 오디오 재생 완료 핸들러
  onAudioEnded(event: Event) {
    console.log('오디오 재생 완료');
  }

  // 디버깅 관련 메서드들
  async debugAudioGeneration() {
    console.log('=== 오디오 생성 디버깅 시작 ===');
    console.log('서버 상태:', this.serverStatus);
    console.log('선택된 배우:', this.selectedActor);
    console.log('입력 텍스트:', this.inputText);
    console.log('현재 오디오 URL:', this.generatedAudioUrl);
    
    if (this.generatedAudioUrl) {
      console.log('오디오 엘리먼트 찾기...');
      const audioElement = document.querySelector('.audio-element') as HTMLAudioElement;
      if (audioElement) {
        console.log('오디오 엘리먼트 정보:', {
          src: audioElement.src,
          readyState: audioElement.readyState,
          networkState: audioElement.networkState,
          error: audioElement.error,
          duration: audioElement.duration,
          paused: audioElement.paused
        });
      } else {
        console.log('오디오 엘리먼트를 찾을 수 없습니다.');
      }
    }
    
    console.log('=== 오디오 생성 디버깅 완료 ===');
  }

  get debugInfo(): any {
    return {
      serverHealthy: this.isServerHealthy,
      serverStatus: this.serverStatus,
      selectedActor: this.selectedActor,
      hasAudio: this.hasAudio,
      audioUrl: this.generatedAudioUrl,
      voiceActorsCount: this.voiceActors.length,
      isGenerating: this.isGenerating
    };
  }

  clearMessages() {
    this.errorMessage = '';
    this.successMessage = '';
  }

  // ==================== 에러 처리 ====================

  private handleError(error: any, defaultMessage: string) {
    console.error('에러 발생:', error);
    
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        this.errorMessage = '서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.';
      } else if (error.status >= 500) {
        this.errorMessage = `서버 오류 (${error.status}): ${error.error?.message || '서버에서 문제가 발생했습니다.'}`;
      } else if (error.status >= 400) {
        this.errorMessage = `요청 오류 (${error.status}): ${error.error?.message || '잘못된 요청입니다.'}`;
      } else {
        this.errorMessage = defaultMessage;
      }
    } else {
      this.errorMessage = defaultMessage;
    }
  }

  // ==================== 게터 메서드 ====================

  get canGenerate(): boolean {
    return !this.isGenerating && 
           this.isServerHealthy && 
           !!this.selectedActor && 
           !!this.inputText.trim();
  }

  get hasAudio(): boolean {
    return !!this.generatedAudioUrl;
  }

  get serverStatusText(): string {
    if (!this.serverStatus) return '상태 불명';
    
    if (this.serverStatus.status === 'healthy') {
      return `정상 (배우 ${this.serverStatus.actors_loaded}/${this.serverStatus.total_actors}, 업타임: ${this.serverStatus.uptime})`;
    } else {
      return `${this.serverStatus.status}: ${this.serverStatus.message}`;
    }
  }

  get speedPercentage(): number {
    return Math.round(this.speed * 100);
  }

  // 강화된 오디오 다운로드 메서드
  private async downloadAudioBlob(url: string): Promise<Blob | null> {
    const headers = {
      'Accept': 'audio/wav, audio/*, */*',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };

    try {
      console.log(`오디오 다운로드 시도: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: headers,
        mode: 'cors',
        credentials: 'same-origin'
      });

      console.log('Fetch 응답:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      console.log('Blob 정보:', {
        size: blob.size,
        type: blob.type
      });

      if (blob.size === 0) {
        throw new Error('빈 파일입니다.');
      }

      return blob;
    } catch (error) {
      console.error(`Fetch 오디오 다운로드 실패 (${url}):`, error);
      
      // Angular HttpClient로 재시도
      try {
        console.log(`HttpClient로 재시도: ${url}`);
        const blob = await this.http.get(url, { 
          responseType: 'blob',
          headers: headers
        }).toPromise();
        
        if (blob && blob.size > 0) {
          console.log('HttpClient 다운로드 성공:', blob.size, 'bytes');
          return blob;
        }
      } catch (httpError) {
        console.error('HttpClient도 실패:', httpError);
      }
      
      return null;
    }
  }

  // ==================== 샘플 음성 재생 ====================

  async playSample(actor: VoiceActor) {
    try {
      // 현재 재생 중인 샘플이 있으면 정지
      if (this.currentPlayingSample && this.currentPlayingSample !== actor.id) {
        this.stopSample(this.currentPlayingSample);
      }

      // 이미 재생 중인 샘플이면 정지
      if (this.currentPlayingSample === actor.id) {
        this.stopSample(actor.id);
        return;
      }

      console.log(`🎵 샘플 재생 시작: ${actor.name} (${actor.id})`);
      
      // 여러 URL 형태 시도
      const urlsToTry = [
        `/api/voice/actors/${actor.id}/sample`,                    // 프록시 경로
        `http://localhost:5001/api/voice/actors/${actor.id}/sample`, // 직접 서버 접근
      ];
      
      let audioBlob: Blob | null = null;
      let workingUrl = '';
      
      // URL별로 Blob 다운로드 시도
      for (const testUrl of urlsToTry) {
        try {
          console.log(`🔍 Blob 다운로드 시도: ${testUrl}`);
          
          const response = await fetch(testUrl, {
            method: 'GET',
            headers: {
              'Accept': 'audio/wav, audio/*, */*'
            }
          });
          
          if (response.ok) {
            audioBlob = await response.blob();
            console.log(`✅ Blob 다운로드 성공: ${audioBlob.size} bytes, ${audioBlob.type}`);
            
            // Blob 타입이 올바른지 확인
            if (audioBlob.size > 0 && 
                (audioBlob.type.startsWith('audio/') || audioBlob.type === 'application/octet-stream')) {
              workingUrl = testUrl;
              break;
            } else {
              console.warn(`⚠️ 잘못된 Blob 타입: ${audioBlob.type}`);
              audioBlob = null;
            }
          } else {
            console.log(`❌ 응답 실패: ${testUrl} (${response.status})`);
          }
        } catch (error) {
          console.log(`❌ Blob 다운로드 오류: ${testUrl}`, error);
        }
      }
      
      if (!audioBlob) {
        throw new Error('모든 URL에서 오디오 데이터를 다운로드할 수 없습니다.');
      }
      
      // 기존 오디오 객체 완전 제거
      const existingAudio = this.sampleAudios.get(actor.id);
      if (existingAudio) {
        // 모든 이벤트 리스너 제거
        existingAudio.pause();
        existingAudio.currentTime = 0;
        if (existingAudio.src && existingAudio.src.startsWith('blob:')) {
          URL.revokeObjectURL(existingAudio.src);
        }
        existingAudio.src = '';
        existingAudio.load();
        
        // Map에서 제거
        this.sampleAudios.delete(actor.id);
      }
      
      // 새로운 오디오 객체 생성
      const audio = new Audio();
      let hasStartedPlaying = false;
      let hasError = false;
      
      // 이벤트 리스너 설정 (한 번만)
      const onLoadStart = () => {
        console.log(`📥 샘플 로드 시작: ${actor.name}`);
      };
      
      const onLoadedMetadata = () => {
        console.log(`📊 샘플 메타데이터 로드: ${actor.name}, 길이: ${audio.duration}초`);
      };
      
      const onCanPlay = () => {
        console.log(`▶️ 샘플 재생 준비: ${actor.name}`);
      };
      
      const onPlaying = () => {
        if (!hasStartedPlaying) {
          hasStartedPlaying = true;
          console.log(`🎵 샘플 재생 시작됨: ${actor.name}`);
        }
      };
      
      const onEnded = () => {
        console.log(`✅ 샘플 재생 완료: ${actor.name}`);
        this.currentPlayingSample = null;
        this.cleanupAudio(actor.id, audio);
      };
      
      const onError = (e: Event) => {
        // 이미 재생이 시작되었거나 정상 종료된 경우 에러 무시
        if (hasStartedPlaying || this.currentPlayingSample !== actor.id || hasError) {
          return;
        }
        
        hasError = true;
        console.error(`❌ 샘플 재생 오류: ${actor.name}`);
        
        // 실제 오디오 에러인 경우만 상세 로그
        if (audio.error) {
          console.error('오디오 오류 상세:', {
            code: audio.error.code,
            message: audio.error.message,
            networkState: audio.networkState,
            readyState: audio.readyState
          });
          
          // 에러 코드별 메시지
          let errorMessage = '';
          switch (audio.error.code) {
            case MediaError.MEDIA_ERR_ABORTED:
              errorMessage = '재생이 중단되었습니다';
              break;
            case MediaError.MEDIA_ERR_NETWORK:
              errorMessage = '네트워크 오류가 발생했습니다';
              break;
            case MediaError.MEDIA_ERR_DECODE:
              errorMessage = '오디오 디코딩 오류가 발생했습니다';
              break;
            case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
              errorMessage = '지원되지 않는 오디오 형식입니다';
              break;
            default:
              errorMessage = '알 수 없는 오디오 오류가 발생했습니다';
          }
          
          this.errorMessage = `${actor.name} 샘플 재생 실패: ${errorMessage}`;
        }
        
        this.currentPlayingSample = null;
        this.cleanupAudio(actor.id, audio);
      };
      
      // 이벤트 리스너 등록
      audio.addEventListener('loadstart', onLoadStart, { once: true });
      audio.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
      audio.addEventListener('canplay', onCanPlay, { once: true });
      audio.addEventListener('playing', onPlaying, { once: true });
      audio.addEventListener('ended', onEnded, { once: true });
      audio.addEventListener('error', onError, { once: true });

      // 오디오 객체를 Map에 저장
      this.sampleAudios.set(actor.id, audio);

      // Blob URL 생성 및 설정
      const blobUrl = URL.createObjectURL(audioBlob);
      console.log(`🎯 Blob URL 생성: ${blobUrl.substring(0, 50)}...`);
      
      audio.preload = 'metadata';
      audio.src = blobUrl;
      
      console.log(`🚀 재생 시도: ${actor.name}`);
      
      // 재생 시도
      await audio.play();
      this.currentPlayingSample = actor.id;
      console.log(`🎵 샘플 재생 중: ${actor.name}`);
      
    } catch (error: any) {
      console.error('🚫 샘플 재생 완전 실패:', error);
      
      // 상세 오류 정보 제공
      if (error.name === 'NotAllowedError') {
        this.errorMessage = `브라우저 자동재생 정책으로 인해 재생이 차단되었습니다. 페이지와 상호작용 후 다시 시도해주세요.`;
      } else if (error.name === 'NotSupportedError') {
        this.errorMessage = `오디오 형식이 지원되지 않습니다: ${actor.name}. 서버나 파일에 문제가 있을 수 있습니다.`;
      } else if (error.message?.includes('network')) {
        this.errorMessage = `네트워크 오류로 샘플을 불러올 수 없습니다: ${actor.name}`;
      } else {
        this.errorMessage = `샘플 재생에 실패했습니다: ${actor.name} (${error.message})`;
      }
      
      this.currentPlayingSample = null;
    }
  }

  private cleanupAudio(actorId: string, audio: HTMLAudioElement) {
    // Blob URL 정리
    if (audio.src && audio.src.startsWith('blob:')) {
      URL.revokeObjectURL(audio.src);
    }
    
    // 오디오 객체 정리
    audio.src = '';
    audio.load();
    
    // Map에서 제거
    this.sampleAudios.delete(actorId);
  }

  stopSample(actorId: string) {
    const audio = this.sampleAudios.get(actorId);
    if (audio) {
      audio.pause();
      this.cleanupAudio(actorId, audio);
    }
    
    if (this.currentPlayingSample === actorId) {
      this.currentPlayingSample = null;
    }
    
    console.log(`🛑 샘플 정지: ${actorId}`);
  }

  stopAllSamples() {
    this.sampleAudios.forEach((audio, actorId) => {
      audio.pause();
      this.cleanupAudio(actorId, audio);
    });
    this.currentPlayingSample = null;
    console.log('🛑 모든 샘플 정지');
  }

  isSamplePlaying(actorId: string): boolean {
    return this.currentPlayingSample === actorId;
  }

  // 샘플 재생 테스트 및 디버깅
  async testSampleUrls() {
    if (this.voiceActors.length === 0) {
      this.errorMessage = '테스트할 음성 배우가 없습니다.';
      return;
    }

    const testActor = this.voiceActors[0];
    console.log('🧪 샘플 URL 테스트 시작:', testActor);

    const urlsToTest = [
      `/api/voice/actors/${testActor.id}/sample`,
      `http://localhost:5001/api/voice/actors/${testActor.id}/sample`,
    ];

    for (const url of urlsToTest) {
      try {
        console.log(`🔍 테스트 중: ${url}`);
        
        // HEAD 요청 테스트
        const headResponse = await fetch(url, { method: 'HEAD' });
        console.log(`HEAD 응답: ${headResponse.status} ${headResponse.statusText}`);
        console.log('헤더:', Object.fromEntries(headResponse.headers.entries()));
        
        if (headResponse.ok) {
          // GET 요청 테스트
          const getResponse = await fetch(url, { method: 'GET' });
          console.log(`GET 응답: ${getResponse.status} ${getResponse.statusText}`);
          
          if (getResponse.ok) {
            const blob = await getResponse.blob();
            console.log(`Blob 크기: ${blob.size} bytes, 타입: ${blob.type}`);
            this.successMessage = `URL 테스트 성공: ${url} (${blob.size} bytes)`;
            return;
          }
        }
      } catch (error) {
        console.error(`URL 테스트 실패: ${url}`, error);
      }
    }

    this.errorMessage = '모든 샘플 URL 테스트가 실패했습니다.';
  }

  // 서버 연결 테스트
  async testServerConnection() {
    try {
      console.log('서버 연결 테스트 중...');
      const testData = {
        text: '테스트 음성입니다.',
        actor_id: this.voiceActors[0]?.id || 'test_actor'
      };
      
      const response = await this.http.post<VoiceGenerationResponse>(`${this.BASE_URL}/generate`, testData).toPromise();
      
      if (response && response.success) {
        this.successMessage = '서버 연결 테스트 성공!';
        console.log('서버 연결 테스트 성공:', response);
      } else {
        this.errorMessage = '서버 연결 테스트 실패: ' + (response?.message || '알 수 없는 오류');
      }
    } catch (error) {
      this.errorMessage = '서버 연결 테스트 실패: ' + error;
      console.error('서버 연결 테스트 에러:', error);
    }
  }

  // ==================== NPC 선택 관리 ====================

  onNPCSelect(npc: NPCProfile) {
    console.log('NPC 선택됨:', npc);
    this.currentSelectedNPC = npc;
    this.clearMessages();
    
    // 플레이스홀더 텍스트 업데이트
    this.inputText = `안녕하세요, 저는 ${npc.name}입니다. ${npc.role}로서 이 지역을 지키고 있습니다.`;
    
    // 기존에 할당된 음성 배우가 있다면 자동 선택
    if (npc.voiceActor) {
      const existingActor = this.voiceActors.find(actor => actor.name === npc.voiceActor);
      if (existingActor) {
        this.selectedActor = existingActor;
        this.successMessage = `${npc.name}의 기존 음성 배우 ${npc.voiceActor}가 선택되었습니다.`;
        console.log('기존 음성 배우 자동 선택:', existingActor);
      } else {
        // 음성 배우가 목록에 없는 경우 (서버에서 배우 목록이 변경된 경우)
        console.warn(`NPC ${npc.name}에 할당된 음성 배우 ${npc.voiceActor}을 찾을 수 없습니다.`);
        this.autoSelectActorForNPC();
      }
    } else {
      // 할당된 음성 배우가 없다면 자동 선택 시도
      if (this.autoSelectActor) {
        this.autoSelectActorForNPC();
      }
    }
  }

  clearNPCSelection() {
    this.currentSelectedNPC = null;
    this.npcName = '';
    this.npcRole = '';
    this.npcId = '';
    this.inputText = '';
    console.log('NPC 선택 해제됨');
  }

  get hasNPCProfiles(): boolean {
    return this.npcProfiles && this.npcProfiles.length > 0;
  }

  get filteredNPCProfiles(): NPCProfile[] {
    return this.npcProfiles.filter(npc => npc.name && npc.name.trim());
  }
} 