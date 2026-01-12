# 2026-01-12 변경사항 상세 (comMapper)

본 문서는 2026-01-12 요구사항(및 추가요구사항) 반영으로 생성/수정된 파일들의 변경 내용을 **라인 단위(라인 범위)**로 설명합니다.

## 생성/수정된 파일 목록

- 신규 화면: `comMapper.html`
- 신규 스크립트: `js/comMapper.js`
- (추가요구사항 반영) `comMapper.html`, `js/comMapper.js`에 체크박스 옵션 로직 추가

---

## 1) comMapper.html 라인별 설명

> 목적: variable-mapper.html과 유사한 3단 레이아웃(좌:입력, 중:매핑+버튼, 우:출력) + DW/DM 변환 버튼 + “@변수만 변환” 체크박스 제공

### 문서/헤더

- 1~6: HTML 문서 선언/언어/문자셋/타이틀
- 7~8: 화면 제목 표시

### 3단 레이아웃 컨테이너

- 10: 3단 레이아웃을 위한 flex 컨테이너

#### 좌측: 변환 전 SQL 입력

- 11~15: 좌측 박스(입력 SQL)
  - 14: 입력 textarea. `id="inputSql"`로 JS에서 읽습니다.

#### 중앙: 매핑 + 버튼 + 옵션

- 17~38: 중앙 박스(매핑/버튼 영역)
  - 20~23: 프로그램 타입 버튼 2개
    - 21: `id="convertDwBtn"` (DW 변환)
    - 22: `id="convertDmBtn"` (DM 변환)
  - 25~30: **추가요구사항** 체크박스
    - 27: `id="onlyAtVars"`
      - 체크됨: `@`로 시작하는 토큰만 치환
      - 체크 해제: `@` 외 변수(예: `` `edw_전월` ``, `vs_job_d`)도 함께 치환
  - 32~35: 매핑 헤더(변경전/변경후)
  - 37: 매핑 행 컨테이너 `id="mappingRows"` (JS가 동적으로 행을 생성)

#### 우측: 변환 후 SQL 출력

- 40~45: 우측 박스(출력 SQL)
  - 43~44: 출력 textarea. `id="outputSql"`, `readonly`

### 스크립트 로드

- 48: `js/comMapper.js` 로드

---

## 2) js/comMapper.js 라인별 설명

> 목적: DW/DM 변환 규칙에 따라 매핑을 자동 생성/표시하고, 해당 매핑으로 SQL을 치환한 뒤 결과를 자동 복사합니다.
> 
> 요구사항 8(TS 오류 회피): `??`, `?.` 같은 문법을 사용하지 않고, `if`/삼항 등으로 안전하게 작성했습니다.

### 로깅/전역 에러 핸들링

- 1: 파일 로드 시작 로그
- 2~4: `window.onerror`에서 런타임 에러를 콘솔에 기록

### 공통 유틸

- 6~7: IIFE로 전역 오염 방지, `byId` 헬퍼
- 9~11: `normalizeToken` (null/undefined 안전 처리 후 trim)
- 13~15: `escapeRegExp` (치환용 정규식 이스케이프)

### DM 규칙용 헤더 파싱

- 17~29: `extractHeaderValue(sql, headerName)`
  - 17: 함수 시작
  - 23: `/* PGM ID : ... */`, `/* TBL_ID : ... */` 형태를 정규식으로 추출
  - 25~28: 매치 실패/그룹 값 없을 때 빈 문자열 반환

### DW 규칙용 프로그램ID 파싱 + 서비스명 파싱

- 30~43: `extractDwProgramIdFromLogDeclare(sql)`
  - 30: 함수 시작
  - 31~35: 우선순위 1) `-- DECLARE log_프로그램ID ... '리터럴';` 주석 라인에서 추출
  - 37~40: 우선순위 2) (있을 경우) 비주석 리터럴 DECLARE에서 추출
  - 42: 둘 다 없으면 빈 문자열

- 45~57: `extractServiceNameFromProgramId(programId)`
  - 45: 함수 시작
  - 51~54: `_` 기준으로 뒤쪽을 후보로 삼고, 끝의 숫자(00,01 등)를 제거하여 “서비스명”을 얻습니다.

- 59~63: `stripSqlSuffix` (DM의 `wzaw_공통코드00.sql` → `wzaw_공통코드00`)

### DW: 늘어나는 변수(백틱 식별자) 수집

- 65~76: `collectBacktickedIdentifiers(sql)`
  - SQL에서 `` `...` `` 토큰을 모두 수집해 배열로 반환

- 78~82: `collectWordTokens` (단어 경계로 특정 식별자 존재 여부 확인)

- 84~85: `quoteSqlString` (SQL 단일 따옴표 리터럴 생성; 내부 `'`는 `''`로 이스케이프)

### DW 변환 매핑 생성

- 86~112: `buildDwMappings(sql)`
  - 86~88: 프로그램ID/서비스명 파싱
  - 92~100: 핵심 @변수 매핑 생성
    - `@program_id` → `'프로그램ID'` (주석 리터럴 기반)
    - `@standard_date` → `'99991231'`
    - `@job_seq` → `''`
    - `@target_table` → `'DW.서비스명'`
    - `@temp_table` → `'DWWRK.서비스명'`
  - 102~109: 늘어나는 변수 대응
    - `` `edw_` ``로 시작하는 백틱 토큰은 모두 → `'999912'`
  - 111: `normalizeAndDedupeMappings`로 정리 후 반환

### DM 변환 매핑 생성

- 114~140: `buildDmMappings(sql)`
  - 118~120: 주석에서 `PGM ID`, `TBL_ID` 추출
  - 122: `PGM ID`의 `.sql` 제거
  - 124~127: 핵심 @변수 매핑 생성
    - `@program_id` → `'wzaw_공통코드00'`
    - `@standard_date` → `'99991231'`
    - `@table_name` → `'BM.공통코드'`
  - 129~138: 늘어나는 변수 대응
    - `vs_job_d`, `vs_job_yyyymm`(백틱 유무 모두) → `'999912'`
  - 139: `normalizeAndDedupeMappings`로 정리 후 반환

### 매핑 정규화/중복 제거

- 142~167: `normalizeAndDedupeMappings(mappings)`
  - 142~149: `Map`으로 중복 키(from) 제거/최종값 유지
  - 152~160: 핵심 키는 보기 좋게 고정 순서로 앞에 배치
  - 162~166: 나머지는 이어 붙여 반환

### UI 매핑 렌더/읽기

- 169~197: `renderMappings(mappings)`
  - 173: 기존 행 초기화
  - 175~196: `{from,to}`마다 input 2개를 만들어 `mappingRows`에 추가

- 199~212: `readMappingsFromUi()`
  - 화면의 before/after input 값을 다시 읽어 `{from,to}` 배열 생성

### SQL 치환

- 214~232: `applyMappings(text, mappings)`
  - 218~220: 긴 토큰 우선 치환(부분 치환 오작동 방지)
  - 223~229: `from`을 정규식으로 만들어 전역 치환

### (추가요구사항) “@변수만 변환” 옵션

- 234~242: `filterMappingsByOption(mappings)`
  - 235~237: 체크박스 `onlyAtVars` 상태 확인
  - 239~241: 체크 시 `from`이 `@`로 시작하는 매핑만 남김

### 자동 복사

- 244~255: `copyToClipboard(text)`
  - 클립보드 API 우선 사용, 실패 시 폴백
- 257~270: `fallbackCopy(text)`
  - 숨김 textarea + `document.execCommand('copy')`로 복사

### 변환 실행(핵심 흐름)

- 272~307: `convert(mode)`
  - 279~280: 모드에 따라 DW/DM 매핑 생성
  - 281: 매핑을 UI에 렌더
  - 284~286: UI에서 매핑을 다시 읽고, 체크박스 옵션(`filterMappingsByOption`) 적용
  - 287: `applyMappings`로 실제 SQL 치환
  - 289~305: 결과 textarea 출력 + 자동 복사(실패 시 선택 상태로 사용자 수동복사 지원)

### 이벤트 바인딩

- 309~324: `attachHandlers()`
  - 311~318: 버튼 탐색 실패 시 100ms 후 재시도
  - 320~321: DW/DM 버튼 클릭 시 각각 `convert('DW')`, `convert('DM')` 호출

- 326~332: DOMContentLoaded 상태에 따라 핸들러 연결
- 334: 파일 로드 끝 로그
