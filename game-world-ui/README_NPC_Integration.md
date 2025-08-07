# NPC 대화 시스템 통합 가이드

## 개요

Game World UI에 OpenAI o3 기반 NPC 대화 시스템이 통합되었습니다. 이제 플레이어는 생성된 NPC들과 실시간으로 대화하고 퀘스트를 받을 수 있습니다.

## 🚀 시작하기

### 1. NPC 서버 실행

먼저 NPC 대화 서버를 실행해야 합니다:

```bash
cd server/openai_venv/game_world
python npc_server.py
```

서버가 `http://localhost:8000`에서 실행됩니다.

### 2. 게임 UI 실행

```bash
cd game-world-ui
npm start
```

## 🎮 기능 소개

### 1. 실시간 NPC 대화
- **자연어 처리**: OpenAI o3 모델을 사용한 고품질 대화
- **감정 표현**: NPC의 감정 상태가 실시간으로 표시됨
- **컨텍스트 유지**: 대화 히스토리를 기억하여 일관된 대화 제공

### 2. 퀘스트 시스템
- **지능형 퀘스트 생성**: NPC의 직업과 성격에 맞는 퀘스트 자동 생성
- **인터랙티브 수락/거절**: 퀘스트 제안을 즉시 수락하거나 거절 가능
- **퀘스트 정보**: 목표, 보상 등 상세 정보 제공

### 3. 세션 관리
- **대화 기록**: 각 NPC와의 대화 히스토리 저장
- **세션 초기화**: 필요시 대화 기록 삭제 가능
- **다중 NPC 세션**: 여러 NPC와 동시에 대화 가능

## 🎯 사용 방법

### NPC와 대화하기

1. **세계관 생성**: 먼저 세계관과 NPC를 생성합니다
2. **NPC 선택**: 상호작용 섹션에서 대화할 NPC를 선택합니다
3. **대화 시작**: 메시지 입력창에 텍스트를 입력하고 전송합니다
4. **응답 확인**: NPC의 답변과 감정 상태를 확인합니다

### 퀘스트 받기

퀘스트를 받으려면 다음과 같은 표현을 사용하세요:
- "퀘스트가 있나요?"
- "할 일이 있나요?"
- "도움이 필요한 일이 있나요?"
- "일거리를 주세요"

### 서버 연결 상태 확인

- **초록색 점**: 서버에 정상 연결됨
- **빨간색 점**: 서버 연결 안됨

## 🔧 기술 세부사항

### 아키텍처

```
Game World UI (Angular)
    ↓ HTTP
NPC Dialogue Service
    ↓ HTTP API
FastAPI Server (localhost:8000)
    ↓ 
OpenAI o3 API
```

### 주요 파일

- `src/app/services/npc-dialogue.service.ts`: NPC 대화 서비스
- `src/app/components/chat-interface/`: 채팅 인터페이스 컴포넌트
- `server/openai_venv/game_world/npc_server.py`: FastAPI 서버

### API 엔드포인트

- `POST /chat`: NPC와 채팅
- `GET /session/{npc_id}`: 세션 히스토리 조회
- `DELETE /session/{npc_id}`: 세션 삭제
- `GET /health`: 서버 상태 확인

## 🛠️ 커스터마이징

### 사용자 프로필 수정

`npc-dialogue.service.ts`의 `createUserProfile()` 메서드에서 기본 사용자 정보를 수정할 수 있습니다:

```typescript
private createUserProfile(): UserProfile {
  return {
    name: '모험가',
    level: 15,
    class: '전사',
    active_quests: [],
    reputation: '좋음'
  };
}
```

### 감정 이모지 추가

`chat-interface.ts`의 `getEmotionEmoji()` 메서드에서 감정 이모지를 추가할 수 있습니다:

```typescript
getEmotionEmoji(emotion?: string): string {
  const emotionMap: {[key: string]: string} = {
    '기쁨': '😊',
    '슬픔': '😢',
    // 새로운 감정 추가
    '신나는': '🤩',
    '피곤한': '😴'
  };
  return emotionMap[emotion || '중립'] || '😐';
}
```

## 🔍 문제 해결

### 서버 연결 문제

1. **NPC 서버 실행 확인**:
   ```bash
   curl http://localhost:8000/health
   ```

2. **CORS 문제**: 서버에서 이미 CORS가 설정되어 있지만, 문제가 있다면 `npc_server.py`의 CORS 설정을 확인하세요.

3. **OpenAI API 키**: `OPENAI_API_KEY` 환경변수가 설정되어 있는지 확인하세요.

### 대화 품질 개선

1. **프롬프트 튜닝**: `npc_server.py`의 `_prompt()` 메서드에서 프롬프트를 수정할 수 있습니다.

2. **모델 변경**: o3-mini 대신 다른 모델을 사용하려면 서버 실행 시 모델명을 변경하세요.

## 📝 개발 노트

### 향후 개선 사항

- [ ] 퀘스트 진행 상황 추적
- [ ] NPC 호감도 시스템
- [ ] 음성 대화 지원
- [ ] 그룹 대화 기능
- [ ] 대화 로그 내보내기

### 알려진 제한사항

- o3 모델의 응답 시간이 다소 길 수 있습니다
- 한 번에 너무 많은 요청을 보내면 rate limit에 걸릴 수 있습니다
- 서버 재시작 시 세션 데이터가 초기화됩니다

## 📞 지원

문제가 발생하거나 개선 제안이 있으시면 이슈를 생성해 주세요. 