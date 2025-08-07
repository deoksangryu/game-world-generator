import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { 
  GameWorld, 
  NPCProfile, 
  HistoryEra, 
  WorldInput,
  WorldGenerationRequest,
  WorldGenerationResponse,
  FullGenerationRequest,
  FullGenerationResponse,
  ServerStatus
} from '../models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class WorldService {
  private worldSubject = new BehaviorSubject<GameWorld | null>(null);
  private npcSubject = new BehaviorSubject<NPCProfile[]>([]);
  private historySubject = new BehaviorSubject<HistoryEra[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);

  currentWorld$ = this.worldSubject.asObservable();
  npcProfiles$ = this.npcSubject.asObservable();
  history$ = this.historySubject.asObservable();
  loading$ = this.loadingSubject.asObservable();

  private readonly API_URL = environment.apiUrl;

  constructor(private http: HttpClient) {
    // 서버 상태 확인
    this.checkServerStatus();
  }

  /**
   * 서버 상태 확인
   */
  checkServerStatus(): Observable<ServerStatus> {
    return this.http.get<ServerStatus>(`${this.API_URL}/health`).pipe(
      tap(status => {
        console.log('Server Status:', status);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * 게임 월드 생성 (서버 API 호출)
   */
  generateWorld(input: WorldInput): Observable<WorldGenerationResponse> {
    this.loadingSubject.next(true);
    
    const request: WorldGenerationRequest = {
      theme: input.genre,
      setting: input.basicSetting,
      conflict: input.mainConflict,
      unique_elements: input.uniqueElements,
      use_search: true
    };

    return this.http.post<WorldGenerationResponse>(`${this.API_URL}/generate-world`, request).pipe(
      tap(response => {
        if (response.success && response.world_data) {
          this.worldSubject.next(response.world_data.world);
          this.npcSubject.next(response.world_data.npcs);
          this.historySubject.next(response.world_data.lore);
          console.log('World generation successful:', response);
        } else {
          console.error('World generation failed:', response.error);
        }
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        return this.handleError(error);
      })
    );
  }

  /**
   * 통합 생성 (월드 + NPC 이미지)
   */
  generateFullWorld(input: WorldInput, generateImages: boolean = true): Observable<FullGenerationResponse> {
    this.loadingSubject.next(true);
    
    const worldRequest: WorldGenerationRequest = {
      theme: input.genre,
      setting: input.basicSetting,
      conflict: input.mainConflict,
      unique_elements: input.uniqueElements,
      use_search: true
    };

    const request: FullGenerationRequest = {
      world_request: worldRequest,
      generate_npc_images: generateImages,
      max_npc_images: 5
    };

    return this.http.post<FullGenerationResponse>(`${this.API_URL}/generate-full`, request).pipe(
      tap(response => {
        if (response.success && response.world_data) {
          this.worldSubject.next(response.world_data.world);
          
          // NPC 이미지 URL 업데이트
          const npcsWithImages = response.world_data.npcs.map(npc => {
            const imageData = response.npc_images.find(img => img.npc_id === npc.id);
            return {
              ...npc,
              imageUrl: imageData ? imageData.image_url : undefined
            };
          });
          
          this.npcSubject.next(npcsWithImages);
          this.historySubject.next(response.world_data.lore);
          
          console.log('Full generation successful:', response);
          console.log(`Generated ${response.npc_images.length} NPC images`);
        } else {
          console.error('Full generation failed:', response.message);
        }
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        return this.handleError(error);
      })
    );
  }

  /**
   * 샘플 월드 데이터 로드 (개발용)
   */
  loadSampleWorld(): void {
    // Mock 데이터 로드 (개발용)
    import('./../mock-data').then(module => {
      const data = module.SAMPLE_WORLD_DATA;
      this.worldSubject.next({
        expandedWorldDescription: data.world.overview,
        theme: data.world.genre,
        setting: data.world.title
      });
      this.npcSubject.next(data.npcs as unknown as NPCProfile[]);
      this.historySubject.next(data.history.map((h: any) => ({
        id: `event-${Date.now()}`,
        type: 'major_event',
        title: h.name,
        date: h.timeframe,
        description: h.description,
        tags: [],
        related: { npcs: [], monsters: [] },
        see_also: []
      })));
    });
  }

  /**
   * 현재 상태 초기화
   */
  clearData(): void {
    this.worldSubject.next(null);
    this.npcSubject.next([]);
    this.historySubject.next([]);
  }

  /**
   * HTTP 에러 처리
   */
  private handleError(error: HttpErrorResponse) {
    let errorMessage = '알 수 없는 오류가 발생했습니다.';
    
    if (error.error instanceof ErrorEvent) {
      // 클라이언트 사이드 에러
      errorMessage = `클라이언트 오류: ${error.error.message}`;
    } else {
      // 서버 사이드 에러
      if (error.status === 0) {
        errorMessage = '서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.';
      } else {
        errorMessage = `서버 오류 (${error.status}): ${error.error?.error || error.message}`;
      }
    }
    
    console.error('WorldService Error:', errorMessage, error);
    return throwError(() => new Error(errorMessage));
  }
} 