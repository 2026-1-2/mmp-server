# 🚀 프론트엔드 개발자: 5분 요약

## 한줄 요약
> **NestJS에서 URL을 받아서 → 그 URL로 mediaMTX에 직접 접속해서 → 영상 재생**

---

## 변경 전 vs 변경 후

### 변경 전 (ffmpeg)
```
프론트 → NestJS (영상 변환) → 프론트
   playlist.m3u8: /streams/cam1/live/playlist.m3u8
```

### 변경 후 (mediaMTX)
```
프론트 → NestJS (URL만) → 프론트 → mediaMTX (영상)
   hlsUrl: http://localhost:8888/cam1/index.m3u8
```

---

## 3줄 코드 변경

```javascript
// 변경 전
hls.loadSource(ch.live.playlistUrl);

// 변경 후
hls.loadSource(ch.live.hlsUrl);     // ← 이것만!
```

---

## 필드 매핑표

| 용도 | 변경 전 필드 | 변경 후 필드 |
|------|-------------|-----------|
| HLS 재생 | `ch.live.playlistUrl` | `ch.live.hlsUrl` |
| 상태 표시 | `ch.live.status` | ❌ 제거됨 |
| WebRTC (신규) | ❌ 없음 | `ch.live.webRtcUrl` |

---

## API 응답 예시

```javascript
// GET http://localhost:8080/streams

[
  {
    "channelId": "cam1",
    "live": {
      "hlsUrl": "http://localhost:8888/cam1/index.m3u8",  // ← 이걸로 영상 로드
      "webRtcUrl": "http://localhost:8889/cam1/whep"      // ← 또는 이거 (낮은 지연)
    },
    "vod": { "listUrl": "/streams/cam1/vod" }  // ← VOD는 변경 없음
  }
]
```

---

## 테스트하기

### 1단계: mediaMTX 실행
```bash
docker compose up -d
```

### 2단계: NestJS 실행
```bash
npm run start:dev
```

### 3단계: API 확인
```bash
curl http://localhost:8080/streams
```

### 4단계: URL 확인
위 응답에서 `hlsUrl` 값이 보이면 OK

### 5단계: 코드 수정 후 테스트
```javascript
const res = await fetch('http://localhost:8080/streams');
const [ch] = await res.json();
hls.loadSource(ch.live.hlsUrl);  // 이 줄로 영상 재생
```

---

## 주의사항

⚠️ **URL이 절대 경로입니다**
- 변경 전: `/streams/cam1/live/playlist.m3u8` (상대 경로)
- 변경 후: `http://localhost:8888/cam1/index.m3u8` (절대 경로)
- 프로덕션에선 `localhost` 대신 실제 mediaMTX 서버 IP/도메인 사용

---

## 프로덕션 배포

`.env` 파일에 mediaMTX 서버 주소 설정:
```env
MEDIAMTX_URL=http://192.168.1.50:9997
```

그럼 응답 URL도 자동으로 변경됨:
```json
{
  "hlsUrl": "http://192.168.1.50:8888/cam1/index.m3u8"
}
```

---

## 더 궁금하면?
→ `MIGRATION_GUIDE.md` 참고
