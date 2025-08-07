import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewChecked, OnInit, OnDestroy, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { NPCProfile, ChatMessage } from '../../models/game-world.interface';
import { NPCDialogueService, DialogueMessage, QuestOffer, QueueItem, QueueStatus } from '../../services/npc-dialogue.service';

@Component({
  selector: 'app-chat-interface',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-interface.html',
  styleUrls: ['./chat-interface.scss']
})
export class ChatInterfaceComponent implements OnInit, OnDestroy, OnChanges, AfterViewChecked {
  @Input() selectedNPC: NPCProfile | null = null;
  @Input() npcProfiles: NPCProfile[] = []; // NPC 목록 추가
  @Output() messageSent = new EventEmitter<string>();
  @Output() questAccepted = new EventEmitter<QuestOffer>();
  @Output() questRejected = new EventEmitter<QuestOffer>();

  @ViewChild('chatContainer') chatContainer!: ElementRef;
  @ViewChild('messageInput') messageInput!: ElementRef;

  currentMessage = '';
  isTyping = false;
  isServerConnected = false;
  
  // 메시지 전송 중복 방지를 위한 플래그 추가
  isSendingMessage = false;
  
  // 로컬 대화 메시지 (UI 표시용)
  chatMessages: DialogueMessage[] = [];
  
  // 퀘스트 제공 상태
  pendingQuestOffer: QuestOffer | null = null;
  showQuestDialog = false;

  // 음성 재생 관련 상태
  currentPlayingMessageId: string | null = null;
  playingAudios = new Map<string, HTMLAudioElement>();

  currentPlayingVoice: string | null = null;
  currentPlayingAudio: HTMLAudioElement | null = null;

  // SadTalker 관련 상태
  private currentTalkingVideoUrl: string | null = null;
  private isVideoPlaying: boolean = false;
  private videoLoadingStates = new Map<string, boolean>(); // 메시지별 비디오 로딩 상태
  private selectedVideoMessage: DialogueMessage | null = null; // 현재 선택된 비디오 메시지

  // 큐 상태 관련
  queueItems: QueueItem[] = [];
  queueStatus: QueueStatus = {
    size: 0,
    processing: false,
    current: null,
    voiceSize: 0,
    videoSize: 0,
    voiceProcessing: false,
    videoProcessing: false
  };

  private destroy$ = new Subject<void>();

  constructor(
    private npcDialogueService: NPCDialogueService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['selectedNPC']) {
      this.selectedNPC = changes['selectedNPC'].currentValue;
      if (this.selectedNPC) {
        this.loadNPCSession(this.selectedNPC);
        this.npcDialogueService.selectNPC(this.selectedNPC);
      }
    }

    // npcProfiles 변경 감지 (세계관 불러오기 시)
    if (changes['npcProfiles']) {
      const currentProfiles = changes['npcProfiles'].currentValue;
      const previousProfiles = changes['npcProfiles'].previousValue;
      
      console.log('NPC 프로필 변경 감지:', {
        current: currentProfiles?.length || 0,
        previous: previousProfiles?.length || 0
      });

      // 세계관 불러오기 등으로 npcProfiles가 새로 로드된 경우
      if (currentProfiles && currentProfiles.length > 0) {
        // 이전에 NPC가 없었거나 완전히 다른 세계관인 경우
        if (!previousProfiles || previousProfiles.length === 0) {
          console.log('새 세계관의 NPC들이 로드됨 - UI 갱신');
          
          // 현재 선택된 NPC가 새 목록에 없으면 선택 해제
          if (this.selectedNPC && !currentProfiles.find((npc: NPCProfile) => npc.id === this.selectedNPC!.id)) {
            this.selectedNPC = null;
            this.chatMessages = [];
            this.currentMessage = '';
            this.isTyping = false;
            this.isSendingMessage = false;
            this.npcDialogueService.selectNPC(null);
            console.log('기존 선택 NPC가 새 세계관에 없어서 선택 해제');
          }
          
          // UI 변경 감지를 수동으로 트리거
          this.cdr.detectChanges();
        }
      }
    }
  }

  ngOnInit() {
    // NPC 대화 세션 구독
    this.npcDialogueService.sessions$
      .pipe(takeUntil(this.destroy$))
      .subscribe(sessions => {
        if (this.selectedNPC) {
          const session = sessions.get(this.selectedNPC.id);
          if (session) {
            this.chatMessages = [...session];
            // 새로운 talking video 확인
            this.checkForNewTalkingVideo();
          }
        }
      });

    // 서버 연결 상태 구독
    this.npcDialogueService.isConnected$
      .pipe(takeUntil(this.destroy$))
      .subscribe(connected => {
        this.isServerConnected = connected;
        if (!connected) {
          console.warn('NPC 서버에 연결할 수 없습니다.');
        }
      });

    // 선택된 NPC 변경 시 세션 로드
    this.npcDialogueService.selectedNPC$
      .pipe(takeUntil(this.destroy$))
      .subscribe(npc => {
        if (npc && npc.id !== this.selectedNPC?.id) {
          this.loadNPCSession(npc);
        }
      });

    // 큐 상태 구독
    this.npcDialogueService.getQueueStatus$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(queueItems => {
        this.queueItems = queueItems;
        this.queueStatus = this.npcDialogueService.getCurrentQueueStatus();
      });

    // 초기 로드: 이미 선택된 NPC가 있다면 세션 로드
    if (this.selectedNPC) {
      this.loadNPCSession(this.selectedNPC);
      // 선택된 NPC를 서비스에도 알림
      this.npcDialogueService.selectNPC(this.selectedNPC);
    }

    // 초기 서버 헬스 체크
    this.checkServerConnection();
  }

  ngOnDestroy() {
    this.stopAllVoices();
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  /**
   * 서버 연결 상태 확인
   */
  private checkServerConnection() {
    this.npcDialogueService.checkServerHealth().subscribe({
      next: (health) => {
        console.log('NPC 서버 연결됨:', health);
      },
      error: (error) => {
        console.error('NPC 서버 연결 실패:', error);
      }
    });
  }

  /**
   * NPC 세션 로드
   */
  private loadNPCSession(npc: NPCProfile) {
    const npcId = `npc_${npc.id}`;
    this.chatMessages = this.npcDialogueService.getLocalSession(npcId);
    this.selectedNPC = npc;
  }

  /**
   * NPC 선택 (UI에서 직접 선택)
   */
  selectNPC(npc: NPCProfile): void {
    if (this.selectedNPC?.id === npc.id) {
      return; // 이미 선택된 NPC
    }

    console.log(`NPC 선택: ${npc.name}`);
    this.selectedNPC = npc;
    this.loadNPCSession(npc);
    this.npcDialogueService.selectNPC(npc);
    
    // 입력창 초기화 (전환 시 깔끔하게)
    this.currentMessage = '';
    this.isSendingMessage = false;
    this.isTyping = false;
    
    // UI 변경 감지를 수동으로 트리거
    this.cdr.detectChanges();
  }

  /**
   * 사용 가능한 NPC 목록 가져오기
   */
  getAvailableNPCs(): NPCProfile[] {
    return this.npcProfiles.filter(npc => npc && npc.name);
  }

  /**
   * NPC가 선택되었는지 확인
   */
  isNPCSelected(npc: NPCProfile): boolean {
    return this.selectedNPC?.id === npc.id;
  }

  /**
   * NPC별 대화 히스토리가 있는지 확인
   */
  hasConversationHistory(npc: NPCProfile): boolean {
    const npcId = `npc_${npc.id}`;
    const session = this.npcDialogueService.getLocalSession(npcId);
    return session && session.length > 0;
  }

  /**
   * NPC별 마지막 대화 시간 가져오기
   */
  getLastConversationTime(npc: NPCProfile): Date | null {
    const npcId = `npc_${npc.id}`;
    const session = this.npcDialogueService.getLocalSession(npcId);
    if (session && session.length > 0) {
      return session[session.length - 1].timestamp;
    }
    return null;
  }

  /**
   * 메시지 전송
   */
  onSendMessage() {
    // 중복 전송 방지
    if (this.isSendingMessage) {
      console.log('이미 메시지 전송 중입니다. 중복 전송을 방지합니다.');
      return;
    }
    
    // 현재 입력값을 안전하게 캡처 (textarea의 실제 값 사용)
    const messageInputElement = this.messageInput?.nativeElement as HTMLTextAreaElement;
    const currentInputValue = messageInputElement?.value || this.currentMessage;
    const message = currentInputValue.trim();
    
    if (!message || !this.selectedNPC || !this.isServerConnected) {
      console.log('메시지 전송 조건 미충족:', {
        hasMessage: !!message,
        hasNPC: !!this.selectedNPC,
        isConnected: this.isServerConnected,
        currentMessage: this.currentMessage,
        inputValue: currentInputValue
      });
      return;
    }
    
    console.log('메시지 전송 시작:', message);
    console.log('입력 소스:', {
      fromModel: this.currentMessage,
      fromElement: currentInputValue,
      final: message
    });
    
    // 전송 상태 플래그 설정
    this.isSendingMessage = true;
    
    // 입력창 초기화 및 타이핑 상태 설정
    this.currentMessage = '';
    if (messageInputElement) {
      messageInputElement.value = '';
    }
    this.isTyping = true;
    console.log('isTyping 설정됨:', this.isTyping);

    // 메시지 전송 이벤트 발생
    this.messageSent.emit(message);

    // NPC 서버와 통신
    this.npcDialogueService.chatWithNPC(this.selectedNPC, message).subscribe({
      next: (response) => {
        console.log('NPC 응답 받음, isTyping 해제');
        console.log('Full response:', response);
        this.isTyping = false;
        this.isSendingMessage = false; // 전송 완료 플래그 해제
        
        // 로컬 세션 업데이트
        const npcId = `npc_${this.selectedNPC!.id}`;
        this.chatMessages = this.npcDialogueService.getLocalSession(npcId);
        console.log('업데이트된 메시지:', this.chatMessages);
        
        // 퀘스트 제공이 있으면 다이얼로그 표시
        console.log('퀘스트 체크:', response.quest_offer);
        if (response.quest_offer) {
          console.log('퀘스트 오퍼 발견! 다이얼로그 표시 중...');
          this.pendingQuestOffer = response.quest_offer;
          this.showQuestDialog = true;
          console.log('퀘스트 다이얼로그 상태:', {
            pendingQuestOffer: this.pendingQuestOffer,
            showQuestDialog: this.showQuestDialog
          });
          
          // 퀘스트 오퍼를 위한 시간 지연 (Angular 변경 감지 확인)
          setTimeout(() => {
            console.log('지연 후 퀘스트 다이얼로그 상태:', {
              pendingQuestOffer: this.pendingQuestOffer,
              showQuestDialog: this.showQuestDialog
            });
          }, 100);
        } else {
          console.log('퀘스트 오퍼가 없습니다.');
        }
      },
      error: (error) => {
        console.error('메시지 전송 실패, isTyping 해제:', error);
        this.isTyping = false;
        this.isSendingMessage = false; // 전송 실패 시에도 플래그 해제
        
        // 에러 메시지를 채팅에 표시
        this.addErrorMessage('죄송합니다. 지금은 대화할 수 없습니다. 잠시 후 다시 시도해주세요.');
      }
    });
  }

  /**
   * 키보드 이벤트 처리
   */
  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation(); // 이벤트 전파 완전 차단
      
      // 이미 전송 중이 아닐 때만 메시지 전송
      if (!this.isSendingMessage) {
        // ngModel 업데이트를 위한 작은 지연 추가
        setTimeout(() => {
          this.onSendMessage();
        }, 10);
      }
    }
  }

  /**
   * 에러 메시지 추가
   */
  private addErrorMessage(errorText: string) {
    const errorMessage: DialogueMessage = {
      id: `error_${Date.now()}`,
      content: errorText,
      sender: 'npc',
      timestamp: new Date(),
      emotion: '당황'
    };
    this.chatMessages.push(errorMessage);
  }

  /**
   * 퀘스트 수락
   */
  onAcceptQuest() {
    if (this.pendingQuestOffer) {
      this.npcDialogueService.acceptQuest(this.pendingQuestOffer);
      this.questAccepted.emit(this.pendingQuestOffer);
      
      // 수락 메시지 추가
      this.addSystemMessage(`퀘스트 "${this.pendingQuestOffer.title}"를 수락했습니다!`);
      
      this.closeQuestDialog();
    }
  }

  /**
   * 퀘스트 거절
   */
  onRejectQuest() {
    if (this.pendingQuestOffer) {
      this.npcDialogueService.rejectQuest(this.pendingQuestOffer);
      this.questRejected.emit(this.pendingQuestOffer);
      
      // 거절 메시지 추가
      this.addSystemMessage(`퀘스트 "${this.pendingQuestOffer.title}"를 거절했습니다.`);
      
      this.closeQuestDialog();
    }
  }

  /**
   * 퀘스트 다이얼로그 닫기
   */
  closeQuestDialog() {
    this.showQuestDialog = false;
    this.pendingQuestOffer = null;
  }

  /**
   * 시스템 메시지 추가
   */
  private addSystemMessage(text: string) {
    const systemMessage: DialogueMessage = {
      id: `system_${Date.now()}`,
      content: text,
      sender: 'npc',
      timestamp: new Date(),
      emotion: '안내'
    };
    this.chatMessages.push(systemMessage);
  }

  /**
   * 세션 초기화
   */
  clearSession() {
    if (this.selectedNPC) {
      const npcId = `npc_${this.selectedNPC.id}`;
      this.npcDialogueService.clearSession(npcId).subscribe({
        next: (response) => {
          this.chatMessages = [];
          console.log('세션이 초기화되었습니다:', response.message);
        },
        error: (error) => {
          console.error('세션 초기화 실패:', error);
        }
      });
    }
  }

  /**
   * 스크롤을 아래로 이동
   */
  private scrollToBottom() {
    if (this.chatContainer) {
      const element = this.chatContainer.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }

  /**
   * 시간 포맷팅
   */
  formatTime(timestamp: Date): string {
    return new Date(timestamp).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * 감정 이모지 반환
   */
  getEmotionEmoji(emotion?: string): string {
    const emotionMap: {[key: string]: string} = {
      '기쁨': '😊',
      '슬픔': '😢', 
      '분노': '😠',
      '놀라움': '😲',
      '두려움': '😨',
      '혐오': '😤',
      '중립': '😐',
      '친근함': '😌',
      '신중함': '🤔',
      '당황': '😅',
      '안내': 'ℹ️'
    };
    return emotionMap[emotion || '중립'] || '😐';
  }

  /**
   * 서버 연결 상태 확인
   */
  get connectionStatus(): string {
    return this.isServerConnected ? 'connected' : 'disconnected';
  }

  /**
   * 테스트용 퀘스트 다이얼로그 표시
   */
  testQuestDialog() {
    const testQuest: QuestOffer = {
      title: "테스트 퀘스트",
      description: "이것은 퀘스트 다이얼로그가 올바르게 작동하는지 확인하는 테스트 퀘스트입니다.",
      objectives: [
        "퀘스트 다이얼로그 확인하기",
        "수락 또는 거절 버튼 테스트하기",
        "정상 작동 확인하기"
      ],
      reward: "디버깅 만족감과 100 골드"
    };

    this.pendingQuestOffer = testQuest;
    this.showQuestDialog = true;
    console.log('테스트 퀘스트 다이얼로그 표시:', {
      pendingQuestOffer: this.pendingQuestOffer,
      showQuestDialog: this.showQuestDialog
    });
  }

  // ==================== 음성 재생 관련 메서드 ====================

  /**
   * 메시지 음성 재생
   */
  async playMessageVoice(message: DialogueMessage): Promise<void> {
    if (!message.voiceUrl || !message.voiceGenerated) {
      console.warn('재생할 음성이 없습니다:', message.id);
      return;
    }

    try {
      // 현재 재생 중인 다른 음성 정지
      if (this.currentPlayingMessageId && this.currentPlayingMessageId !== message.id) {
        this.stopMessageVoice(this.currentPlayingMessageId);
      }

      // 이미 재생 중인 경우 정지
      if (this.currentPlayingMessageId === message.id) {
        this.stopMessageVoice(message.id);
        return;
      }

      console.log(`음성 재생 시작: ${message.id} - ${message.voiceUrl}`);

      // 기존 오디오 객체가 있으면 정리
      const existingAudio = this.playingAudios.get(message.id);
      if (existingAudio) {
        existingAudio.pause();
        existingAudio.currentTime = 0;
        this.playingAudios.delete(message.id);
      }

      // 여러 URL 형태 시도
      const audioUrl = await this.findWorkingAudioUrl(message.voiceUrl);
      if (!audioUrl) {
        throw new Error('재생 가능한 음성 URL을 찾을 수 없습니다.');
      }

      // 새 오디오 객체 생성
      const audio = new Audio();
      this.playingAudios.set(message.id, audio);

      // 이벤트 리스너 설정
      audio.addEventListener('ended', () => {
        console.log(`음성 재생 완료: ${message.id}`);
        this.currentPlayingMessageId = null;
        this.playingAudios.delete(message.id);
      });

      audio.addEventListener('error', (error) => {
        console.error(`음성 재생 에러: ${message.id}`, error);
        this.currentPlayingMessageId = null;
        this.playingAudios.delete(message.id);
      });

      // 오디오 로드 및 재생
      audio.src = audioUrl;
      await audio.play();
      this.currentPlayingMessageId = message.id;
      console.log(`음성 재생 중: ${message.id}`);

    } catch (error) {
      console.error('음성 재생 실패:', error);
      this.currentPlayingMessageId = null;
    }
  }

  /**
   * 작동하는 오디오 URL 찾기
   */
  private async findWorkingAudioUrl(originalUrl: string): Promise<string | null> {
    if (!originalUrl) return null;

    // 파일명 추출
    const filename = originalUrl.split('/').pop() || '';
    
    // 시도할 URL 목록 (직접 서버 접근을 우선)
    const urlsToTry = [
      // 방법 1: 직접 서버 접근 (개발 환경)
      `http://localhost:5001/api/voice/audio/${filename}`,
      // 방법 2: 프록시를 통한 접근
      `/api/voice/audio/${filename}`,
      // 방법 3: 원본 URL이 이미 올바른 경우
      originalUrl,
      // 방법 4: 상대 경로 변형
      `${originalUrl.startsWith('audio/') ? '/api/voice/' : ''}${originalUrl}`
    ];

    console.log('시도할 URL들:', urlsToTry);

    for (let i = 0; i < urlsToTry.length; i++) {
      const testUrl = urlsToTry[i];
      console.log(`URL 테스트 ${i + 1}/${urlsToTry.length}: ${testUrl}`);

      try {
        // HEAD 요청으로 파일 존재 확인
        const response = await fetch(testUrl, { 
          method: 'HEAD',
          cache: 'no-cache'
        });

        if (response.ok) {
          console.log(`✅ 작동하는 URL 발견: ${testUrl}`);
          return testUrl;
        } else {
          console.log(`❌ URL 응답 실패: ${testUrl} (${response.status})`);
        }
      } catch (error) {
        console.log(`❌ URL 테스트 에러: ${testUrl}`, error);
      }
    }

    console.error('❌ 모든 URL 테스트 실패');
    return null;
  }

  /**
   * 메시지 음성 재생 정지
   */
  stopMessageVoice(messageId: string): void {
    const audio = this.playingAudios.get(messageId);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      this.playingAudios.delete(messageId);
    }

    if (this.currentPlayingMessageId === messageId) {
      this.currentPlayingMessageId = null;
    }

    console.log(`음성 재생 정지: ${messageId}`);
  }

  /**
   * 모든 음성 재생 정지
   */
  stopAllVoices(): void {
    this.playingAudios.forEach((audio, messageId) => {
      audio.pause();
      audio.currentTime = 0;
    });
    this.playingAudios.clear();
    this.currentPlayingMessageId = null;
    console.log('모든 음성 재생 정지');
  }

  /**
   * 특정 메시지의 음성이 재생 중인지 확인
   */
  isMessageVoicePlaying(messageId: string): boolean {
    return this.currentPlayingMessageId === messageId;
  }

  /**
   * NPC에 음성 배우 매핑 설정 (음성 생성 컴포넌트와 연동)
   */
  setNPCVoiceMapping(npcId: string, voiceActorId: string): void {
    this.npcDialogueService.setNPCVoiceMapping(npcId, voiceActorId);
  }

  /**
   * 이미지 로드 에러 처리
   */
  onImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    if (imgElement) {
      imgElement.style.display = 'none';
    }
  }

  // ==================== SadTalker 관련 메소드 ====================

  /**
   * 메시지 목록 변경 감지 (자동 재생 제거)
   */
  private checkForNewTalkingVideo(): void {
    // 자동 재생 로직 제거 - 이제 수동으로만 재생
    // 새로운 비디오가 생성되어도 자동으로 재생하지 않음
    console.log('새로운 비디오 확인 완료 (자동 재생 비활성화)');
  }

  /**
   * 수동 비디오 재생 - 프로필 영역에서 재생
   */
  playVideoInProfile(message: DialogueMessage): void {
    if (!message.talkingVideoUrl || message.sender !== 'npc') {
      console.warn('재생할 비디오가 없거나 NPC 메시지가 아닙니다.');
      return;
    }

    console.log(`프로필 영역에서 비디오 재생: ${message.id}`);
    
    // 현재 재생 중인 비디오가 있으면 정지
    this.stopTalkingVideo();
    
    // 새 비디오 설정 및 재생
    this.currentTalkingVideoUrl = message.talkingVideoUrl;
    this.selectedVideoMessage = message;
    this.isVideoPlaying = true;
    
    console.log('프로필 비디오 재생 시작:', message.talkingVideoUrl);
  }

  /**
   * 프로필 비디오 재생 정지
   */
  stopProfileVideo(): void {
    console.log('프로필 비디오 재생 정지');
    this.stopTalkingVideo();
    this.selectedVideoMessage = null;
  }

  /**
   * 프로필 비디오 재생/정지 토글
   */
  toggleProfileVideo(message: DialogueMessage): void {
    if (this.isVideoPlaying && this.selectedVideoMessage?.id === message.id) {
      this.stopProfileVideo();
    } else {
      this.playVideoInProfile(message);
    }
  }

  /**
   * 현재 프로필에서 재생 중인 메시지인지 확인
   */
  isPlayingInProfile(message: DialogueMessage): boolean {
    return this.isVideoPlaying && 
           this.selectedVideoMessage?.id === message.id &&
           !!this.currentTalkingVideoUrl;
  }

  /**
   * 프로필 비디오 재생 상태 확인
   */
  isProfileVideoPlaying(): boolean {
    return this.isVideoPlaying && !!this.currentTalkingVideoUrl && !!this.selectedVideoMessage;
  }

  /**
   * 현재 재생 중인 비디오 메시지 반환
   */
  getCurrentVideoMessage(): DialogueMessage | null {
    return this.selectedVideoMessage;
  }

  /**
   * talking video 재생 종료 (내부 헬퍼 메서드)
   */
  private stopTalkingVideo(): void {
    this.currentTalkingVideoUrl = null;
    this.isVideoPlaying = false;
    console.log('Talking video 재생 종료');
  }

  /**
   * 현재 talking video가 표시되어야 하는지 확인 (프로필 영역용)
   */
  isShowingTalkingVideo(): boolean {
    return this.isVideoPlaying && !!this.currentTalkingVideoUrl;
  }

  /**
   * 현재 재생 중인 talking video URL 반환 (프로필 영역용)
   */
  getTalkingVideoUrl(): string | null {
    return this.currentTalkingVideoUrl;
  }

  /**
   * 현재 비디오 생성 중인지 확인
   */
  isGeneratingTalkingVideo(): boolean {
    if (!this.selectedNPC || this.chatMessages.length === 0) return false;
    
    // 가장 최근 NPC 메시지가 비디오 생성 중인지 확인
    const lastNpcMessage = [...this.chatMessages]
      .reverse()
      .find(msg => msg.sender === 'npc');
    
    return lastNpcMessage?.isGeneratingVideo || false;
  }

  /**
   * talking video 재생 종료 이벤트 핸들러 (프로필 영역용)
   */
  onTalkingVideoEnded(): void {
    console.log('프로필 비디오 재생 완료');
    this.stopProfileVideo();
  }

  /**
   * talking video 에러 이벤트 핸들러 (프로필 영역용)
   */
  onTalkingVideoError(event: any): void {
    console.error('프로필 비디오 재생 오류:', event);
    this.stopProfileVideo();
  }

  /**
   * 비디오 로딩 상태 확인
   */
  isVideoLoading(messageId: string): boolean {
    return this.videoLoadingStates.get(messageId) || false;
  }

  /**
   * 비디오 로딩 시작
   */
  onVideoLoadStart(messageId: string): void {
    this.videoLoadingStates.set(messageId, true);
    console.log(`비디오 로딩 시작: ${messageId}`);
  }

  /**
   * 비디오 재생 가능
   */
  onVideoCanPlay(messageId: string): void {
    this.videoLoadingStates.set(messageId, false);
    console.log(`비디오 재생 준비 완료: ${messageId}`);
  }

  /**
   * 비디오 재생 종료
   */
  onVideoEnded(messageId: string): void {
    console.log(`비디오 재생 종료: ${messageId}`);
    // 필요시 반복 재생 또는 다른 동작 구현
  }

  /**
   * 비디오 에러 처리
   */
  onVideoError(messageId: string, error: any): void {
    this.videoLoadingStates.set(messageId, false);
    console.error(`비디오 재생 오류 (${messageId}):`, error);
    
    // 에러 발생 시 해당 메시지의 비디오 상태 업데이트
    const message = this.chatMessages.find(msg => msg.id === messageId);
    if (message) {
      // 비디오 재생 실패로 표시
      console.warn(`메시지 ${messageId}의 비디오 재생에 실패했습니다.`);
    }
  }

  /**
   * 비디오 재생성 시도
   */
  retryVideoGeneration(message: DialogueMessage): void {
    // 비디오 재생성 로직
    console.log('비디오 재생성 요청:', message.id);
    
    // 다시 큐에 추가하는 방식으로 재시도
    if (this.selectedNPC) {
      const npcId = `npc_${this.selectedNPC.id}`;
      // TODO: 비디오 재생성을 위한 큐 추가 메서드 구현
    }
  }

  /**
   * 현재 큐에 있는 음성 생성 아이템 수 반환
   */
  getVoiceQueueCount(): number {
    return this.queueItems.filter(item => item.type === 'voice').length;
  }

  /**
   * 현재 큐에 있는 비디오 생성 아이템 수 반환
   */
  getVideoQueueCount(): number {
    return this.queueItems.filter(item => item.type === 'video').length;
  }

  /**
   * 현재 처리 중인 아이템 정보 반환
   */
  getCurrentProcessingItem(): QueueItem | null {
    return this.queueStatus.current;
  }

  /**
   * 큐가 처리 중인지 확인
   */
  isQueueProcessing(): boolean {
    return this.queueStatus.processing;
  }

  /**
   * 큐 총 크기 반환
   */
  getQueueSize(): number {
    return this.queueStatus.size;
  }

  /**
   * 큐 상태 정보를 문자열로 반환
   */
  getQueueStatusText(): string {
    const voiceCount = this.getVoiceQueueCount();
    const videoCount = this.getVideoQueueCount();
    const voiceProcessing = this.queueStatus.voiceProcessing;
    const videoProcessing = this.queueStatus.videoProcessing;

    // 둘 다 처리 중일 때
    if (voiceProcessing && videoProcessing) {
      return `🎵🎬 음성·비디오 동시 생성 중... (대기: 음성 ${voiceCount}, 비디오 ${videoCount})`;
    }

    // 음성만 처리 중
    if (voiceProcessing) {
      return `🎵 음성 생성 중... (대기: 음성 ${voiceCount}, 비디오 ${videoCount})`;
    }

    // 비디오만 처리 중
    if (videoProcessing) {
      return `🎬 비디오 생성 중... (대기: 음성 ${voiceCount}, 비디오 ${videoCount})`;
    }

    // 처리 중인 것은 없지만 대기 중인 작업이 있을 때
    if (voiceCount > 0 || videoCount > 0) {
      return `⏳ 대기 중: 음성 ${voiceCount}, 비디오 ${videoCount}`;
    }

    return '✅ 모든 미디어 생성 완료';
  }

  /**
   * 음성 큐가 처리 중인지 확인
   */
  isVoiceProcessing(): boolean {
    return this.queueStatus.voiceProcessing;
  }

  /**
   * 비디오 큐가 처리 중인지 확인
   */
  isVideoProcessing(): boolean {
    return this.queueStatus.videoProcessing;
  }

  /**
   * 병렬 처리 상태 확인
   */
  isParallelProcessing(): boolean {
    return this.queueStatus.voiceProcessing && this.queueStatus.videoProcessing;
  }

  /**
   * 큐 초기화
   */
  clearQueue(): void {
    this.npcDialogueService.clearQueue();
  }

  /**
   * 수동 음성 생성
   */
  generateVoice(message: DialogueMessage): void {
    if (!this.selectedNPC || message.sender !== 'npc') {
      console.warn('음성 생성: NPC 메시지가 아니거나 NPC가 선택되지 않음');
      return;
    }

    const npcId = `npc_${this.selectedNPC.id}`;
    console.log(`음성 생성 요청: ${npcId}/${message.id}`);
    this.npcDialogueService.generateVoiceForMessage(npcId, message.id);
  }

  /**
   * 수동 비디오 생성
   */
  generateVideo(message: DialogueMessage): void {
    if (!this.selectedNPC || message.sender !== 'npc') {
      console.warn('비디오 생성: NPC 메시지가 아니거나 NPC가 선택되지 않음');
      return;
    }

    const npcId = `npc_${this.selectedNPC.id}`;
    console.log(`비디오 생성 요청: ${npcId}/${message.id}`);
    this.npcDialogueService.generateVideoForMessage(npcId, message.id);
  }

  /**
   * 전체 미디어 생성 (음성 + 비디오)
   */
  generateAllMedia(message: DialogueMessage): void {
    if (!this.selectedNPC || message.sender !== 'npc') {
      console.warn('전체 미디어 생성: NPC 메시지가 아니거나 NPC가 선택되지 않음');
      return;
    }

    const npcId = `npc_${this.selectedNPC.id}`;
    console.log(`전체 미디어 생성 요청: ${npcId}/${message.id}`);
    this.npcDialogueService.generateAllMediaForMessage(npcId, message.id);
  }

  /**
   * 메시지의 생성 가능한 미디어 타입 확인
   */
  getAvailableMediaActions(message: DialogueMessage): {
    canGenerateVoice: boolean;
    canGenerateVideo: boolean;
    canGenerateAll: boolean;
  } {
    if (message.sender !== 'npc' || !this.selectedNPC?.voiceActor) {
      return {
        canGenerateVoice: false,
        canGenerateVideo: false,
        canGenerateAll: false
      };
    }

    const canGenerateVoice = !(message.isGeneratingVoice || false) && !(message.voiceGenerated || false);
    const canGenerateVideo = !(message.isGeneratingVideo || false) && !(message.videoGenerated || false) && (message.voiceGenerated || false);
    const canGenerateAll = !(message.voiceGenerated || false) || (!(message.videoGenerated || false) && (message.voiceGenerated || false));

    return {
      canGenerateVoice,
      canGenerateVideo,
      canGenerateAll: canGenerateVoice || canGenerateVideo
    };
  }

  /**
   * 메시지의 미디어 상태 요약 텍스트
   */
  getMediaStatusText(message: DialogueMessage): string {
    if (message.sender !== 'npc') return '';

    const voiceStatus = message.isGeneratingVoice ? '생성중' : 
                       message.voiceGenerated ? '완료' : '미생성';
    const videoStatus = message.isGeneratingVideo ? '생성중' : 
                       message.videoGenerated ? '완료' : '미생성';

    return `음성: ${voiceStatus}, 비디오: ${videoStatus}`;
  }

  /**
   * 비디오 재생/정지 토글 (메시지별 - 이제 프로필 재생으로 연결)
   */
  toggleVideoPlayback(message: DialogueMessage): void {
    this.toggleProfileVideo(message);
  }
}
