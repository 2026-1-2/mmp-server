# NestJS → mediaMTX 마이그레이션 가이드

## 📋 변경사항 요약

### 백엔드 구조 변경
- **제거**: ffmpeg 프로세스 관리 (NestJS 내부)
- **추가**: mediaMTX 외부 서버로 변경
- **NestJS 역할**: mediaMTX API 호출 + URL 반환 + 보안/인증 관리

### API 응답 변경

#### GET /streams (채널 목록)

**변경 전:**
```json
[
  {
    "channelId": "cam1",
    "live": {
      "playlistUrl": "/streams/cam1/live/playlist.m3u8",
      "status": "live"
    },
    "vod": { "listUrl": "/streams/cam1/vod" }
  }
]
```

**변경 후:**
```json
[
  {
    "channelId": "cam1",
    "live": {
      "hlsUrl": "http://localhost:8888/cam1/index.m3u8",
      "webRtcUrl": "http://localhost:8889/cam1/whep"
    },
    "vod": { "listUrl": "/streams/cam1/vod" }
  }
]
```

#### POST /streams/rtsp (카메라 등록)

**변경 전:**
```json
{
  "channelId": "cam1",
  "playlistUrl": "/streams/cam1/live/playlist.m3u8"
}
```

**변경 후:**
```json
{
  "channelId": "cam1",
  "hlsUrl": "http://localhost:8888/cam1/index.m3u8",
  "webRtcUrl": "http://localhost:8889/cam1/whep"
}
```

---

## 🔄 프론트엔드 요청 흐름

### 정확한 흐름도

```
1️⃣ 프론트 → NestJS
┌─────────────────────────────────────────┐
│ fetch('http://localhost:8080/streams')  │
└─────────────────────────────────────────┘
                    ↓
2️⃣ NestJS 처리
┌─────────────────────────────────────────┐
│ - 사용자 인증 확인                       │
│ - 권한 체크 (어떤 카메라 볼 수 있나)     │
│ - mediaMTX에서 경로 목록 조회            │
│ - 허용된 URL만 응답                      │
└─────────────────────────────────────────┘
                    ↓
3️⃣ NestJS → 프론트
┌─────────────────────────────────────────┐
│ {                                        │
│   "hlsUrl": "http://localhost:8888/...", │
│   "webRtcUrl": "http://localhost:8889/..." │
│ }                                        │
└─────────────────────────────────────────┘
                    ↓
4️⃣ 프론트 → mediaMTX (직접 접속)
┌─────────────────────────────────────────┐
│ hls.loadSource(ch.live.hlsUrl)           │
│ ↓                                        │
│ http://localhost:8888/cam1/index.m3u8   │
│ (mediaMTX에서 직접 HLS 스트림 받음)    │
└─────────────────────────────────────────┘
                    ↓
5️⃣ 브라우저
┌─────────────────────────────────────────┐
│ video 태그에서 영상 재생                  │
└─────────────────────────────────────────┘
```

---

## ✅ 프론트엔드 개발자가 해야 할 일

### 1. 코드 수정 (3곳)

#### 1️⃣ HLS URL 필드명 변경

**변경 전:**
```javascript
hls.loadSource(ch.live.playlistUrl);
```

**변경 후:**
```javascript
hls.loadSource(ch.live.hlsUrl);
```

---

#### 2️⃣ status 필드 제거

**변경 전:**
```html
<h3>라이브 (HLS) — ${ch.live.status}</h3>
```

**변경 후:**
```html
<h3>라이브 (HLS)</h3>
```

---

#### 3️⃣ WebRTC 옵션 추가 (선택사항)

mediaMTX가 WebRTC도 지원합니다. HLS 대신 WebRTC를 쓰면 더 낮은 지연시간을 얻을 수 있습니다.

```javascript
// HLS (기존)
if (Hls.isSupported()) {
  const hls = new Hls();
  hls.loadSource(ch.live.hlsUrl);  // ← 여기만 변경
  hls.attachMedia(video);
}

// WebRTC (새로운 옵션)
// 별도 라이브러리 필요 (예: RTCClient)
// ch.live.webRtcUrl을 사용하면 됨
```

---

### 2. 로컬 테스트 환경 구성

#### mediaMTX 시작

```bash
# 프로젝트 루트에서
docker compose up -d

# 확인
docker ps  # mediamtx 컨테이너 보이는지 확인
```

#### NestJS 시작

```bash
npm run start:dev
```

---

### 3. 테스트 체크리스트

- [ ] `GET http://localhost:8080/streams` 호출 → JSON 응답 받음
- [ ] 응답에 `hlsUrl` 필드 있는지 확인
- [ ] `hlsUrl`을 hls.js의 `loadSource()`에 전달
- [ ] 브라우저에서 영상 재생됨
- [ ] VOD 목록도 정상 작동

---

## 🌍 프로덕션 배포 시

### 환경 변수 설정

```env
# .env 파일 (또는 환경 변수)
MEDIAMTX_URL=http://mediamtx.internal.example.com:9997
MEDIAMTX_HLS_PORT=8888
MEDIAMTX_WEBRTC_PORT=8889
```

### 네트워크 구조

```
인터넷 ──┐
         ↓
    ┌─────────────────────┐
    │ NestJS (8080 노출)  │  ← 프론트가 여기만 접속
    │ - 인증              │
    │ - 권한              │
    └────────────┬────────┘
                 │ (내부 네트워크)
                 ↓
    ┌─────────────────────┐
    │ mediaMTX (내부)     │  ← 외부 미노출
    │ - HLS 스트림 (8888) │
    │ - WebRTC (8889)     │
    │ - RTSP 입력 (8554)  │
    └─────────────────────┘
```

프론트 URL도 변경 필요:
```javascript
// 개발: localhost
hls.loadSource('http://localhost:8888/cam1/index.m3u8');

// 프로덕션: 실제 서버
hls.loadSource('http://streaming.example.com:8888/cam1/index.m3u8');
```

---

## ❓ FAQ

### Q. mediaMTX 포트들이 모두 노출되어야 하나?
**A.** 아니요, 포트별 역할:
- **8554 (RTSP)**: 카메라 ← → mediaMTX (내부)
- **8888 (HLS)**: 프론트 ← → mediaMTX (프론트 서버에서 접속 가능해야 함)
- **8889 (WebRTC)**: 프론트 ← → mediaMTX (프론트 서버에서 접속 가능해야 함)
- **9997 (API)**: NestJS ← → mediaMTX (내부만)

### Q. HLS URL이 절대 경로인데 CORS 문제가 생기지 않나?
**A.** mediaMTX는 기본적으로 CORS를 허용합니다. 필요하면 `mediamtx.yml`에서 설정 가능합니다.

### Q. 카메라 추가/삭제는 프론트에서?
**A.** 아니요, NestJS API를 통해서:
```bash
POST /streams/rtsp
{
  "channelId": "cam2",
  "rtspUrl": "rtsp://new-camera-ip/stream"
}
```

---

## 📝 변경 파일 목록

**백엔드 (이미 완료)**
- ✅ `src/streams/mediamtx.service.ts` (신규)
- ✅ `src/streams/streams.service.ts` (수정)
- ✅ `src/streams/streams.controller.ts` (수정)
- ✅ `.env.example` (신규)
- ✅ `mediamtx.yml` (신규)
- ✅ `docker-compose.yml` (신규)

**프론트엔드 (수정 필요)**
- 🔄 `public/index.html` (이미 샘플 수정됨)
- 🔄 프로젝트의 HLS 로드 로직
