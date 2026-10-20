# 해설북 독립형 리더

**서버 없이 로컬 전용으로 작동하는 해설북 리더 앱**

기출 원문 위에 쓰고, 문항별 해설 영상으로 바로. `.hsbpkg.zip` 패키지를 가져오면 모든 기능이 오프라인에서 완전히 작동합니다.

## 주요 기능

- ✅ **로컬 라이브러리**: IndexedDB에 패키지 저장, 브라우저에서 완전히 작동
- ✅ **패키지 가져오기**: `.hsbpkg.zip` 형식 지원, 스키마 검증, 명확한 오류 메시지
- ✅ **리더 뷰**: 페이지 렌더링, 문항 영역 하이라이트
- ✅ **유튜브 영상 연동**: 문항별 구간 재생, cue 포인터 추적
- ✅ **필기 시스템**: 펜/형광펜/지우개, 영상 시각 기록, IndexedDB 저장
- ✅ **퀴즈 및 채점**: 로컬 채점, 오답노트, 필기 타임라인
- ✅ **PWA**: 오프라인 작동, 홈 화면 설치 가능

## 기술 스택

- **프론트엔드**: Vite + React 18 + TypeScript
- **상태/저장소**: IndexedDB (idb)
- **필기 렌더링**: perfect-freehand
- **수식**: KaTeX
- **패키지**: JSZip, Zod 스키마 검증
- **PWA**: vite-plugin-pwa, Workbox
- **테스트**: Vitest (단위), Playwright (E2E)

## 설치 및 실행

```bash
# 루트에서
npm install
npm run build:shared

# 독립형 리더 개발
cd apps/reader-standalone
npm run dev          # http://localhost:5173
npm run build        # dist/ 빌드
npm run preview      # 빌드 미리보기

# 테스트
npm run test         # Vitest 단위 테스트
npm run test:e2e     # Playwright E2E
npm run typecheck    # TypeScript 타입 검사
```

## 사용법

1. **패키지 가져오기**
   - 홈 화면에서 "📦 패키지 가져오기" 버튼 클릭
   - `.hsbpkg.zip` 파일 선택 (샘플: `/public/sample-electric-2026-1.0.0.hsbpkg.zip`)
   - 가져온 교재가 라이브러리에 표시됨

2. **교재 보기**
   - 교재 카드 클릭 → 리더 화면
   - 좌측: 영상 플레이어 + 문항 패널
   - 우측: 원문 페이지 + 필기 도구

3. **필기하기**
   - 도구: 보기, 펜, 형광펜, 지우개
   - 색상/굵기 선택
   - 손가락 필기 옵션 (펜 감지 시 자동 꺼짐)
   - Ctrl+Z / Ctrl+Shift+Z로 실행 취소/다시 실행

4. **문항 풀기**
   - 문항 번호 클릭 → 해설 영상 해당 구간 재생
   - 보기 선택 → 즉시 채점 + 해설 표시
   - 오답은 "오답노트" 탭에 자동 기록

5. **데이터 관리**
   - 모든 데이터는 IndexedDB에 저장 (영구 보존)
   - 교재 삭제: 라이브러리에서 "삭제" 버튼
   - 완전히 오프라인 작동

## 프로젝트 구조

```
apps/reader-standalone/
├── src/
│   ├── lib/
│   │   ├── db.ts            # IndexedDB 스키마 및 API
│   │   ├── importer.ts      # .hsbpkg.zip 파서 및 검증
│   │   ├── youtube.ts       # YouTube IFrame API 훅
│   │   ├── markdown.ts      # 해설 마크다운 렌더러 (KaTeX 포함)
│   │   └── uuid.ts          # ID 생성
│   ├── reader/
│   │   ├── PageView.tsx     # 페이지 + 필기 캔버스
│   │   ├── QuizPanel.tsx    # 문항/필기/오답 패널
│   │   └── ink.ts           # 필기 렌더링 (perfect-freehand)
│   ├── pages/
│   │   ├── Library.tsx      # 라이브러리 + 가져오기
│   │   └── Reader.tsx       # 리더 메인 뷰
│   ├── main.tsx             # 앱 진입점
│   └── styles.css           # 전역 스타일
├── e2e/
│   └── reader.spec.ts       # E2E 테스트 (가져오기→읽기→퀴즈)
├── public/
│   └── sample-*.hsbpkg.zip  # 샘플 패키지
├── vite.config.ts           # Vite + PWA 설정
├── playwright.config.ts     # Playwright 설정
└── vitest.config.ts         # Vitest 설정
```

## 패키지 형식 (`.hsbpkg.zip`)

```
item.json                # 메타데이터 (ipitem/1 스키마)
book.json                # 교재 정보
pages.json               # 페이지 목록 (파일 경로 포함)
regions.json             # 문항 영역 bbox
quizzes.json             # 문항 및 정답
solutions.json           # 해설 (선택)
video_map.json           # 영상 매핑 (선택)
pages/xs/*.webp          # 작은 이미지
pages/sm/*.webp          # 중간 이미지
pages/hi/*.webp          # 고해상도 이미지
```

스키마 검증은 `@hsb/shared`의 Zod 스키마를 재사용합니다.

## 테스트

### 단위 테스트 (Vitest)
- `src/lib/importer.test.ts`: 패키지 파싱, 오류 처리
- `src/lib/functions.test.ts`: 채점, 필기 병합, 영상 큐 보간

### E2E 테스트 (Playwright)
- `e2e/reader.spec.ts`:
  - 패키지 가져오기 → 라이브러리 확인
  - 교재 열기 → 페이지 렌더링
  - 문항 풀기 → 채점 → 해설 표시
  - 페이지 새로고침 → 데이터 유지 확인

실행:
```bash
npm run test         # 단위 테스트
npm run test:e2e     # E2E (자동으로 dev 서버 시작)
```

## CI/CD

`.github/workflows/reader-standalone.yml`:
- **트리거**: `apps/reader-standalone/**` 또는 `packages/shared/**` 변경
- **단계**:
  1. `@hsb/shared` 빌드
  2. TypeScript 타입 검사
  3. Vitest 단위 테스트
  4. Playwright E2E 테스트
  5. 프로덕션 빌드
  6. 아티팩트 업로드 (dist, Playwright 리포트)

## 제외된 기능

독립형 리더는 **학습자 전용**입니다. 다음 기능은 포함되지 않습니다:

- ❌ 스튜디오 (영상 제작)
- ❌ 관리자 기능
- ❌ 서버 동기화 (필기/채점은 로컬 전용)
- ❌ 로그인/인증
- ❌ Cafe24/그누보드 연동

## 원본 프로젝트와의 차이

| 기능 | 원본 (`apps/web`) | 독립형 (`apps/reader-standalone`) |
|------|-------------------|-----------------------------------|
| 인증 | OAuth + 서버 세션 | 없음 |
| 패키지 소스 | 서버 API | 로컬 파일 가져오기 |
| 필기 동기화 | 서버 + 충돌 병합 | 로컬 전용 |
| 채점 | 서버 기록 | 로컬 전용 |
| 이미지 URL | 서명된 S3 URL | Blob URL (IndexedDB) |
| 워터마크 | 이메일 표시 | 없음 |

## 라이선스 및 콘텐츠

- 이 앱은 [원본 저장소](https://github.com/leedonwoo2827-ship-it/haeseolbook)의 포크에서 추출되었습니다.
- 원본 저장소에는 최상위 LICENSE 파일이 없습니다. 라이선스 상태는 원저자와 확인해야 합니다.
- 샘플 패키지 (`sample-electric-2026-*.hsbpkg.zip`)는 예시 목적으로 생성된 합성 데이터입니다. 실제 기출 문제가 아닙니다.

## 기여

이 앱은 원본 프로젝트에 독립형 리더 옵션을 제안하기 위해 만들어졌습니다. 변경 사항:
- 최소한의 의존성 (서버 코드 제외)
- 명확한 모듈 경계 (`@hsb/shared` 스키마 재사용)
- 강력한 타입 및 테스트 커버리지

PR을 upstream에 제안할 때는 다음을 포함:
- 이 README
- CI 통과 증명
- 라이선스 명확화 필요성에 대한 메모
