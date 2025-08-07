import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { GameWorld, NPCProfile, ChatMessage } from '../models/game-world.interface';

@Injectable({
  providedIn: 'root'
})
export class GameWorldService {
  private readonly apiUrl = 'http://localhost:8000/api'; // 백엔드 API URL
  
  // Current state management
  private currentWorldSubject = new BehaviorSubject<GameWorld | null>(null);
  private npcProfilesSubject = new BehaviorSubject<NPCProfile[]>([]);
  private selectedNPCSubject = new BehaviorSubject<NPCProfile | null>(null);
  
  public currentWorld$ = this.currentWorldSubject.asObservable();
  public npcProfiles$ = this.npcProfilesSubject.asObservable();
  public selectedNPC$ = this.selectedNPCSubject.asObservable();

  constructor(private http: HttpClient) { }

  // 1. 세계관 확장 생성
  expandGameWorld(originalInput: string): Observable<GameWorld> {
    return this.http.post<GameWorld>(`${this.apiUrl}/world/expand`, {
      originalInput: originalInput
    });
  }

  // 2. NPC 프로필 생성
  generateNPCProfiles(worldId: string): Observable<NPCProfile[]> {
    return this.http.post<NPCProfile[]>(`${this.apiUrl}/npcs/generate`, {
      worldId: worldId
    });
  }

  // 3. NPC 이미지 생성
  generateNPCImage(npcId: string): Observable<{imageUrl: string}> {
    return this.http.post<{imageUrl: string}>(`${this.apiUrl}/npcs/${npcId}/generate-image`, {});
  }

  // 4. NPC와 채팅
  sendChatMessage(npcId: string, message: string): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(`${this.apiUrl}/chat/${npcId}`, {
      message: message
    });
  }

  // 채팅 기록 가져오기
  getChatHistory(npcId: string): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(`${this.apiUrl}/chat/${npcId}/history`);
  }

  // State management methods
  setCurrentWorld(world: GameWorld) {
    this.currentWorldSubject.next(world);
  }

  setNPCProfiles(profiles: NPCProfile[]) {
    this.npcProfilesSubject.next(profiles);
  }

  setSelectedNPC(npc: NPCProfile | null) {
    this.selectedNPCSubject.next(npc);
  }

  getCurrentWorld(): GameWorld | null {
    return this.currentWorldSubject.value;
  }

  getNPCProfiles(): NPCProfile[] {
    return this.npcProfilesSubject.value;
  }

  getSelectedNPC(): NPCProfile | null {
    return this.selectedNPCSubject.value;
  }
}
