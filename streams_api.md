## 6. 스트림 (Streams)

아이콘 범례: 👁 VIEWER 이상 / 🛠 OPERATOR 이상 / 👑 ADMIN 전용 / 🌐 인증 불필요

---

### 6.1 라이브 스트림 시작 👁

`POST /streams/live/{camera_id}/start`

```json
{
  "protocol": "WEBRTC"
}
```

`protocol`: `"WEBRTC"` (기본값) 또는 `"HLS"`

**응답 예시**:
```json
{
  "session_id": 1023,
  "protocol": "WEBRTC",
  "endpoint": "http://localhost:8889/cam1/whep",
  "auth_token": "eyJhbGci...",
  "expires_in": 60
}
```

**서버 동작**:
- `StreamSession` DB 레코드 생성
- 60초 유효 스트림 토큰(`auth_token`) 발급
- `endpoint` URL을 클라이언트가 MediaMTX에 직접 연결하는 데 사용

---

### 6.2 라이브 스트림 종료 👁

`POST /streams/live/{session_id}/stop`

Body 없음.

**응답 예시**:
```json
{
  "session_id": 1023,
  "camera_id": 1,
  "user_id": 5,
  "protocol": "WEBRTC",
  "started_at": "2026-05-26T09:00:00.000Z",
  "ended_at": "2026-05-26T09:03:42.000Z",
  "duration_sec": 222
}
```

**에러**:
- `400` — 이미 종료된 세션
- `403` — 본인 세션이 아님
- `404` — 세션 없음

---

### 6.3 스트림 세션 목록 👑

`GET /streams/sessions?camera_id=1&user_id=5&from=2026-05-01T00:00:00Z&to=2026-05-31T23:59:59Z`

| 파라미터 | 필수 | 설명 |
|---------|------|------|
| `camera_id` | ✗ | 카메라 ID 필터 |
| `user_id` | ✗ | 사용자 ID 필터 |
| `from` | ✗ | 시작 시각 (ISO 8601) |
| `to` | ✗ | 종료 시각 (ISO 8601) |

**응답**: `started_at` 내림차순 세션 배열

---

### 6.4 활성 스트림 목록 🛠

`GET /streams/active`

현재 시청 중인 세션(`ended_at`이 null) 목록 반환.

---

### 6.5 MediaMTX 토큰 검증 웹훅 🌐

`POST /streams/mediamtx-auth`

```json
{
  "query": "token=eyJhbGci..."
}
```

**서버 동작**: MediaMTX가 클라이언트 연결 시 자동 호출. 직접 사용 불필요.

- `200` — 토큰 유효
- `401` — 토큰 만료 또는 위조

---

## 7. VOD (녹화 영상)

파일 저장 구조: `{RECORDINGS_DIR}/{channelId}/YYYYMMDD_HHMMSS.mp4`

`channelId`는 video-recorder의 `cam_name`과 동일하게 맞춰야 함.

---

### 7.1 VOD 파일 목록 👁

`GET /streams/{channelId}/vod?page=1&size=10&date=2026-05-26`

| 파라미터 | 필수 | 기본값 | 설명 |
|---------|------|-------|------|
| `page` | ✗ | `1` | 페이지 번호 |
| `size` | ✗ | `10` | 페이지 크기 (최대 100) |
| `date` | ✗ | 전체 | 날짜 필터 (`YYYY-MM-DD`) |

**응답 예시**:
```json
{
  "total": 24,
  "page": 1,
  "size": 10,
  "totalPages": 3,
  "files": [
    {
      "filename": "20260526_180712.mp4",
      "url": "/streams/CAM-01/vod/20260526_180712.mp4"
    },
    {
      "filename": "20260526_170712.mp4",
      "url": "/streams/CAM-01/vod/20260526_170712.mp4"
    }
  ]
}
```

파일 목록은 **최신순** 정렬.

**에러**:
- `404` — 해당 `channelId` 디렉토리 없음

---

### 7.2 VOD 파일 스트리밍 👁

`GET /streams/{channelId}/vod/{filename}`

**Range 요청 지원** — 브라우저 `<video>` 태그 seek(탐색) 가능.

**요청 헤더 (seek 시)**:
```
Range: bytes=0-1048575
```

**응답 헤더**:
```
HTTP/1.1 206 Partial Content
Content-Type: video/mp4
Content-Range: bytes 0-1048575/212349000
Accept-Ranges: bytes
```

Range 헤더 없으면 `200` + 전체 파일 반환.

**에러**:
- `400` — 파일명 형식 오류 (`.mp4` 확장자, 영문·숫자·`_.-`만 허용)
- `404` — 파일 없음

**Postman 테스트**:
```
GET http://localhost:3000/streams/CAM-01/vod/20260526_180712.mp4
Authorization: Bearer {token}
```
