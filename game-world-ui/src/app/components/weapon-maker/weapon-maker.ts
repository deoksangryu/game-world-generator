import { Component, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import { OrbitControls } from 'three-stdlib';

interface WeaponType {
  id: 'sword' | 'axe';
  name: string;
  emoji: string;
  moldPath: string;
  maskPath: string;
  description: string;
}

interface WeaponImageRequest {
  name: string;
  description: string;
  weapon_shape: 'sword' | 'axe';
  image_url?: string;
}

interface WeaponImageResponse {
  success: boolean;
  message: string;
  image_url?: string;
  generation_time?: number;
  error?: string;
}

interface Model3DRequest {
  image_base64: string;
  foreground_ratio?: number;
  texture_resolution?: number;
  remesh_option?: string;
  target_vertex_count?: number;
  texture_format?: 'png' | 'jpg';
}

// 저장된 무기 정보 인터페이스 추가
interface SavedWeapon {
  id: string;
  name: string;
  description: string;
  weaponType: 'sword' | 'axe' | 'custom';
  imageUrl: string;
  createdAt: Date;
  thumbnail?: string;
}

@Component({
  selector: 'app-weapon-maker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './weapon-maker.html',
  styleUrls: ['./weapon-maker.scss']
})
export class WeaponMakerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('moldCanvas', { static: false }) moldCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('moldFileInput', { static: false }) moldFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('maskFileInput', { static: false }) maskFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('loadedImageFileInput', { static: false }) loadedImageFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('model3DViewer', { static: false }) model3DViewer!: ElementRef<HTMLDivElement>;

  private ctx!: CanvasRenderingContext2D;
  private maskCanvas!: HTMLCanvasElement;
  private maskCtx!: CanvasRenderingContext2D;
  private tempCanvas!: HTMLCanvasElement;
  private tempCtx!: CanvasRenderingContext2D;

  private moldImg: HTMLImageElement | null = null;
  private maskReady = false;

  isLoadButtonDisabled = false;
  isStartButtonDisabled = true;
  errorMessage = '';
  
  // 서버 요청 관련 상태
  isGenerating = false;
  generationProgress = '';
  resultImageUrl = '';
  animationId: number | null = null;
  
  // 3D 모델 생성 관련 상태
  isGenerating3D = false;
  model3DProgress = '';
  model3DUrl = '';
  model3DFileSize = '';
  model3DProcessingTime = '';
  
  // 애니메이션 상태
  animationStartTime: number | null = null;
  shouldCompleteQuickly = false;
  quickCompletionStartTime: number | null = null;
  progressWhenQuickStart = 0;
  
  // 사용자 입력
  weaponDescription = '';

  // 생성 모델 선택
  useFluxModel = false; // 기본적으로 기존 모델 사용

  // 무기 타입 선택 관련
  selectedWeaponType: 'sword' | 'axe' | 'custom' = 'sword';
  isCustomMode = false;

  // 사전 정의된 무기 타입들
  weaponTypes: WeaponType[] = [
    {
      id: 'sword',
      name: '검',
      emoji: '⚔️',
      moldPath: './assets/Sword/sword_panel.png',
      maskPath: './assets/Sword/sword_shape.png',
      description: '전설의 검을 주조합니다'
    },
    {
      id: 'axe',
      name: '도끼',
      emoji: '🪓',
      moldPath: './assets/Axe/axe_panel.png',
      maskPath: './assets/Axe/axe_shape.png',
      description: '강력한 도끼를 주조합니다'
    }
  ];

  // 무기 불러오기 관련 상태 추가
  showSavedWeapons = false;
  savedWeapons: SavedWeapon[] = [];
  selectedSavedWeapon: SavedWeapon | null = null;
  isLoadingFromFile = false;

  // Three.js 3D 뷰어 관련
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private currentModel: THREE.Object3D | null = null;
  private animationFrameId: number | null = null;

  // 3D 뷰어 상태
  show3DViewer = false;
  is3DViewerInitialized = false;

  constructor(private http: HttpClient) {}

  ngAfterViewInit() {
    console.log('🚀 WeaponMaker 초기화 시작');
    this.initializeCanvas();
    console.log('✅ 캔버스 초기화 완료');
    
    // 저장된 무기 목록 미리 로드
    this.loadSavedWeaponsToMemory();
    
    // 기본적으로 검 선택 및 설명 설정
    setTimeout(() => {
      console.log('⚔️ 기본 검 타입 선택 시작');
      this.selectWeaponType('sword');
    }, 100); // 약간의 지연을 주어 DOM이 완전히 준비되도록 함
  }

  private initializeCanvas() {
    const canvas = this.moldCanvas.nativeElement;
    canvas.width = 768;
    canvas.height = 768;
    
    this.ctx = canvas.getContext('2d')!;
    
    // 마스크 캔버스 생성
    this.maskCanvas = document.createElement('canvas');
    this.maskCanvas.width = canvas.width;
    this.maskCanvas.height = canvas.height;
    this.maskCtx = this.maskCanvas.getContext('2d')!;
    
    // 임시 캔버스 생성 (용융 금속 처리용)
    this.tempCanvas = document.createElement('canvas');
    this.tempCanvas.width = canvas.width;
    this.tempCanvas.height = canvas.height;
    this.tempCtx = this.tempCanvas.getContext('2d')!;
  }

  // 무기 타입 선택
  selectWeaponType(weaponType: 'sword' | 'axe') {
    console.log(`🎯 무기 타입 선택: ${weaponType}`);
    this.selectedWeaponType = weaponType;
    this.isCustomMode = false;
    this.errorMessage = '';
    
    // 기본 설명을 자동으로 설정
    const weapon = this.weaponTypes.find(w => w.id === weaponType);
    if (weapon) {
      console.log(`📝 기본 설명 설정: ${weapon.description}`);
      this.weaponDescription = weapon.description;
    }
    
    console.log(`🖼️ 이미지 로딩 시작: ${weaponType}`);
    this.loadPresetWeapon(weaponType);
  }

  // 커스텀 모드 활성화
  enableCustomMode() {
    this.selectedWeaponType = 'custom';
    this.isCustomMode = true;
    this.errorMessage = '';
    this.weaponDescription = '사용자가 직접 설계한 특별한 무기입니다.';
    this.isStartButtonDisabled = true;
    this.clearCanvas();
  }

  // 사전 정의된 무기 로드
  async loadPresetWeapon(weaponType: 'sword' | 'axe') {
    const weapon = this.weaponTypes.find(w => w.id === weaponType);
    if (!weapon) {
      console.error(`❌ 무기 타입을 찾을 수 없음: ${weaponType}`);
      return;
    }

    console.log(`🔄 ${weapon.name} 이미지 로딩 시작...`);
    console.log(`📁 주조틀 경로: ${weapon.moldPath}`);
    console.log(`🎭 마스크 경로: ${weapon.maskPath}`);
    
    this.isStartButtonDisabled = true;
    this.isLoadButtonDisabled = true;

    try {
      const [moldImgRaw, maskImgRaw] = await Promise.all([
        this.loadImageFromPath(weapon.moldPath),
        this.loadImageFromPath(weapon.maskPath)
      ]);

      console.log(`✅ 이미지 로딩 성공`);
      this.moldImg = moldImgRaw;
      this.prepareMask(maskImgRaw);
      this.renderInitial();
      this.isStartButtonDisabled = false;
      
      console.log(`🎉 ${weapon.name} 준비 완료!`);
    } catch (error) {
      console.error(`❌ ${weapon.name} 이미지 로딩 실패:`, error);
      this.errorMessage = `${weapon.name} 이미지를 불러올 수 없습니다. 파일이 존재하는지 확인해주세요.`;
    } finally {
      this.isLoadButtonDisabled = false;
    }
  }

  // 경로에서 이미지 로드
  private loadImageFromPath(path: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load ${path}`));
      img.src = path;
    });
  }

  // 커스텀 이미지 로드 (기존 기능)
  async onLoadImages() {
    this.errorMessage = '';
    
    const moldFiles = this.moldFileInput.nativeElement.files;
    const maskFiles = this.maskFileInput.nativeElement.files;
    
    if (!moldFiles?.[0] || !maskFiles?.[0]) {
      this.errorMessage = '주조틀과 마스크 이미지를 모두 선택해주세요.';
      return;
    }

    this.isStartButtonDisabled = true;
    this.isLoadButtonDisabled = true;

    try {
      const [moldImgRaw, maskImgRaw] = await Promise.all([
        this.fileToImg(moldFiles[0]),
        this.fileToImg(maskFiles[0])
      ]);

      this.moldImg = moldImgRaw;
      this.prepareMask(maskImgRaw);
      this.renderInitial();
      this.isStartButtonDisabled = false;
    } catch (error) {
      console.error(error);
      this.errorMessage = error instanceof Error ? error.message : '이미지 로딩에 실패했습니다';
    } finally {
      this.isLoadButtonDisabled = false;
    }
  }

  private fileToImg(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => reject(new Error('Failed to load ' + file.name));
      img.src = url;
    });
  }

  private prepareMask(img: HTMLImageElement) {
    console.log('🎭 마스크 준비 시작...');
    this.maskCtx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
    this.maskCtx.drawImage(img, 0, 0, this.maskCanvas.width, this.maskCanvas.height);
    
    const imageData = this.maskCtx.getImageData(0, 0, this.maskCanvas.width, this.maskCanvas.height);
    const data = imageData.data;
    let whitePixels = 0;
    let totalPixels = data.length / 4;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const brightness = (r + g + b) / 3;
      
      if (brightness > 200) {
        whitePixels++;
        data[i] = 255;     // R
        data[i + 1] = 255; // G
        data[i + 2] = 255; // B
        data[i + 3] = 255; // A - 밝은 부분만 불투명
      } else {
        data[i] = 0;       // R
        data[i + 1] = 0;   // G
        data[i + 2] = 0;   // B
        data[i + 3] = 0;   // A - 어두운 부분은 투명
      }
    }
    
    this.maskCtx.putImageData(imageData, 0, 0);
    this.maskReady = true;
    
    console.log(`✅ 마스크 준비 완료! 전체 픽셀: ${totalPixels}, 흰색 픽셀: ${whitePixels} (${(whitePixels/totalPixels*100).toFixed(1)}%)`);
  }

  private renderInitial() {
    if (!this.moldImg) return;
    
    const canvas = this.moldCanvas.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.ctx.drawImage(this.moldImg, 0, 0, canvas.width, canvas.height);
  }

  private clearCanvas() {
    const canvas = this.moldCanvas.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.moldImg = null;
    this.maskReady = false;
  }

  onStartPour() {
    console.log('🔄 주조 시작 시도...');
    console.log('maskReady:', this.maskReady);
    console.log('moldImg:', this.moldImg);
    console.log('useFluxModel:', this.useFluxModel);
    
    if (!this.maskReady || !this.moldImg) {
      console.error('❌ 주조 준비 미완료');
      this.errorMessage = '주조틀과 마스크가 준비되지 않았습니다.';
      return;
    }
    
    console.log('✅ 주조 시작!');
    this.errorMessage = '';
    this.isStartButtonDisabled = true;
    this.isGenerating = true;
    this.generationProgress = '🔥 주조 시작...';
    
    // 선택된 모델에 따라 다른 함수 호출
    if (this.useFluxModel) {
      console.log('🎨 FLUX 모델을 사용하여 무기 생성 시작');
      this.requestFluxWeaponGeneration();
    } else {
      console.log('⚔️ 기존 모델을 사용하여 무기 생성 시작');
      this.requestWeaponGeneration();
    }
    
    // 애니메이션 시작 (무한 루프로 변경)
    this.startInfiniteAnimation();
  }

  private startInfiniteAnimation() {
    this.animationStartTime = null;
    this.shouldCompleteQuickly = false;
    this.quickCompletionStartTime = null;
    this.progressWhenQuickStart = 0;
    
    const animate = (currentTime: number) => {
      if (!this.animationStartTime) this.animationStartTime = currentTime;
      
      let progress: number;
      
      if (this.shouldCompleteQuickly) {
        // 빠른 완료 모드
        if (!this.quickCompletionStartTime) {
          this.quickCompletionStartTime = currentTime;
        }
        
        const quickElapsed = currentTime - this.quickCompletionStartTime;
        const quickDuration = 2000; // 2초 안에 완료
        const quickProgress = Math.min(quickElapsed / quickDuration, 1);
        
        // 현재 진행률에서 1.0까지 빠르게 진행
        progress = this.progressWhenQuickStart + (1 - this.progressWhenQuickStart) * this.easeInOut(quickProgress);
        
        if (quickProgress >= 1) {
          // 완료
          progress = 1;
          this.isGenerating = false;
          this.isStartButtonDisabled = false;
          this.animationId = null;
          
          // 결과 표시
          setTimeout(() => {
            this.showResult();
          }, 500);
          return;
        }
      } else {
        // 천천히 진행 모드 (30초에 걸쳐 0.8까지만)
        const slowElapsed = currentTime - this.animationStartTime;
        const slowDuration = 30000; // 30초
        const rawProgress = Math.min(slowElapsed / slowDuration, 1);
        
        // 0.8까지만 천천히 진행 (서버 응답을 위해 여유 남김)
        progress = 0.8 * this.easeInOut(rawProgress);
      }
      
      try {
        this.drawFrame(progress);
      } catch (error) {
        console.error('❌ 애니메이션 오류:', error);
        this.stopAnimation();
        return;
      }
      
      // 생성 중이면 애니메이션 계속
      if (this.isGenerating) {
        this.animationId = requestAnimationFrame(animate);
      } else {
        this.animationId = null;
        this.isStartButtonDisabled = false;
      }
    };
    
    this.animationId = requestAnimationFrame(animate);
  }

  private stopAnimation() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.isGenerating = false;
    this.isStartButtonDisabled = false;
    
    // 애니메이션 상태 초기화
    this.animationStartTime = null;
    this.shouldCompleteQuickly = false;
    this.quickCompletionStartTime = null;
    this.progressWhenQuickStart = 0;
  }

  private async requestWeaponGeneration() {
    try {
      const selectedWeapon = this.getSelectedWeaponInfo();
      if (!selectedWeapon && !this.isCustomMode) {
        throw new Error('무기 타입이 선택되지 않았습니다.');
      }

      // 사용자 설명이 비어있으면 기본값 사용
      const description = "반드시 무기 실루엣 이외의 영역에 그리지 않아야 합니다. " + this.weaponDescription.trim() || 
        (selectedWeapon ? selectedWeapon.description : '사용자 정의 무기');

      this.generationProgress = '⚔️ AI가 무기를 생성하고 있습니다...';
      
      const request: WeaponImageRequest = {
        name: selectedWeapon ? `전설의 ${selectedWeapon.name}` : '커스텀 무기',
        description: description,
        weapon_shape: this.isCustomMode ? 'sword' : selectedWeapon!.id
      };

      console.log('🚀 서버 요청:', request);
      
      const response = await this.http.post<WeaponImageResponse>(
        '/api/game-world/generate-weapon-image', 
        request
      ).toPromise();

      console.log('✅ 서버 응답:', response);

      if (response?.success && response.image_url) {
        this.generationProgress = '✨ 주조 완료!';
        this.resultImageUrl = response.image_url;
        
        // 애니메이션을 빠르게 완료 모드로 전환
        this.triggerQuickCompletion();
        
      } else {
        throw new Error(response?.error || '무기 생성에 실패했습니다.');
      }

    } catch (error) {
      console.error('❌ 무기 생성 오류:', error);
      this.errorMessage = error instanceof Error ? error.message : '무기 생성 중 오류가 발생했습니다.';
      this.generationProgress = '❌ 주조 실패';
      
      setTimeout(() => {
        this.stopAnimation();
      }, 1000);
    }
  }

  // FLUX 모델을 사용한 무기 생성 (stable-fast-3d 서버 직접 호출)
  private async requestFluxWeaponGeneration() {
    try {
      const selectedWeapon = this.getSelectedWeaponInfo();
      if (!selectedWeapon && !this.isCustomMode) {
        throw new Error('무기 타입이 선택되지 않았습니다.');
      }

      // 사용자 설명이 비어있으면 기본값 사용
      const description = this.weaponDescription.trim() || 
        (selectedWeapon ? selectedWeapon.description : '사용자 정의 무기');

      this.generationProgress = '🎨 FLUX AI가 무기를 생성하고 있습니다...';
      
      const request: WeaponImageRequest = {
        name: selectedWeapon ? `전설의 ${selectedWeapon.name}` : '커스텀 무기',
        description: description,
        weapon_shape: this.isCustomMode ? 'sword' : selectedWeapon!.id
      };

      console.log('🎨 FLUX 서버 요청:', request);
      
      // stable-fast-3d 서버로 직접 요청 (8003 포트)
      const response = await fetch('http://localhost:8003/generate-weapon-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`FLUX 서버 오류: ${response.status} - ${errorText}`);
      }

      const result: WeaponImageResponse = await response.json();
      console.log('✅ FLUX 서버 응답:', result);

      if (result?.success && result.image_url) {
        this.generationProgress = '✨ FLUX 주조 완료!';
        this.resultImageUrl = result.image_url;
        
        // 애니메이션을 빠르게 완료 모드로 전환
        this.triggerQuickCompletion();
        
      } else {
        throw new Error(result?.error || 'FLUX 무기 생성에 실패했습니다.');
      }

    } catch (error) {
      console.error('❌ FLUX 무기 생성 오류:', error);
      this.errorMessage = error instanceof Error ? error.message : 'FLUX 무기 생성 중 오류가 발생했습니다.';
      this.generationProgress = '❌ FLUX 주조 실패';
      
      setTimeout(() => {
        this.stopAnimation();
      }, 1000);
    }
  }

  private showResult() {
    if (this.resultImageUrl) {
      // 결과 이미지를 표시하는 로직
      console.log('🎉 생성된 무기 이미지:', this.resultImageUrl);
      // TODO: 결과 이미지를 UI에 표시
    }
  }

  resetForging() {
    this.resultImageUrl = '';
    this.generationProgress = '';
    this.errorMessage = '';
    this.isGenerating = false;
    this.isStartButtonDisabled = false;
    
    // 캔버스 초기화
    if (this.moldImg) {
      this.renderInitial();
    }
    
    console.log('🔄 주조 상태 리셋 완료');
  }

  async downloadWeaponImage() {
    if (!this.resultImageUrl) {
      console.error('❌ 다운로드할 이미지가 없습니다');
      return;
    }

    try {
      console.log('💾 이미지 다운로드 시작...');
      
      // 이미지를 fetch하여 blob으로 변환
      const response = await fetch(this.resultImageUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      
      // 파일명 생성 (무기 타입 + 타임스탬프)
      const selectedWeapon = this.getSelectedWeaponInfo();
      const weaponName = selectedWeapon ? selectedWeapon.name : '커스텀무기';
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `전설의_${weaponName}_${timestamp}.png`;
      
      // 다운로드 링크 생성 및 실행
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // 로컬 스토리지에 무기 정보 저장
      await this.saveWeaponToLocal(filename, weaponName);
      
      console.log(`✅ 이미지 다운로드 완료: ${filename}`);
      
    } catch (error) {
      console.error('❌ 이미지 다운로드 실패:', error);
      this.errorMessage = '이미지 다운로드에 실패했습니다.';
    }
  }

  // 무기를 로컬 스토리지에 저장
  private async saveWeaponToLocal(filename: string, weaponName: string) {
    try {
      const weaponData: SavedWeapon = {
        id: this.generateUniqueId(),
        name: filename.replace('.png', ''),
        description: this.weaponDescription,
        weaponType: this.selectedWeaponType,
        imageUrl: this.resultImageUrl,
        createdAt: new Date(),
        thumbnail: await this.createThumbnail(this.resultImageUrl)
      };

      const existingSavedWeapons = JSON.parse(localStorage.getItem('savedWeapons') || '[]');
      existingSavedWeapons.push(weaponData);
      localStorage.setItem('savedWeapons', JSON.stringify(existingSavedWeapons));
      
      console.log('💾 무기 정보가 로컬에 저장되었습니다:', weaponData.name);
    } catch (error) {
      console.error('❌ 무기 저장 실패:', error);
    }
  }

  // 고유 ID 생성
  private generateUniqueId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // 썸네일 생성
  private async createThumbnail(imageUrl: string): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        // 썸네일 크기 설정
        const thumbnailSize = 150;
        canvas.width = thumbnailSize;
        canvas.height = thumbnailSize;
        
        // 이미지를 썸네일 크기로 그리기
        ctx.drawImage(img, 0, 0, thumbnailSize, thumbnailSize);
        
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => resolve('');
      img.src = imageUrl;
    });
  }

  // 저장된 무기 목록 불러오기
  loadSavedWeapons() {
    try {
      const saved = localStorage.getItem('savedWeapons');
      if (saved) {
        this.savedWeapons = JSON.parse(saved).map((weapon: any) => ({
          ...weapon,
          createdAt: new Date(weapon.createdAt)
        }));
        // 최신순으로 정렬
        this.savedWeapons.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }
      this.showSavedWeapons = true;
      console.log(`📂 저장된 무기 ${this.savedWeapons.length}개를 불러왔습니다`);
    } catch (error) {
      console.error('❌ 저장된 무기 목록 불러오기 실패:', error);
      this.errorMessage = '저장된 무기 목록을 불러올 수 없습니다.';
    }
  }

  // 저장된 무기 선택
  selectSavedWeapon(weapon: SavedWeapon) {
    this.selectedSavedWeapon = weapon;
    console.log('🎯 저장된 무기 선택:', weapon.name);
  }

  // 선택된 저장된 무기 불러오기
  loadSelectedWeapon() {
    if (!this.selectedSavedWeapon) {
      this.errorMessage = '불러올 무기를 선택해주세요.';
      return;
    }

    try {
      // 무기 정보 적용
      this.weaponDescription = this.selectedSavedWeapon.description;
      this.selectedWeaponType = this.selectedSavedWeapon.weaponType;
      this.resultImageUrl = this.selectedSavedWeapon.imageUrl;
      
      // 커스텀 모드 설정
      if (this.selectedSavedWeapon.weaponType === 'custom') {
        this.isCustomMode = true;
      } else {
        this.isCustomMode = false;
      }
      
      // UI 상태 업데이트
      this.isStartButtonDisabled = false;
      this.showSavedWeapons = false;
      this.errorMessage = '';
      
      console.log('✅ 저장된 무기를 성공적으로 불러왔습니다:', this.selectedSavedWeapon.name);
      
    } catch (error) {
      console.error('❌ 무기 불러오기 실패:', error);
      this.errorMessage = '무기를 불러오는데 실패했습니다.';
    }
  }

  // 저장된 무기 삭제
  deleteSavedWeapon(weapon: SavedWeapon) {
    try {
      this.savedWeapons = this.savedWeapons.filter(w => w.id !== weapon.id);
      localStorage.setItem('savedWeapons', JSON.stringify(this.savedWeapons));
      
      if (this.selectedSavedWeapon?.id === weapon.id) {
        this.selectedSavedWeapon = null;
      }
      
      console.log('🗑️ 저장된 무기가 삭제되었습니다:', weapon.name);
    } catch (error) {
      console.error('❌ 무기 삭제 실패:', error);
      this.errorMessage = '무기 삭제에 실패했습니다.';
    }
  }

  // 파일에서 무기 이미지 불러오기
  async loadWeaponFromFile() {
    const fileInput = this.loadedImageFileInput.nativeElement;
    const file = fileInput.files?.[0];
    
    if (!file) {
      this.errorMessage = '불러올 파일을 선택해주세요.';
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.errorMessage = '이미지 파일만 선택할 수 있습니다.';
      return;
    }

    try {
      this.isLoadingFromFile = true;
      console.log('📁 파일에서 무기 이미지 불러오기 시작...');
      
      // 파일을 데이터 URL로 변환
      const dataUrl = await this.fileToDataUrl(file);
      
      // 결과 이미지로 설정
      this.resultImageUrl = dataUrl;
      
      // 파일명에서 무기 정보 추출 시도
      const fileName = file.name.replace(/\.[^/.]+$/, ''); // 확장자 제거
      this.weaponDescription = `파일에서 불러온 무기: ${fileName}`;
      
      // UI 상태 업데이트
      this.isStartButtonDisabled = false;
      this.errorMessage = '';
      
      console.log('✅ 파일에서 무기 이미지를 성공적으로 불러왔습니다');
      
    } catch (error) {
      console.error('❌ 파일에서 무기 불러오기 실패:', error);
      this.errorMessage = '파일에서 무기를 불러오는데 실패했습니다.';
    } finally {
      this.isLoadingFromFile = false;
    }
  }

  // 파일을 데이터 URL로 변환
  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // 저장된 무기 창 닫기
  closeSavedWeapons() {
    this.showSavedWeapons = false;
    this.selectedSavedWeapon = null;
  }

  setExampleDescription(type: string) {
    const examples = {
      'dragon': '용의 숨결이 깃든 전설의 검. 적에게 화염 피해를 주며, 용의 비늘로 만든 손잡이가 특징입니다.',
      'ice': '영원한 겨울의 힘을 담은 마법 도끼. 적을 얼려 움직임을 봉쇄하고, 차가운 서리가 끊임없이 피어오릅니다.',
      'lightning': '천둥신의 축복을 받은 신성한 망치. 번개를 소환하여 적을 타격하며, 폭풍우를 부를 수 있습니다.',
      'shadow': '어둠의 마법사가 만든 그림자 단검. 은밀한 암살에 특화되어 있으며, 그림자 속으로 숨을 수 있게 해줍니다.'
    };
    
    this.weaponDescription = examples[type as keyof typeof examples] || this.weaponDescription;
  }

  private drawFrame(progress: number) {
    const canvas = this.moldCanvas.nativeElement;
    if (!canvas || !this.ctx) {
      console.error('❌ 캔버스 또는 컨텍스트가 없습니다');
      return;
    }
    
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1) 항상 주조틀 이미지를 배경으로 그리기
    if (this.moldImg) {
      this.ctx.drawImage(this.moldImg, 0, 0, canvas.width, canvas.height);
    }

    // 2) 임시 캔버스에서 용융 금속 처리
    if (!this.maskReady || !this.maskCanvas) {
      console.error('❌ 마스크가 준비되지 않았습니다');
      return;
    }
    
    // 용융 금속 높이 계산 (부드러운 easing 적용)
    const easedProgress = this.easeInOut(progress);
    const fillHeight = canvas.height * easedProgress;
    const fillY = canvas.height - fillHeight;
    
    // 애니메이션 진행상황 확인
    if (progress < 0.1) {
      console.log(`진행률: ${(progress * 100).toFixed(1)}%, 채움높이: ${fillHeight.toFixed(1)}px`);
    }
    
    // 임시 캔버스 초기화
    this.tempCtx.clearRect(0, 0, canvas.width, canvas.height);
    this.tempCtx.globalCompositeOperation = 'source-over'; // 초기화
    
    // 기본 용융 금속 색상 (더 화려한 그라디언트)
    const time = Date.now() * 0.001;
    const metalGrad = this.tempCtx.createLinearGradient(0, fillY, 0, canvas.height);
    
    // 시간에 따른 색상 변화
    const heatIntensity = 0.5 + Math.sin(time * 1.5) * 0.3; // 0.2 ~ 0.8
    metalGrad.addColorStop(0, `rgba(255, ${Math.floor(170 + heatIntensity * 85)}, 0, 1)`);    // 동적 주황
    metalGrad.addColorStop(0.2, `rgba(255, ${Math.floor(102 + heatIntensity * 50)}, 0, 1)`);  // 동적 주황
    metalGrad.addColorStop(0.4, `rgba(${Math.floor(221 + heatIntensity * 34)}, 51, 0, 1)`);   // 동적 빨강
    metalGrad.addColorStop(0.6, `rgba(170, 17, 0, 1)`);    // 어두운 빨강
    metalGrad.addColorStop(0.8, `rgba(85, 8, 0, 1)`);      // 매우 어두운 빨강
    metalGrad.addColorStop(1, `rgba(51, 0, 0, 1)`);        // 거의 검정
    
    this.tempCtx.fillStyle = metalGrad;
    this.tempCtx.fillRect(0, fillY, canvas.width, fillHeight);
    
    // 용암 효과 추가 (훨씬 더 화려하게)
    if (fillHeight > 20) {
      
      // 1) 용융 금속 표면 파동 효과
      this.tempCtx.globalCompositeOperation = 'source-atop';
      for (let wave = 0; wave < 3; wave++) {
        const waveGrad = this.tempCtx.createLinearGradient(0, fillY - 15, 0, fillY + 25);
        const waveAlpha = 0.3 + Math.sin(time * (2 + wave * 0.5)) * 0.2;
        waveGrad.addColorStop(0, `rgba(255, 255, 100, ${waveAlpha})`);
        waveGrad.addColorStop(0.5, `rgba(255, 200, 50, ${waveAlpha * 0.7})`);
        waveGrad.addColorStop(1, 'rgba(255, 150, 0, 0)');
        
        this.tempCtx.fillStyle = waveGrad;
        
        // 파동 모양 그리기
        this.tempCtx.beginPath();
        this.tempCtx.moveTo(0, fillY);
        for (let x = 0; x <= canvas.width; x += 5) {
          const waveY = fillY + Math.sin((x / 30) + time * (3 + wave)) * (3 + wave * 2);
          this.tempCtx.lineTo(x, waveY);
        }
        this.tempCtx.lineTo(canvas.width, fillY + 20);
        this.tempCtx.lineTo(0, fillY + 20);
        this.tempCtx.closePath();
        this.tempCtx.fill();
      }
      
      // 2) 강렬한 중심 열기둥 효과
      const heatColumnGrad = this.tempCtx.createLinearGradient(
        canvas.width * 0.4, fillY, 
        canvas.width * 0.6, fillY
      );
      const heatPulse = 0.4 + Math.sin(time * 4) * 0.3;
      heatColumnGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      heatColumnGrad.addColorStop(0.3, `rgba(255, 255, 200, ${heatPulse})`);
      heatColumnGrad.addColorStop(0.5, `rgba(255, 255, 255, ${heatPulse * 1.2})`);
      heatColumnGrad.addColorStop(0.7, `rgba(255, 255, 200, ${heatPulse})`);
      heatColumnGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      this.tempCtx.fillStyle = heatColumnGrad;
      this.tempCtx.fillRect(canvas.width * 0.3, fillY, canvas.width * 0.4, fillHeight);
      
      // 3) 폭발적인 반짝임 파티클 (더 많이, 더 크게)
      for (let i = 0; i < 12; i++) {
        const sparkleX = (Math.sin(time * 2 + i * 0.8) * 0.45 + 0.5) * canvas.width;
        const sparkleY = fillY + (Math.sin(time * 1.8 + i * 0.6) * 0.4 + 0.5) * Math.max(fillHeight - 20, 10);
        
        // 더 큰 반짝임
        const sparkleSize = Math.abs(Math.sin(time * 3.5 + i)) * 6 + 2; // 2~8 범위
        const sparkleAlpha = Math.abs(Math.sin(time * 2.8 + i * 0.9)) * 0.9 + 0.1;
        
        // 다채로운 반짝임 색상
        const colorPhase = (time * 2 + i) % (Math.PI * 2);
        const r = Math.floor(255 * (0.8 + Math.sin(colorPhase) * 0.2));
        const g = Math.floor(255 * (0.6 + Math.sin(colorPhase + Math.PI / 3) * 0.4));
        const b = Math.floor(100 * (0.3 + Math.sin(colorPhase + Math.PI * 2 / 3) * 0.3));
        
        const sparkleGrad = this.tempCtx.createRadialGradient(
          sparkleX, sparkleY, 0,
          sparkleX, sparkleY, sparkleSize * 3
        );
        sparkleGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${sparkleAlpha})`);
        sparkleGrad.addColorStop(0.3, `rgba(${r}, ${Math.floor(g * 0.8)}, ${Math.floor(b * 0.5)}, ${sparkleAlpha * 0.7})`);
        sparkleGrad.addColorStop(0.7, `rgba(${Math.floor(r * 0.6)}, ${Math.floor(g * 0.4)}, 0, ${sparkleAlpha * 0.3})`);
        sparkleGrad.addColorStop(1, 'rgba(255, 100, 0, 0)');
        
        this.tempCtx.fillStyle = sparkleGrad;
        this.tempCtx.beginPath();
        this.tempCtx.arc(sparkleX, sparkleY, sparkleSize, 0, Math.PI * 2);
        this.tempCtx.fill();
        
        // 추가 광채 효과
        if (sparkleSize > 5) {
          const glowGrad = this.tempCtx.createRadialGradient(
            sparkleX, sparkleY, 0,
            sparkleX, sparkleY, sparkleSize * 5
          );
          glowGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${sparkleAlpha * 0.8})`);
          glowGrad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${sparkleAlpha * 0.4})`);
          glowGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          
          this.tempCtx.fillStyle = glowGrad;
          this.tempCtx.beginPath();
          this.tempCtx.arc(sparkleX, sparkleY, sparkleSize * 2, 0, Math.PI * 2);
          this.tempCtx.fill();
        }
      }
    }
    
    // 임시 캔버스에 마스크 적용 (메인 캔버스가 아닌 임시 캔버스에)
    this.tempCtx.globalCompositeOperation = 'destination-in';
    this.tempCtx.drawImage(this.maskCanvas, 0, 0);
    
    // 3) 마스크된 용융 금속을 메인 캔버스에 합성
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.drawImage(this.tempCanvas, 0, 0);
  }

  // 부드러운 easing 함수 추가
  private easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  // 선택된 무기 정보 가져오기
  getSelectedWeaponInfo(): WeaponType | null {
    if (this.isCustomMode) return null;
    return this.weaponTypes.find(w => w.id === this.selectedWeaponType) || null;
  }

  private triggerQuickCompletion() {
    // 현재 진행률을 계산 (천천히 진행 모드에서의 현재 상태)
    if (this.animationStartTime) {
      const slowElapsed = Date.now() - this.animationStartTime;
      const slowDuration = 30000; // 30초
      const rawProgress = Math.min(slowElapsed / slowDuration, 1);
      this.progressWhenQuickStart = 0.8 * this.easeInOut(rawProgress);
    } else {
      this.progressWhenQuickStart = 0;
    }
    
    // 애니메이션을 빠르게 완료 모드로 전환
    this.shouldCompleteQuickly = true;
    this.quickCompletionStartTime = null; // animate 함수에서 설정됨
    
    console.log(`🚀 빠른 완료 모드 시작! 현재 진행률: ${(this.progressWhenQuickStart * 100).toFixed(1)}%`);
  }

  // 3D 모델 생성 요청
  async generate3DModel() {
    if (!this.resultImageUrl) {
      this.errorMessage = '먼저 무기 이미지를 생성해주세요.';
      return;
    }

    this.isGenerating3D = true;
    this.model3DProgress = '🏗️ 3D 모델 생성 중...';
    this.errorMessage = '';

    try {
      console.log('🚀 3D 모델 생성 시작...');
      
      // 이미지를 base64로 변환
      const base64Image = await this.imageUrlToBase64(this.resultImageUrl);
      
      const request: Model3DRequest = {
        image_base64: base64Image,
        foreground_ratio: 0.85,
        texture_resolution: 1024,
        remesh_option: 'none',
        target_vertex_count: -1,
        texture_format: 'png'
      };

      this.model3DProgress = '⚙️ 서버에서 3D 모델 처리 중...';
      console.log('📡 3D 모델 서버 요청 전송...');

      const response = await fetch('http://localhost:8003/generate-3d', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`서버 오류: ${response.status} - ${errorText}`);
      }

      // GLB 파일 다운로드
      const blob = await response.blob();
      this.model3DUrl = URL.createObjectURL(blob);
      
      // 헤더에서 추가 정보 가져오기
      const processingTime = response.headers.get('X-Processing-Time');
      const fileSize = response.headers.get('X-File-Size');
      
      this.model3DProcessingTime = processingTime ? `${parseFloat(processingTime).toFixed(1)}초` : '알 수 없음';
      this.model3DFileSize = fileSize ? `${(parseInt(fileSize) / 1024).toFixed(1)} KB` : '알 수 없음';
      
      this.model3DProgress = '✅ 3D 모델 생성 완료!';
      
      console.log('🎉 3D 모델 생성 성공!');
      console.log(`📊 처리 시간: ${this.model3DProcessingTime}`);
      console.log(`📊 파일 크기: ${this.model3DFileSize}`);

    } catch (error) {
      console.error('❌ 3D 모델 생성 실패:', error);
      this.errorMessage = error instanceof Error ? error.message : '3D 모델 생성 중 오류가 발생했습니다.';
      this.model3DProgress = '❌ 3D 모델 생성 실패';
    } finally {
      this.isGenerating3D = false;
    }
  }

  // 이미지 URL을 base64로 변환
  private async imageUrlToBase64(url: string): Promise<string> {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // "data:image/png;base64," 부분 제거
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      throw new Error('이미지를 base64로 변환하는 중 오류가 발생했습니다.');
    }
  }

  // 3D 모델 다운로드
  download3DModel() {
    if (!this.model3DUrl) {
      console.error('❌ 다운로드할 3D 모델이 없습니다');
      return;
    }

    try {
      const selectedWeapon = this.getSelectedWeaponInfo();
      const weaponName = selectedWeapon ? selectedWeapon.name : '커스텀무기';
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `전설의_${weaponName}_3D모델_${timestamp}.glb`;

      const a = document.createElement('a');
      a.href = this.model3DUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      console.log(`✅ 3D 모델 다운로드 완료: ${filename}`);

    } catch (error) {
      console.error('❌ 3D 모델 다운로드 실패:', error);
      this.errorMessage = '3D 모델 다운로드에 실패했습니다.';
    }
  }

  // 전체 초기화
  resetAll() {
    this.resetForging();
    this.reset3DGeneration();
  }

  // 3D 모델 생성 상태 초기화
  reset3DGeneration() {
    if (this.model3DUrl) {
      URL.revokeObjectURL(this.model3DUrl);
    }
    this.model3DUrl = '';
    this.model3DProgress = '';
    this.model3DFileSize = '';
    this.model3DProcessingTime = '';
    this.isGenerating3D = false;
    
    console.log('🔄 3D 모델 생성 상태 리셋 완료');
  }

  // 저장된 무기 목록을 메모리에 미리 로드 (UI 표시는 하지 않음)
  private loadSavedWeaponsToMemory() {
    try {
      const saved = localStorage.getItem('savedWeapons');
      if (saved) {
        this.savedWeapons = JSON.parse(saved).map((weapon: any) => ({
          ...weapon,
          createdAt: new Date(weapon.createdAt)
        }));
        // 최신순으로 정렬
        this.savedWeapons.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        console.log(`📚 저장된 무기 ${this.savedWeapons.length}개를 메모리에 로드했습니다`);
      }
    } catch (error) {
      console.error('❌ 저장된 무기 목록 로드 실패:', error);
    }
  }

  // 3D 뷰어 초기화
  private init3DViewer() {
    if (this.is3DViewerInitialized || !this.model3DViewer) {
      return;
    }

    try {
      const container = this.model3DViewer.nativeElement;
      const width = container.clientWidth || 400;
      const height = container.clientHeight || 400;

      // 시나리오 생성
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x2a2a3e);

      // 카메라 생성
      this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      this.camera.position.set(0, 0, 5);

      // 렌더러 생성
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(window.devicePixelRatio);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      
      // 컨테이너에 렌더러 추가
      container.appendChild(this.renderer.domElement);

      // 컨트롤 생성
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.25;
      this.controls.enableZoom = true;
      this.controls.autoRotate = true;
      this.controls.autoRotateSpeed = 1.0;

      // 조명 설정
      this.setupLights();

      // 애니메이션 시작
      this.startAnimation();

      this.is3DViewerInitialized = true;
      console.log('✅ 3D 뷰어 초기화 완료');

    } catch (error) {
      console.error('❌ 3D 뷰어 초기화 실패:', error);
    }
  }

  // 조명 설정
  private setupLights() {
    // 환경광
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambientLight);

    // 방향광 (주광원)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);

    // 보조광 (색온도가 다른 조명)
    const light2 = new THREE.DirectionalLight(0x4a90e2, 0.3);
    light2.position.set(-5, 2, 3);
    this.scene.add(light2);

    // 바닥 조명 (아래쪽에서)
    const bottomLight = new THREE.DirectionalLight(0x8b5cf6, 0.2);
    bottomLight.position.set(0, -5, 0);
    this.scene.add(bottomLight);
  }

  // 3D 모델 로드
  async load3DModel(modelUrl: string) {
    if (!this.is3DViewerInitialized) {
      this.init3DViewer();
    }

    try {
      console.log('🚀 3D 모델 로딩 시작:', modelUrl);

      // 기존 모델 제거
      if (this.currentModel) {
        this.scene.remove(this.currentModel);
        this.currentModel = null;
      }

      const loader = new GLTFLoader();
      
      // Promise로 래핑하여 async/await 사용
      const gltf = await new Promise<any>((resolve, reject) => {
        loader.load(
          modelUrl,
          (gltf) => resolve(gltf),
          (progress) => {
            console.log('📊 로딩 진행률:', (progress.loaded / progress.total * 100).toFixed(1) + '%');
          },
          (error) => reject(error)
        );
      });

      const model = gltf.scene;
      
      // 모델 크기 정규화
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2 / maxDim; // 2 유닛 크기로 정규화
      model.scale.setScalar(scale);

      // 모델을 중앙에 배치
      const center = box.getCenter(new THREE.Vector3());
      center.multiplyScalar(scale);
      model.position.sub(center);

      // 그림자 설정
      model.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          
          // 재질 개선
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => {
                if (mat instanceof THREE.MeshStandardMaterial) {
                  mat.envMapIntensity = 1.0;
                  mat.metalness = 0.7;
                  mat.roughness = 0.3;
                }
              });
            } else if (child.material instanceof THREE.MeshStandardMaterial) {
              child.material.envMapIntensity = 1.0;
              child.material.metalness = 0.7;
              child.material.roughness = 0.3;
            }
          }
        }
      });

      this.scene.add(model);
      this.currentModel = model;

      console.log('✅ 3D 모델 로딩 완료');

    } catch (error) {
      console.error('❌ 3D 모델 로딩 실패:', error);
      throw error;
    }
  }

  // 애니메이션 루프
  private startAnimation() {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);
      
      if (this.controls) {
        this.controls.update();
      }
      
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    };
    animate();
  }

  // 3D 뷰어 표시
  async show3DModel() {
    if (!this.model3DUrl) {
      this.errorMessage = '3D 모델이 생성되지 않았습니다.';
      return;
    }

    this.show3DViewer = true;
    
    // DOM 업데이트 후 초기화
    setTimeout(async () => {
      try {
        this.init3DViewer();
        await this.load3DModel(this.model3DUrl);
      } catch (error) {
        console.error('❌ 3D 모델 표시 실패:', error);
        this.errorMessage = '3D 모델을 표시할 수 없습니다.';
      }
    }, 100);
  }

  // 3D 뷰어 닫기
  close3DViewer() {
    this.show3DViewer = false;
    
    // 애니메이션 정지
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // 렌더러 정리
    if (this.renderer) {
      const container = this.model3DViewer?.nativeElement;
      if (container && container.contains(this.renderer.domElement)) {
        container.removeChild(this.renderer.domElement);
      }
      this.renderer.dispose();
    }

    // 리소스 정리
    if (this.currentModel) {
      this.scene?.remove(this.currentModel);
      this.currentModel = null;
    }

    this.is3DViewerInitialized = false;
  }

  // 컴포넌트 파괴시 정리
  ngOnDestroy() {
    this.close3DViewer();
  }
}
