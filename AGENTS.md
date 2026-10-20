# AGENTS.md — 해설북 독립형 리더 개발 노트

**작업 일자**: 2026-10-20  
**목표**: 원본 `haeseolbook` 저장소에서 학습자 전용 기능을 독립형 서버리스 앱으로 추출

---

## 작업 범위

### 포함됨 ✅
- 로컬 라이브러리 (IndexedDB)
- `.hsbpkg.zip` 패키지 가져오기 (Zod 스키마 검증, 명확한 오류 메시지)
- 리더 뷰 (페이지 렌더링 + 문항 영역 하이라이트)
- 유튜브 영상 연동 (문항별 구간 재생, `video_map.json` cue 포인터)
- 필기 시스템 (펜/형광펜/지우개, 영상 시각 기록, IndexedDB 저장)
- 퀴즈 + 채점 (로컬 채점, 오답노트)
- PWA (오프라인 작동)

### 제외됨 ❌
- 스튜디오 (영상 제작)
- 관리자/Cafe24 연동
- 서버 동기화 (필기/채점은 로컬 전용)
- 로그인/인증

### 콘텐츠
- 샘플 패키지는 합성 데이터 (예시 데이터)로 생성
- 실제 기출 문제를 포함하지 않음

---

## 구현 결정

### 아키텍처
- **Vite + React + TypeScript**: 빠른 개발, 강력한 타입
- **IndexedDB (idb)**: 패키지, 매니페스트, 필기, 채점 데이터 저장
- **스키마 재사용**: `packages/shared`의 Zod 스키마를 그대로 사용하여 일관성 유지
- **PWA**: `vite-plugin-pwa` + Workbox로 오프라인 지원

### 주요 모듈

#### `src/lib/db.ts`
- IndexedDB 스키마 정의:
  - `packages`: 가져온 패키지 메타 + Blob
  - `manifests`: 파싱된 `BookManifest`
  - `ink`: 페이지별 필기 (스트로크)
  - `attempts`: 문항별 채점 기록
  - `pageImages`: 페이지 이미지 Blob (xs/sm/hi)

#### `src/lib/importer.ts`
- JSZip으로 `.hsbpkg.zip` 파싱
- Zod로 `item.json`, `book.json`, `pages.json`, `regions.json`, `quizzes.json`, `solutions.json`, `video_map.json` 검증
- 검증 실패 시 명확한 오류 메시지 (필드 경로 포함)
- 이미지를 IndexedDB에 Blob으로 저장

#### `src/pages/Reader.tsx`
- 리더 메인 로직:
  - `InkManager` 클래스로 필기 상태 관리 (캐시 + IndexedDB)
  - YouTube 플레이어 (useYouTube 훅)
  - 문항 선택 → 영상 구간 재생
  - 영상 재생 중 cue 포인터 실시간 추적
  - 필기 저장 (실행 취소/다시 실행 스택)
  - 채점 (로컬 전용, `putAttempt`)

#### `src/reader/PageView.tsx`
- 페이지 렌더링:
  - 이미지 lazy loading (IntersectionObserver)
  - 문항 영역 SVG 오버레이
  - 필기 캔버스 (perfect-freehand로 렌더링)
  - 포인터 이벤트로 그리기/지우기
  - 손가락 드래그 → 스크롤 (fingerDraw 옵션)

#### `src/reader/QuizPanel.tsx`
- 문항/필기/오답 탭
- 문항 번호 그리드 (채점 결과 표시)
- 보기 선택 → 채점 → 해설 표시 (KaTeX 수식 렌더링)
- 필기 타임라인 (영상 시각 기록된 스트로크)

### 샘플 패키지 생성
- `tools/create_sample_package.py` (Python 인라인 스크립트)
- 합성 데이터: 3문항, 1페이지
- 영상 ID는 YouTube 공식 데모 (`M7lc1UVf-VE`)
- 페이지 이미지는 최소 WebP Blob (실제 렌더링은 브라우저에서 확인 필요)

---

## 테스트 전략

### 단위 테스트 (Vitest)
- `src/lib/importer.test.ts`:
  - 잘못된 zip 파일 거부
  - `item.json` 없는 패키지 거부
  - 스키마 검증 실패 메시지 확인
- `src/lib/functions.test.ts`:
  - `inkChecksum` 일관성
  - `mergeInk` 충돌 병합 (deletedIds)
  - `segmentAt` 영상 구간 탐색
  - `cueAt` 보간 로직

### E2E 테스트 (Playwright)
- `e2e/reader.spec.ts`:
  - 패키지 가져오기 → 라이브러리 표시
  - 교재 열기 → 페이지 렌더링
  - 문항 풀기 → 채점 → 해설 표시
  - 페이지 새로고침 → 데이터 유지

### CI (GitHub Actions)
- `.github/workflows/reader-standalone.yml`:
  - `apps/reader-standalone/**` 또는 `packages/shared/**` 변경 시 실행
  - 단계: shared 빌드 → typecheck → 단위 테스트 → E2E → 프로덕션 빌드
  - 아티팩트: dist, Playwright 리포트

---

## 제약 사항 및 개선 여지

### 알려진 제약
1. **샘플 이미지가 최소 Blob**: 실제 시각적 콘텐츠 없음. 프로덕션에서는 실제 PDF → WebP 파이프라인 필요.
2. **영상 ID 하드코딩**: 샘플은 YouTube 데모 영상 사용. 실제 해설 영상은 별도 제작 필요.
3. **로컬 전용 채점**: 서버 동기화 없어 기기 간 진행도 공유 불가.
4. **원본 워터마크 제거**: 독립형은 인증이 없으므로 워터마크 없음.

### 개선 가능 영역
1. **오프라인 퍼스트 동기화**: 향후 옵션으로 서버 동기화 추가 가능 (CouchDB/PouchDB 스타일).
2. **더 나은 샘플 콘텐츠**: 실제 렌더링된 페이지 이미지.
3. **접근성**: ARIA 레이블 추가, 키보드 내비게이션 개선.
4. **성능**: 대량 패키지 (100+ 페이지) 테스트, lazy hydration.

---

## 원본 프로젝트와의 통합 경로

이 독립형 앱은 원본 저장소에 다음과 같이 통합될 수 있습니다:

1. **병렬 배포**: `apps/reader-standalone`를 별도 빌드로 유지, GitHub Pages 또는 Netlify에 배포.
2. **기능 토글**: 원본 `apps/web`에 "오프라인 모드" 토글 추가, 서버 API 호출 비활성화.
3. **하이브리드**: 인증된 사용자는 서버 동기화 사용, 비인증 사용자는 로컬 전용.

---

## PR 체크리스트

- [x] `apps/reader-standalone/` 디렉토리 생성, Vite + React + TypeScript 설정
- [x] IndexedDB 스키마 및 패키지 가져오기 구현
- [x] 리더 뷰 (페이지, 필기, 영상, 퀴즈) 구현
- [x] 샘플 패키지 생성
- [x] 단위 테스트 (Vitest) 및 E2E 테스트 (Playwright)
- [x] GitHub Actions CI 워크플로
- [x] README.md (한글, 사용법 포함)
- [x] AGENTS.md (이 문서)
- [x] 루트 `package.json` workspaces 업데이트
- [ ] 실제 브라우저에서 앱 테스트 (dev 서버 실행)
- [ ] 스크린샷/화면 녹화 아티팩트 생성
- [ ] 빌드 dist 압축 (`.tar.gz`)

---

## 라이선스 관련 메모

원본 저장소 (`leedonwoo2827-ship-it/haeseolbook`)에는 최상위 LICENSE 파일이 없습니다.  
`LICENSE-THIRD-PARTY.md`만 존재하며, 이는 third-party 라이브러리를 나열합니다.

**PR 본문에 명시 필요**:
- 이 fork는 독립형 리더를 제안하는 실험적 구현
- 라이선스 명확화 필요 (원저자에게 확인 요청)
- 샘플 콘텐츠는 합성 데이터이며 실제 기출 문제가 아님
