import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, Subject } from 'rxjs';
import { map, catchError, retry } from 'rxjs/operators';
import { NPCProfile } from '../models/game-world.interface';

// 큐 관리 관련 인터페이스 추가
export interface QueueItem {
  id: string;
  type: 'voice' | 'video';
  npcId: string;
  messageId: string;
  priority: number;
  createdAt: Date;
  retryCount: number;
  maxRetries: number;
}

export interface QueueStatus {
  size: number;
  processing: boolean;
  current: QueueItem | null;
  voiceSize: number;
  videoSize: number;
  voiceProcessing: boolean;
  videoProcessing: boolean;
}

export interface VoiceQueueItem extends QueueItem {
  type: 'voice';
  message: DialogueMessage;
  voiceActorId: string;
}

export interface VideoQueueItem extends QueueItem {
  type: 'video';
  message: DialogueMessage;
  audioUrl: string;
  npcImageUrl: string;
}

export class MediaGenerationQueue {
  private voiceQueue: VoiceQueueItem[] = [];
  private videoQueue: VideoQueueItem[] = [];
  private voiceProcessing = false;
  private videoProcessing = false;
  private currentVoiceItem: VoiceQueueItem | null = null;
  private currentVideoItem: VideoQueueItem | null = null;
  private queueSubject = new BehaviorSubject<QueueItem[]>([]);
  public queue$ = this.queueSubject.asObservable();

  constructor(
    private voiceProcessor: (item: VoiceQueueItem) => Promise<void>,
    private videoProcessor: (item: VideoQueueItem) => Promise<void>
  ) {}

  /**
   * 큐에 아이템 추가 (타입별로 분리된 큐에 추가)
   */
  enqueue(item: QueueItem): void {
    if (item.type === 'voice') {
      this.enqueueVoice(item as VoiceQueueItem);
    } else if (item.type === 'video') {
      this.enqueueVideo(item as VideoQueueItem);
    }
  }

  /**
   * 음성 큐에 아이템 추가
   */
  private enqueueVoice(item: VoiceQueueItem): void {
    // 중복 요청 체크
    const existingIndex = this.voiceQueue.findIndex(
      existing => existing.npcId === item.npcId && 
                 existing.messageId === item.messageId
    );

    if (existingIndex !== -1) {
      console.log(`중복 음성 요청 발견: ${item.npcId}/${item.messageId} - 무시됨`);
      return;
    }

    // 우선순위에 따라 삽입
    const insertIndex = this.voiceQueue.findIndex(queueItem => queueItem.priority < item.priority);
    if (insertIndex === -1) {
      this.voiceQueue.push(item);
    } else {
      this.voiceQueue.splice(insertIndex, 0, item);
    }

    console.log(`음성 큐에 추가됨: ${item.npcId}/${item.messageId} (음성 큐 크기: ${this.voiceQueue.length})`);
    this.updateQueueSubject();

    // 음성 처리 시작
    this.processVoiceQueue();
  }

  /**
   * 비디오 큐에 아이템 추가
   */
  private enqueueVideo(item: VideoQueueItem): void {
    // 중복 요청 체크
    const existingIndex = this.videoQueue.findIndex(
      existing => existing.npcId === item.npcId && 
                 existing.messageId === item.messageId
    );

    if (existingIndex !== -1) {
      console.log(`중복 비디오 요청 발견: ${item.npcId}/${item.messageId} - 무시됨`);
      return;
    }

    // 우선순위에 따라 삽입
    const insertIndex = this.videoQueue.findIndex(queueItem => queueItem.priority < item.priority);
    if (insertIndex === -1) {
      this.videoQueue.push(item);
    } else {
      this.videoQueue.splice(insertIndex, 0, item);
    }

    console.log(`비디오 큐에 추가됨: ${item.npcId}/${item.messageId} (비디오 큐 크기: ${this.videoQueue.length})`);
    this.updateQueueSubject();

    // 비디오 처리 시작
    this.processVideoQueue();
  }

  /**
   * 음성 큐 처리 (독립적으로 실행)
   */
  private async processVoiceQueue(): Promise<void> {
    if (this.voiceProcessing || this.voiceQueue.length === 0) {
      return;
    }

    this.voiceProcessing = true;
    console.log('🎵 음성 큐 처리 시작');

    while (this.voiceQueue.length > 0) {
      const item = this.voiceQueue.shift()!;
      this.currentVoiceItem = item;
      this.updateQueueSubject();

      try {
        console.log(`🎵 음성 처리 시작: ${item.npcId}/${item.messageId}`);
        await this.voiceProcessor(item);
        console.log(`🎵 음성 처리 완료: ${item.npcId}/${item.messageId}`);

      } catch (error) {
        console.error(`🎵 음성 처리 실패: ${item.npcId}/${item.messageId}:`, error);
        
        // 재시도 로직
        item.retryCount++;
        if (item.retryCount < item.maxRetries) {
          console.log(`🎵 음성 재시도 예정: (${item.retryCount}/${item.maxRetries})`);
          item.priority = Math.max(0, item.priority - 1);
          this.enqueueVoice(item);
        } else {
          console.error(`🎵 음성 최대 재시도 횟수 초과: ${item.npcId}/${item.messageId}`);
        }
      }

      this.currentVoiceItem = null;
      
      // 다음 음성 처리 전 짧은 대기 (서버 부하 방지)
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    this.voiceProcessing = false;
    this.updateQueueSubject();
    console.log('🎵 음성 큐 처리 완료');
  }

  /**
   * 비디오 큐 처리 (독립적으로 실행)
   */
  private async processVideoQueue(): Promise<void> {
    if (this.videoProcessing || this.videoQueue.length === 0) {
      return;
    }

    this.videoProcessing = true;
    console.log('🎬 비디오 큐 처리 시작');

    while (this.videoQueue.length > 0) {
      const item = this.videoQueue.shift()!;
      this.currentVideoItem = item;
      this.updateQueueSubject();

      try {
        console.log(`🎬 비디오 처리 시작: ${item.npcId}/${item.messageId}`);
        await this.videoProcessor(item);
        console.log(`🎬 비디오 처리 완료: ${item.npcId}/${item.messageId}`);

      } catch (error) {
        console.error(`🎬 비디오 처리 실패: ${item.npcId}/${item.messageId}:`, error);
        
        // 재시도 로직
        item.retryCount++;
        if (item.retryCount < item.maxRetries) {
          console.log(`🎬 비디오 재시도 예정: (${item.retryCount}/${item.maxRetries})`);
          item.priority = Math.max(0, item.priority - 1);
          this.enqueueVideo(item);
        } else {
          console.error(`🎬 비디오 최대 재시도 횟수 초과: ${item.npcId}/${item.messageId}`);
        }
      }

      this.currentVideoItem = null;
      
      // 다음 비디오 처리 전 대기 (비디오는 더 오래 걸리므로 짧은 대기)
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    this.videoProcessing = false;
    this.updateQueueSubject();
    console.log('🎬 비디오 큐 처리 완료');
  }

  /**
   * 큐 상태 업데이트 (UI에 알림)
   */
  private updateQueueSubject(): void {
    const allItems: QueueItem[] = [
      ...this.voiceQueue,
      ...this.videoQueue
    ];
    this.queueSubject.next(allItems);
  }

  /**
   * 특정 아이템을 큐에서 제거
   */
  remove(npcId: string, messageId: string, type: 'voice' | 'video'): void {
    let removed = false;

    if (type === 'voice') {
      const initialLength = this.voiceQueue.length;
      this.voiceQueue = this.voiceQueue.filter(
        item => !(item.npcId === npcId && item.messageId === messageId)
      );
      removed = this.voiceQueue.length !== initialLength;
    } else if (type === 'video') {
      const initialLength = this.videoQueue.length;
      this.videoQueue = this.videoQueue.filter(
        item => !(item.npcId === npcId && item.messageId === messageId)
      );
      removed = this.videoQueue.length !== initialLength;
    }

    if (removed) {
      console.log(`큐에서 제거됨: ${type} for ${npcId}/${messageId}`);
      this.updateQueueSubject();
    }
  }

  /**
   * 특정 NPC의 모든 아이템을 큐에서 제거
   */
  removeByNPC(npcId: string): void {
    const voiceInitialLength = this.voiceQueue.length;
    const videoInitialLength = this.videoQueue.length;

    this.voiceQueue = this.voiceQueue.filter(item => item.npcId !== npcId);
    this.videoQueue = this.videoQueue.filter(item => item.npcId !== npcId);
    
    const voiceRemoved = this.voiceQueue.length !== voiceInitialLength;
    const videoRemoved = this.videoQueue.length !== videoInitialLength;

    if (voiceRemoved || videoRemoved) {
      console.log(`NPC ${npcId}의 큐 아이템 제거됨 (음성: ${voiceInitialLength - this.voiceQueue.length}, 비디오: ${videoInitialLength - this.videoQueue.length})`);
      this.updateQueueSubject();
    }
  }

  /**
   * 현재 처리 중인 아이템 반환 (음성 우선)
   */
  getCurrentItem(): QueueItem | null {
    return this.currentVoiceItem || this.currentVideoItem;
  }

  /**
   * 큐 상태 반환
   */
  getQueueStatus(): QueueStatus {
    return {
      size: this.voiceQueue.length + this.videoQueue.length,
      processing: this.voiceProcessing || this.videoProcessing,
      current: this.getCurrentItem(),
      voiceSize: this.voiceQueue.length,
      videoSize: this.videoQueue.length,
      voiceProcessing: this.voiceProcessing,
      videoProcessing: this.videoProcessing
    };
  }

  /**
   * 큐 초기화
   */
  clear(): void {
    this.voiceQueue = [];
    this.videoQueue = [];
    this.updateQueueSubject();
    console.log('모든 큐가 초기화되었습니다.');
  }
}

// NPC 대화 서버 API 인터페이스
export interface NPCChatRequest {
  npc_id: string;
  npc_profile: NPCServerProfile;
  user_profile: UserProfile;
  message: string;
  stream?: boolean;
}

export interface NPCServerProfile {
  name: string;
  species?: string;
  personality: string;
  profession?: string;
  location?: string;
}

export interface UserProfile {
  name: string;
  level: number;
  class: string;
  active_quests: string[];
  reputation: string;
}

export interface QuestOffer {
  title: string;
  description: string;
  objectives: string[];
  reward: string;
}

export interface NPCChatResponse {
  reply: string;
  emotion: string;
  quest_offer?: QuestOffer;
}

export interface SessionResponse {
  session_id: string;
  history: string[];
  total_turns: number;
}

export interface ServerHealth {
  status: string;
  model: string;
  active_sessions: number;
}

export interface DialogueMessage {
  id: string;
  content: string;
  sender: 'user' | 'npc';
  timestamp: Date;
  emotion?: string;
  questOffer?: QuestOffer;
  voiceUrl?: string;
  isGeneratingVoice?: boolean;
  voiceGenerated?: boolean;
  // SadTalker 관련 추가
  talkingVideoUrl?: string;
  isGeneratingVideo?: boolean;
  videoGenerated?: boolean;
}

// 음성 생성 관련 import 추가
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

export interface TalkingVideoRequest {
  image_data: string;  // Base64 인코딩된 이미지
  audio_data: string;  // Base64 인코딩된 음성
  still?: boolean;
  preprocess?: string;
  size?: number;
  expression_scale?: number;
  output_format?: string;
  fps?: number;
  pose_style?: number;
}

export interface TalkingVideoResponse {
  success: boolean;
  message: string;
  video_url?: string;
  video_path?: string;
  generation_time?: number;
  video_info?: any;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NPCDialogueService {
  private baseUrl = 'http://localhost:8000';
  private voiceBaseUrl = 'http://localhost:5001/api/voice'; // 직접 음성 서버 접근으로 수정
  private sadtalkerBaseUrl = 'http://localhost:5002/api/talking'; // SadTalker 서버 URL 추가
  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    })
  };

  // 현재 활성 대화 세션들
  private activeSessions = new Map<string, DialogueMessage[]>();
  private sessionsSubject = new BehaviorSubject<Map<string, DialogueMessage[]>>(this.activeSessions);
  public sessions$ = this.sessionsSubject.asObservable();

  // 현재 선택된 NPC
  private selectedNPCSubject = new BehaviorSubject<NPCProfile | null>(null);
  public selectedNPC$ = this.selectedNPCSubject.asObservable();

  // 서버 연결 상태
  private isConnectedSubject = new BehaviorSubject<boolean>(false);
  public isConnected$ = this.isConnectedSubject.asObservable();

  // NPC 음성 매핑 정보
  private npcVoiceMappings = new Map<string, string>();

  // 미디어 생성 큐 매니저
  private mediaQueue: MediaGenerationQueue;

  constructor(private http: HttpClient) {
    // 큐 매니저 초기화
    this.mediaQueue = new MediaGenerationQueue(
      (item: VoiceQueueItem) => this.processVoiceGeneration(item),
      (item: VideoQueueItem) => this.processVideoGeneration(item)
    );
    
    this.checkServerHealth();
  }

  /**
   * 큐 상태 관찰 가능한 스트림 반환
   */
  getQueueStatus$(): Observable<QueueItem[]> {
    return this.mediaQueue.queue$;
  }

  /**
   * 현재 큐 상태 반환
   */
  getCurrentQueueStatus(): QueueStatus {
    return this.mediaQueue.getQueueStatus();
  }

  /**
   * 큐 초기화
   */
  clearQueue(): void {
    this.mediaQueue.clear();
  }

  /**
   * 서버 헬스 체크
   */
  checkServerHealth(): Observable<ServerHealth> {
    return this.http.get<ServerHealth>(`${this.baseUrl}/health`)
      .pipe(
        map(response => {
          this.isConnectedSubject.next(true);
          return response;
        }),
        catchError(error => {
          this.isConnectedSubject.next(false);
          console.error('NPC 서버 연결 실패:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * NPCProfile을 서버 형식으로 변환
   */
  private convertToServerProfile(npc: NPCProfile): NPCServerProfile {
    return {
      name: npc.name,
      species: npc.species || '인간',
      personality: npc.personality,
      profession: npc.role || '일반인',
      location: npc.location || '마을'
    };
  }

  /**
   * 기본 사용자 프로필 생성
   */
  private createUserProfile(): UserProfile {
    return {
      name: '모험가',
      level: 15,
      class: '전사',
      active_quests: [],
      reputation: '좋음'
    };
  }

  /**
   * NPC와 채팅
   */
  chatWithNPC(npc: NPCProfile, message: string): Observable<NPCChatResponse> {
    const npcId = `npc_${npc.id}`;
    
    const request: NPCChatRequest = {
      npc_id: npcId,
      npc_profile: this.convertToServerProfile(npc),
      user_profile: this.createUserProfile(),
      message: message,
      stream: false
    };

    return this.http.post<NPCChatResponse>(`${this.baseUrl}/chat`, request, this.httpOptions)
      .pipe(
        retry(1),
        map(response => {
          // 로컬 세션에 메시지 추가
          this.addMessageToSession(npcId, message, response);
          return response;
        }),
        catchError(error => {
          console.error('NPC 채팅 오류:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * 세션에 메시지 추가
   */
  private addMessageToSession(npcId: string, userMessage: string, npcResponse: NPCChatResponse) {
    if (!this.activeSessions.has(npcId)) {
      this.activeSessions.set(npcId, []);
    }

    const session = this.activeSessions.get(npcId)!;
    const timestamp = new Date();
    const baseTime = Date.now();

    // 중복 메시지 확인 - 동일한 내용의 연속된 메시지 방지
    const lastUserMessage = session.filter(msg => msg.sender === 'user').pop();
    if (lastUserMessage && lastUserMessage.content === userMessage) {
      console.warn('중복 사용자 메시지 감지됨. 추가하지 않습니다:', userMessage);
      return;
    }

    // 고유한 ID 생성 (더 안전한 방식)
    const userMessageId = `${baseTime}_${Math.random().toString(36).substr(2, 9)}_user`;
    const npcMessageId = `${baseTime + 1}_${Math.random().toString(36).substr(2, 9)}_npc`;

    // 사용자 메시지 추가
    session.push({
      id: userMessageId,
      content: userMessage,
      sender: 'user',
      timestamp: timestamp
    });

    // NPC 응답 추가 (자동 생성 제거)
    const npcMessage: DialogueMessage = {
      id: npcMessageId,
      content: npcResponse.reply,
      sender: 'npc',
      timestamp: new Date(timestamp.getTime() + 1000),
      emotion: npcResponse.emotion,
      questOffer: npcResponse.quest_offer,
      isGeneratingVoice: false, // 자동 생성 비활성화
      voiceGenerated: false,
      isGeneratingVideo: false, // 자동 생성 비활성화
      videoGenerated: false
    };

    session.push(npcMessage);
    this.sessionsSubject.next(this.activeSessions);

    // 자동 음성 생성 제거 - 이제 수동으로만 생성
    // this.queueVoiceGeneration(npcId, npcMessage);
  }

  /**
   * 수동 음성 생성 시작
   */
  generateVoiceForMessage(npcId: string, messageId: string): void {
    const session = this.activeSessions.get(npcId);
    if (!session) {
      console.error(`세션을 찾을 수 없습니다: ${npcId}`);
      return;
    }

    const message = session.find(msg => msg.id === messageId);
    if (!message || message.sender !== 'npc') {
      console.error(`NPC 메시지를 찾을 수 없습니다: ${messageId}`);
      return;
    }

    // 이미 생성 중이거나 완료된 경우 무시
    if (message.isGeneratingVoice || message.voiceGenerated) {
      console.log(`음성이 이미 생성 중이거나 완료됨: ${messageId}`);
      return;
    }

    // 음성 생성 상태 업데이트
    this.updateMessageVoiceStatus(npcId, messageId, true, false, false, false);

    // 음성 생성 큐에 추가
    this.queueVoiceGeneration(npcId, message);
  }

  /**
   * 수동 비디오 생성 시작
   */
  generateVideoForMessage(npcId: string, messageId: string): void {
    const session = this.activeSessions.get(npcId);
    if (!session) {
      console.error(`세션을 찾을 수 없습니다: ${npcId}`);
      return;
    }

    const message = session.find(msg => msg.id === messageId);
    if (!message || message.sender !== 'npc') {
      console.error(`NPC 메시지를 찾을 수 없습니다: ${messageId}`);
      return;
    }

    // 이미 생성 중이거나 완료된 경우 무시
    if (message.isGeneratingVideo || message.videoGenerated) {
      console.log(`비디오가 이미 생성 중이거나 완료됨: ${messageId}`);
      return;
    }

    // 음성이 먼저 생성되어야 함
    if (!message.voiceGenerated || !message.voiceUrl) {
      console.warn(`비디오 생성을 위해서는 음성이 먼저 생성되어야 합니다: ${messageId}`);
      // 음성부터 생성
      this.generateVoiceForMessage(npcId, messageId);
      return;
    }

    // 비디오 생성 상태 업데이트
    this.updateMessageVoiceStatus(npcId, messageId, false, true, true, false, message.voiceUrl);

    // 비디오 생성 큐에 추가
    this.queueVideoGeneration(npcId, message, message.voiceUrl);
  }

  /**
   * 음성과 비디오를 순차적으로 생성 (편의 메서드)
   */
  generateAllMediaForMessage(npcId: string, messageId: string): void {
    const session = this.activeSessions.get(npcId);
    if (!session) {
      console.error(`세션을 찾을 수 없습니다: ${npcId}`);
      return;
    }

    const message = session.find(msg => msg.id === messageId);
    if (!message || message.sender !== 'npc') {
      console.error(`NPC 메시지를 찾을 수 없습니다: ${messageId}`);
      return;
    }

    // 음성부터 생성
    if (!message.voiceGenerated) {
      console.log(`전체 미디어 생성 시작: ${messageId} - 음성부터 생성`);
      this.generateVoiceForMessage(npcId, messageId);
    } else if (!message.videoGenerated) {
      // 음성이 이미 있으면 비디오만 생성
      console.log(`전체 미디어 생성: ${messageId} - 비디오 생성`);
      this.generateVideoForMessage(npcId, messageId);
    } else {
      console.log(`전체 미디어가 이미 생성됨: ${messageId}`);
    }
  }

  /**
   * 음성 생성을 큐에 추가
   */
  private queueVoiceGeneration(npcId: string, message: DialogueMessage): void {
    // NPC에 매핑된 음성 배우 ID 가져오기
    const voiceActorId = this.npcVoiceMappings.get(npcId);
    
    if (!voiceActorId) {
      console.warn(`NPC ${npcId}에 매핑된 음성 배우가 없습니다. 음성 생성을 건너뜁니다.`);
      this.updateMessageVoiceStatus(npcId, message.id, false, false, false, false);
      return;
    }

    const voiceQueueItem: VoiceQueueItem = {
      id: `voice_${npcId}_${message.id}_${Date.now()}`,
      type: 'voice',
      npcId,
      messageId: message.id,
      priority: 10, // 기본 우선순위
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: 3,
      message,
      voiceActorId
    };

    this.mediaQueue.enqueue(voiceQueueItem);
  }

  /**
   * 비디오 생성을 큐에 추가
   */
  private queueVideoGeneration(npcId: string, message: DialogueMessage, audioUrl: string): void {
    const selectedNPC = this.selectedNPCSubject.value;
    if (!selectedNPC || !selectedNPC.imageUrl) {
      console.warn(`NPC ${npcId}에 이미지가 없습니다. 비디오 생성을 건너뜁니다.`);
      return;
    }

    const videoQueueItem: VideoQueueItem = {
      id: `video_${npcId}_${message.id}_${Date.now()}`,
      type: 'video',
      npcId,
      messageId: message.id,
      priority: 5, // 음성보다 낮은 우선순위
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: 2,
      message,
      audioUrl,
      npcImageUrl: selectedNPC.imageUrl
    };

    this.mediaQueue.enqueue(videoQueueItem);
  }

  /**
   * 큐에서 음성 생성 처리
   */
  private async processVoiceGeneration(item: VoiceQueueItem): Promise<void> {
    console.log(`음성 생성 시작: NPC ${item.npcId}, 메시지 "${item.message.content}"`);

    const voiceRequest: VoiceGenerationRequest = {
      text: item.message.content,
      actor_id: item.voiceActorId,
      speed: 1.0,
      pitch: 0,
      emotion: item.message.emotion || 'neutral'
    };

    return new Promise((resolve, reject) => {
      this.http.post<VoiceGenerationResponse>(`${this.voiceBaseUrl}/generate`, voiceRequest, this.httpOptions)
        .pipe(
          catchError(error => {
            console.error(`음성 생성 실패 (NPC: ${item.npcId}):`, error);
            this.updateMessageVoiceStatus(item.npcId, item.messageId, false, false, false, false);
            return throwError(() => error);
          })
        )
        .subscribe({
          next: (response) => {
            if (response.success && response.audio_url) {
              console.log(`음성 생성 성공: ${response.audio_url}`);
              
              // 음성 URL을 올바른 형태로 변환
              const correctedAudioUrl = this.correctAudioUrl(response.audio_url);
              console.log(`수정된 음성 URL: ${correctedAudioUrl}`);
              
              this.updateMessageVoiceStatus(item.npcId, item.messageId, false, true, false, false, correctedAudioUrl);
              
              // 자동 비디오 생성 제거 - 이제 수동으로만 생성
              // this.queueVideoGeneration(item.npcId, item.message, correctedAudioUrl);
              
              resolve();
            } else {
              console.error('음성 생성 실패:', response.error || response.message);
              this.updateMessageVoiceStatus(item.npcId, item.messageId, false, false, false, false);
              reject(new Error(response.error || response.message || '음성 생성 실패'));
            }
          },
          error: (error) => {
            console.error('음성 생성 요청 실패:', error);
            this.updateMessageVoiceStatus(item.npcId, item.messageId, false, false, false, false);
            reject(error);
          }
        });
    });
  }

  /**
   * 큐에서 비디오 생성 처리
   */
  private async processVideoGeneration(item: VideoQueueItem): Promise<void> {
    console.log(`비디오 생성 시작: NPC ${item.npcId}`);
    
    // 비디오 생성 상태 업데이트
    this.updateMessageVoiceStatus(item.npcId, item.messageId, false, true, true, false, item.audioUrl);

    try {
      // 이미지와 음성을 Base64로 변환하여 SadTalker에 전송
      const [imageBase64, audioBase64] = await Promise.all([
        this.convertImageToBase64(item.npcImageUrl),
        this.convertAudioToBase64(item.audioUrl)
      ]);

      const POSE_STYLE_MAP = {
        "still": 0, "subtle": 2, "talk": 6, "presentation": 10,
        "expressive": 15, "energetic": 25, "dance": 35, "wild": 42
      };

      const videoRequest: TalkingVideoRequest = {
        image_data: imageBase64,
        audio_data: audioBase64,
        still: false,
        expression_scale: 1.0,
        output_format: 'mp4',
        fps: 25
      };

      const response = await this.http.post<TalkingVideoResponse>(`${this.sadtalkerBaseUrl}/generate`, videoRequest, this.httpOptions).toPromise();

      if (response && response.success && response.video_url) {
        console.log(`비디오 생성 성공: ${response.video_url}`);
        
        // 비디오 URL을 절대 경로로 변환
        const correctedVideoUrl = this.correctVideoUrl(response.video_url);
        console.log(`수정된 비디오 URL: ${correctedVideoUrl}`);
        
        this.updateMessageVideoStatus(item.npcId, item.messageId, false, true, correctedVideoUrl);
      } else {
        console.error('비디오 생성 실패:', response?.error || response?.message);
        this.updateMessageVoiceStatus(item.npcId, item.messageId, false, true, false, false, item.audioUrl);
        throw new Error(response?.error || response?.message || '비디오 생성 실패');
      }
    } catch (error) {
      console.error('비디오 생성 오류:', error);
      this.updateMessageVoiceStatus(item.npcId, item.messageId, false, true, false, false, item.audioUrl);
      throw error;
    }
  }

  /**
   * 음성 URL을 올바른 형태로 수정
   */
  private correctAudioUrl(originalUrl: string): string {
    if (!originalUrl) return originalUrl;

    // 파일명 추출
    const filename = originalUrl.split('/').pop() || '';
    
    // 여러 URL 형태 시도 (직접 서버 접근을 기본으로)
    const possibleUrls = [
      // 방법 1: 직접 서버 접근 (개발 환경)
      `http://localhost:5001/api/voice/audio/${filename}`,
      // 방법 2: 프록시를 통한 접근
      `/api/voice/audio/${filename}`,
      // 방법 3: 원본 URL이 이미 올바른 경우
      originalUrl
    ];

    // 첫 번째 URL 반환 (나중에 재생 시 여러 URL을 시도할 수 있도록)
    return possibleUrls[0];
  }

  /**
   * 메시지의 음성 상태 업데이트
   */
  private updateMessageVoiceStatus(
    npcId: string, 
    messageId: string, 
    isGenerating: boolean, 
    generated: boolean, 
    isGeneratingVideo: boolean,
    videoGenerated: boolean,
    voiceUrl?: string
  ): void {
    const session = this.activeSessions.get(npcId);
    if (!session) return;

    const messageIndex = session.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    session[messageIndex] = {
      ...session[messageIndex],
      isGeneratingVoice: isGenerating,
      voiceGenerated: generated,
      isGeneratingVideo: isGeneratingVideo,
      videoGenerated: videoGenerated,
      voiceUrl: voiceUrl
    };

    this.sessionsSubject.next(this.activeSessions);
  }

  /**
   * NPC에 음성 배우 매핑 설정
   */
  setNPCVoiceMapping(npcId: string, voiceActorId: string): void {
    this.npcVoiceMappings.set(npcId, voiceActorId);
    console.log(`NPC ${npcId}에 음성 배우 ${voiceActorId} 매핑됨`);
  }

  /**
   * NPC의 음성 배우 매핑 가져오기
   */
  getNPCVoiceMapping(npcId: string): string | undefined {
    return this.npcVoiceMappings.get(npcId);
  }

  /**
   * 모든 NPC 음성 매핑 가져오기
   */
  getAllNPCVoiceMappings(): Map<string, string> {
    return new Map(this.npcVoiceMappings);
  }

  /**
   * 특정 메시지의 음성 재생
   */
  playMessageVoice(voiceUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(voiceUrl);
      
      audio.addEventListener('ended', () => resolve());
      audio.addEventListener('error', (error) => reject(error));
      
      audio.play().catch(reject);
    });
  }

  /**
   * 비디오 URL을 올바른 형태로 수정
   */
  private correctVideoUrl(originalUrl: string): string {
    if (!originalUrl) return originalUrl;

    // SadTalker 서버의 비디오 URL을 절대 경로로 변환
    if (originalUrl.startsWith('/api/talking/videos/')) {
      return `http://localhost:5002${originalUrl}`;
    }
    
    return originalUrl;
  }

  /**
   * 메시지의 비디오 상태 업데이트
   */
  private updateMessageVideoStatus(
    npcId: string, 
    messageId: string, 
    isGenerating: boolean, 
    generated: boolean, 
    videoUrl?: string
  ): void {
    const session = this.activeSessions.get(npcId);
    if (!session) return;

    const messageIndex = session.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    session[messageIndex] = {
      ...session[messageIndex],
      isGeneratingVideo: isGenerating,
      videoGenerated: generated,
      talkingVideoUrl: videoUrl
    };

    this.sessionsSubject.next(this.activeSessions);
  }

  /**
   * 이미지 URL을 Base64로 변환
   */
  private async convertImageToBase64(imageUrl: string): Promise<string> {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('이미지 Base64 변환 실패:', error);
      throw error;
    }
  }

  /**
   * 음성 URL을 Base64로 변환
   */
  private async convertAudioToBase64(audioUrl: string): Promise<string> {
    try {
      const response = await fetch(audioUrl);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('음성 Base64 변환 실패:', error);
      throw error;
    }
  }

  /**
   * 세션 히스토리 조회
   */
  getSessionHistory(npcId: string): Observable<SessionResponse> {
    return this.http.get<SessionResponse>(`${this.baseUrl}/session/${npcId}`, this.httpOptions)
      .pipe(
        catchError(error => {
          console.error('세션 히스토리 조회 오류:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * 세션 삭제
   */
  clearSession(npcId: string): Observable<{message: string}> {
    return this.http.delete<{message: string}>(`${this.baseUrl}/session/${npcId}`, this.httpOptions)
      .pipe(
        map(response => {
          // 로컬 세션도 삭제
          this.activeSessions.delete(npcId);
          this.sessionsSubject.next(this.activeSessions);
          // 해당 NPC의 큐 아이템들도 제거
          this.removeNPCFromQueue(npcId);
          return response;
        }),
        catchError(error => {
          console.error('세션 삭제 오류:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * 특정 NPC의 대화 히스토리 반환
   */
  getLocalSession(npcId: string): DialogueMessage[] {
    return this.activeSessions.get(npcId) || [];
  }

  /**
   * NPC 선택
   */
  selectNPC(npc: NPCProfile | null) {
    this.selectedNPCSubject.next(npc);
  }

  /**
   * 현재 선택된 NPC 반환
   */
  getSelectedNPC(): NPCProfile | null {
    return this.selectedNPCSubject.value;
  }

  /**
   * 모든 로컬 세션 지우기
   */
  clearAllLocalSessions() {
    this.activeSessions.clear();
    this.sessionsSubject.next(this.activeSessions);
    // 모든 큐 아이템 제거
    this.clearQueue();
  }

  /**
   * 활성 세션 수 반환
   */
  getActiveSessionCount(): number {
    return this.activeSessions.size;
  }

  /**
   * 특정 NPC의 큐 아이템들 제거
   */
  private removeNPCFromQueue(npcId: string): void {
    this.mediaQueue.removeByNPC(npcId);
  }

  /**
   * 퀘스트 수락 처리
   */
  acceptQuest(questOffer: QuestOffer): void {
    console.log('퀘스트 수락:', questOffer);
    // 여기서 퀘스트를 게임 상태에 추가하는 로직 구현
    // 예: GameWorldService와 연동
  }

  /**
   * 퀘스트 거절 처리
   */
  rejectQuest(questOffer: QuestOffer): void {
    console.log('퀘스트 거절:', questOffer);
    // 퀘스트 거절 로직 구현
  }
} 