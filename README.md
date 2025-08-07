# 🎮 Game World Generator - AI-Powered Interactive Game World Platform

## 📋 프로젝트 개요

Game World Generator는 AI 기술을 활용하여 인터랙티브한 게임 세계를 생성하고 관리하는 종합 플랫폼입니다. 사용자가 입력한 테마를 바탕으로 풍부한 세계관, NPC, 퀘스트를 생성하며, 실시간 대화와 음성/비디오 생성 기능을 제공합니다.

## ✨ 주요 기능

### 🌍 **세계관 생성**
- AI 기반 게임 세계 자동 생성
- 테마별 맞춤형 설정 (판타지, SF, 현대 등)
- 풍부한 배경 스토리와 설정

### 👥 **NPC 시스템**
- 개성 있는 NPC 자동 생성
- 직업별 특성화된 캐릭터
- 실시간 AI 대화 시스템
- 음성 클로닝 및 비디오 생성

### 🎯 **퀘스트 시스템**
- 직업별 맞춤형 퀘스트 생성
- 동적 난이도 조절
- 보상 시스템

### 🎨 **멀티미디어 생성**
- NPC 이미지 생성 (DALL-E)
- 무기/장비 이미지 생성
- 3D 모델 생성 (Stable Fast 3D)
- 음성 합성 및 클로닝
- 대화 비디오 생성 (SadTalker)

## 🏗️ 기술 스택

### **Frontend**
- **Angular 17** - 모던 웹 프레임워크
- **TypeScript** - 타입 안전성
- **SCSS** - 스타일링
- **RxJS** - 반응형 프로그래밍

### **Backend**
- **Python 3.9+** - 서버 로직
- **FastAPI** - RESTful API
- **OpenAI API** - GPT, DALL-E 통합
- **Pydantic** - 데이터 검증

### **AI/ML**
- **OpenAI GPT-4o** - 대화 및 콘텐츠 생성
- **OpenAI DALL-E** - 이미지 생성
- **Sentence Transformers** - 텍스트 임베딩
- **FAISS** - 벡터 검색
- **Stable Fast 3D** - 3D 모델 생성
- **SadTalker** - 비디오 생성

### **데이터베이스 & 저장소**
- **Local Storage** - 클라이언트 데이터
- **File System** - 이미지/비디오 저장
- **JSON** - 구조화된 데이터

## 📁 프로젝트 구조

```
Game_World/
├── game-world-ui/          # Angular 프론트엔드
│   ├── src/app/
│   │   ├── components/     # UI 컴포넌트들
│   │   ├── services/       # 비즈니스 로직
│   │   └── models/         # 데이터 모델
│   └── src/assets/         # 정적 리소스
├── server/                 # Python 백엔드
│   ├── openai_venv/       # 메인 AI 서버
│   ├── voice_venv/        # 음성 처리
│   ├── talk_venv/         # 대화 처리
│   ├── 3d_venv/          # 3D 모델링
│   └── npc_venv/         # NPC AI
└── world-generator/       # 월드 생성기
```

## 🚀 설치 및 실행

### **전제 조건**
- Node.js 18+
- Python 3.9+
- OpenAI API 키

### **1. 저장소 클론**
```bash
git clone https://github.com/your-username/game-world-generator.git
cd game-world-generator
```

### **2. 프론트엔드 설정**
```bash
cd game-world-ui
npm install
ng serve
```

### **3. 백엔드 서버 실행**
```bash
cd server/openai_venv/game_world
pip install -r requirements_unified.txt
python unified_game_world_server.py
```

### **4. 환경 변수 설정**
```bash
# OpenAI API 키 설정
export OPENAI_API_KEY="your-api-key-here"
```

## 🎯 핵심 기능 상세

### **1. AI 기반 세계관 생성**
```python
# 세계관 생성 요청 예시
{
  "theme": "판타지",
  "setting": "마법과 검의 세계",
  "conflict": "고대 마법의 부활",
  "unique_elements": "플로팅 아일랜드"
}
```

### **2. NPC 대화 시스템**
- **RAG (Retrieval-Augmented Generation)** 기반 컨텍스트 검색
- **의도 분류** 시스템으로 퀘스트 요청 감지
- **개성 유지** 알고리즘으로 일관된 캐릭터성

### **3. 멀티미디어 생성 파이프라인**
```
텍스트 입력 → AI 분석 → 이미지 생성 → 음성 합성 → 비디오 생성
```

## 🔧 개발 가이드

### **새로운 NPC 추가**
1. `server/openai_venv/game_world/npc_llm_enhanced.py` 수정
2. 직업별 퀘스트 템플릿 추가
3. 프론트엔드 NPC 카드 컴포넌트 업데이트

### **새로운 AI 기능 추가**
1. 새로운 가상환경 생성
2. FastAPI 엔드포인트 추가
3. 프론트엔드 서비스 연동

## 📊 성능 최적화

### **캐싱 전략**
- 벡터 임베딩 캐싱 (FAISS)
- 이미지 파일 캐싱
- 대화 히스토리 세션 관리

### **비동기 처리**
- 백그라운드 AI 생성 작업
- 스트리밍 응답 처리
- 에러 핸들링 및 재시도

## 🧪 테스트

### **단위 테스트**
```bash
# 프론트엔드 테스트
cd game-world-ui
ng test

# 백엔드 테스트
cd server/openai_venv/game_world
python -m pytest
```

### **통합 테스트**
```bash
# 전체 시스템 테스트
python test_integration.py
```

## 📈 모니터링

### **서버 상태 확인**
```bash
curl http://localhost:5003/api/game-world/health
```

### **성능 메트릭**
- 요청 처리 시간
- AI 모델 응답 시간
- 에러율 및 성공률

## 🤝 기여 가이드

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 👨‍💻 개발자

**Deryu** - AI 기반 게임 개발자

## 🔗 관련 링크

- [데모 사이트](https://your-demo-site.com)
- [API 문서](https://your-api-docs.com)
- [이슈 트래커](https://github.com/your-username/game-world-generator/issues)

---

⭐ 이 프로젝트가 도움이 되었다면 스타를 눌러주세요! 