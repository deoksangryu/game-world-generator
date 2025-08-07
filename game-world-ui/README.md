# 🏰 Realm Forge - Game World Creator

중세 판타지풍의 게임 세계관 생성 및 NPC 채팅 웹 애플리케이션입니다. 사용자가 간단한 아이디어를 입력하면 LLM이 상업적으로 사용 가능한 수준의 세계관을 확장하고, NPC 캐릭터들을 생성하여 대화할 수 있는 완전한 파이프라인을 제공합니다.

## ✨ 주요 기능

### 🌍 세계관 확장
- 사용자의 간단한 아이디어를 입력받아 LLM이 상세하고 상업적으로 사용 가능한 게임 세계관으로 확장
- 테마, 설정, 배경 스토리 등을 포함한 완전한 세계관 생성

### 👥 NPC 캐릭터 생성
- 생성된 세계관을 바탕으로 다양한 NPC 프로필 자동 생성
- 각 NPC의 이름, 역할, 성격, 외모, 배경 스토리 포함
- 생성형 AI를 통한 캐릭터 이미지 생성

### 💬 실시간 채팅
- 생성된 NPC와 실시간 대화 기능
- 각 NPC의 성격과 배경에 맞는 개성 있는 응답
- 채팅 히스토리 관리

## 🎨 디자인 특징

- **중세 판타지 테마**: 다크 브라운, 골드, 딥 레드 색상 팔레트
- **고급스러운 폰트**: Cinzel (제목용), Cormorant Garamond (본문용)
- **반응형 디자인**: 데스크톱, 태블릿, 모바일 지원
- **한 화면 완성**: 모든 기능을 브라우저 한 화면에서 사용 가능

## 🚀 시작하기

### 필요 조건
- Node.js (v18 이상)
- npm 또는 yarn
- Angular CLI

### 설치 및 실행

1. **의존성 설치**
   ```bash
   npm install
   ```

2. **개발 서버 시작**
   ```bash
   ng serve
   ```

3. **브라우저에서 접속**
   ```
   http://localhost:4200
   ```

## 🏗️ 프로젝트 구조

```
src/
├── app/
│   ├── components/           # UI 컴포넌트들
│   │   ├── world-input/     # 세계관 입력 컴포넌트
│   │   ├── world-display/   # 세계관 표시 컴포넌트
│   │   ├── npc-profiles/    # NPC 프로필 컴포넌트
│   │   └── chat-interface/  # 채팅 인터페이스 컴포넌트
│   ├── models/              # TypeScript 인터페이스
│   ├── services/            # API 서비스
│   ├── app.ts              # 메인 앱 컴포넌트
│   └── app.config.ts       # 앱 설정
├── styles.scss             # 글로벌 스타일
└── main.ts                 # 앱 진입점
```

## 🔧 기술 스택

- **Frontend**: Angular 18, TypeScript, SCSS
- **UI Framework**: Angular Material (커스텀 테마)
- **스타일링**: SCSS with CSS Variables
- **HTTP Client**: Angular HttpClient
- **상태 관리**: RxJS BehaviorSubject

## 📱 사용법

### 1단계: 세계관 생성
1. 좌측 패널의 "Forge Your World" 섹션에서 게임 세계관 아이디어를 입력
2. 예시 아이디어를 클릭하거나 직접 작성
3. "Create Realm" 버튼 클릭

### 2단계: NPC 생성
1. 세계관이 생성되면 중앙 패널에서 "Summon Inhabitants" 버튼 클릭
2. 자동으로 3개의 NPC 프로필이 생성됨
3. "Generate Character Images" 버튼으로 캐릭터 이미지 생성

### 3단계: 대화하기
1. 중앙 패널에서 대화하고 싶은 NPC 선택
2. 우측 패널에 채팅 인터페이스가 나타남
3. 메시지를 입력하고 NPC와 대화 시작

## 🎯 주요 컴포넌트

### WorldInputComponent
- 사용자로부터 세계관 아이디어 입력받기
- 예시 아이디어 제공
- 로딩 상태 표시

### WorldDisplayComponent
- 확장된 세계관 정보 표시
- 원본 입력과 확장된 설명 비교
- 테마 및 설정 배지 표시

### NpcProfilesComponent
- NPC 프로필 카드 형태로 표시
- 이미지 생성 기능
- NPC 선택 기능

### ChatInterfaceComponent
- 실시간 채팅 인터페이스
- 타이핑 인디케이터
- 메시지 히스토리

## 🔌 백엔드 API 연동

현재는 데모 목적으로 Mock 데이터를 사용하지만, 실제 백엔드 API와 연동 가능합니다:

```typescript
// API 엔드포인트 예시
POST /api/world/expand          // 세계관 확장
POST /api/npcs/generate         // NPC 생성
POST /api/npcs/{id}/generate-image  // 이미지 생성
POST /api/chat/{npcId}          // 채팅 메시지 전송
GET  /api/chat/{npcId}/history  // 채팅 히스토리
```

## 🎨 커스터마이징

### 색상 테마 변경
`src/styles.scss`의 CSS 변수를 수정하여 색상 테마를 변경할 수 있습니다:

```scss
:root {
  --primary-color: #a8833d;    // 주요 색상
  --accent-color: #d4af37;     // 강조 색상
  --background-color: #1a1a1a; // 배경 색상
  // ... 기타 색상 변수들
}
```

### 폰트 변경
Google Fonts에서 다른 폰트를 import하여 사용할 수 있습니다.

## 📱 반응형 지원

- **데스크톱**: 3열 그리드 레이아웃
- **태블릿**: 2열 그리드 + 채팅 전체 너비
- **모바일**: 1열 스택 레이아웃

## 🚀 배포

### 프로덕션 빌드
```bash
ng build --prod
```

### 정적 호스팅
빌드된 `dist/` 폴더를 정적 호스팅 서비스에 배포:
- Netlify
- Vercel
- GitHub Pages
- Firebase Hosting

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 🙏 감사의 말

- Angular 팀의 훌륭한 프레임워크
- Google Fonts의 아름다운 폰트들
- 중세 판타지 게임들로부터의 디자인 영감

---

**Realm Forge**로 당신만의 환상적인 게임 세계를 만들어보세요! ⚔️✨
