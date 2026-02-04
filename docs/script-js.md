# `js/script.js` 상세 설명

이 문서는 CS-Convert 프로젝트의 [`js/script.js`](../js/script.js) 파일이 수행하는 역할과 내부 동작(함수별 책임, 이벤트 흐름, 정규식 치환 규칙, 옵션에 따른 분기, 예외/제한사항)을 정리합니다.

> 참고: 소스 상단/로그 메시지에 `scrip.js` 라고 표기되어 있지만 실제 파일명은 `script.js` 입니다.

---

## 1) 목적(What)

`script.js`는 화면에서 입력한 SQL/텍스트에 대해 **변수명(또는 토큰) 치환**을 수행하고, 결과를 출력 텍스트 영역에 넣은 뒤 **클립보드 자동 복사**까지 처리하는 UI 스크립트입니다.

핵심 기능은 다음과 같습니다.

- “변경 전(before) → 변경 후(after)” 매핑 목록을 행 단위로 구성
- 입력 쿼리(`inputQuery`)에 대해 매핑대로 치환 수행
- 옵션에 따라
  - 대소문자 구분/무시
  - 단어 경계(식별자 경계) 기반 치환
  - 문자열 리터럴('...') 내부 치환 스킵
- 결과를 `outputQuery`에 출력하고 자동 복사

---

## 2) 전체 실행 흐름(When/How)

1. 파일 로드 시 콘솔에 시작 로그 출력
2. `window.onerror`를 등록하여 런타임 에러를 콘솔에 상세 출력
3. IIFE(즉시 실행 함수)로 내부 스코프를 구성
4. DOM 준비 상태에 따라
   - `DOMContentLoaded` 후에 `attachHandlers()` 실행하거나
   - 이미 로딩이 끝났다면 즉시 `attachHandlers()` 실행
5. `attachHandlers()`에서 버튼을 찾은 뒤 이벤트 리스너 연결
   - `#runBtn` 클릭 시: 치환 실행 → 결과 출력 → 클립보드 복사
   - `#clearBtn` 클릭 시: 입력/출력/매핑 입력값 초기화

---

## 3) DOM 의존성(필수 요소)

이 스크립트는 아래 요소가 DOM에 존재한다고 가정합니다.

- 버튼
  - `runBtn`: 실행 버튼
  - `clearBtn`: 초기화 버튼
- 텍스트 영역/입력
  - `inputQuery`: 원본 SQL/텍스트 입력
  - `outputQuery`: 변환 결과 출력
- 옵션
  - `caseMode`(select): 대소문자 모드
    - 값이 `insensitive`이면 정규식 플래그 `gi`
    - 그 외는 `g`
  - `useWordBoundary`(checkbox): 단어 경계(식별자 경계) 적용 여부
  - `skipStrings`(checkbox): 문자열 리터럴('...') 내부 치환 스킵 여부
- 매핑 입력 행들
  - `.beforeVar`: 변경 전(From)
  - `.afterVar`: 변경 후(To)

요소가 아직 존재하지 않으면 `attachHandlers()`는 100ms 뒤 재시도합니다.

---

## 4) 함수별 상세 설명

### 4.1 `byId(id)`

- 역할: `document.getElementById`를 짧게 쓰기 위한 헬퍼
- 사용처: 대부분의 DOM 요소 접근

### 4.2 `parseMappings()` — 매핑 행 파싱(핵심)

**행 기준 매핑(같은 인덱스의 before/after를 한 쌍으로)** 으로 목록을 만듭니다.

동작 규칙:

- `.beforeVar`와 `.afterVar`를 각각 배열로 수집하고, 길이의 최솟값만큼 루프
- 각 행에서 `trim()` 후
  - `from`(before)이 비어 있으면 그 행은 **무시(skip)**
  - `to`(after)은 비어 있어도 쌍은 만들며, 치환 결과가 빈 문자열이 될 수 있음
- 추가로, `beforeCount`/`afterCount`를 세어 **비어있지 않은 값의 개수가 다르면 안내문(notice)** 을 생성
  - 결과 텍스트 상단에 `-- 안내: ...` 형태로 붙습니다.

리턴 값:

- `{ pairs, notice }`
  - `pairs`: `{from, to}` 배열
  - `notice`: 불일치가 있을 때만 문자열, 아니면 빈 문자열

### 4.3 `escapeRegExp(s)`

- 역할: 사용자 입력(변수명)을 정규식 패턴으로 사용할 때 특수문자를 이스케이프
- 효과: `A.B` 같은 값이 정규식에서 임의 매치로 해석되지 않게 보호

### 4.4 `regexFlags()`

- 역할: `caseMode` 값에 따라 정규식 플래그 결정
- 반환:
  - `insensitive` → `gi` (전역 + 대소문자 무시)
  - 그 외 → `g` (전역)

### 4.5 `makeRegexPattern(raw, useWordBoundary)` — 치환 정규식 생성(핵심)

- 입력:
  - `raw`: 치환 대상 문자열(변경 전)
  - `useWordBoundary`: 경계 적용 여부
- 출력: `RegExp`

경계 미사용(`useWordBoundary=false`):

- 단순히 `escaped`를 `new RegExp(escaped, flags)`로 생성

경계 사용(`useWordBoundary=true`):

- 식별자 문자를 `[A-Za-z0-9_]`로 정의
- 패턴은 다음 의미를 가집니다.
  - 앞쪽에 식별자 문자 또는 `:`가 오면 매치 금지
  - 뒤쪽에 식별자 문자 또는 `:`가 오면 매치 금지
- 구현은 lookbehind를 사용합니다.

```
(?<![A-Za-z0-9_]|:)RAW(?![A-Za-z0-9_]|:)
```

- 목적:
  - `ABC`를 치환할 때 `XABCY` 같은 긴 식별자 내부를 잘못 치환하지 않도록 방지
  - `:ABC` 또는 `ABC:` 같은 형태(예: 바인드 변수/네임스페이스 스타일)를 경계로 취급하여 과치환을 줄이려는 의도

호환성(중요):

- 일부 브라우저/구버전 환경에서 lookbehind(`(?<!)`) 미지원일 수 있어 `try/catch`로 감싸고,
  - 실패 시 **폴백으로 경계 없는 정규식**을 사용합니다.

### 4.6 `replaceOutsideStrings(sql, pairs, useWordBoundary)` — 문자열 리터럴 밖에서만 치환

옵션 `skipStrings`가 켜져 있을 때 사용됩니다.

- 입력 SQL을 아래 정규식으로 분리합니다.

```
('(?:''|[^'])*')
```

의미:

- `'...'` 단일 인용부호 문자열을 통째로 캡처
- `''`(이스케이프된 작은따옴표)도 문자열 내부로 처리

알고리즘:

- `split()` 결과에서
  - 홀수 인덱스(1,3,5,...)는 문자열 리터럴이므로 **그대로 둠**
  - 짝수 인덱스(0,2,4,...)만 매핑 치환 수행

추가 특징:

- 매핑은 `from` 길이 내림차순으로 정렬 후 적용
  - 예: `ABC`와 `AB`가 동시에 있을 때 `AB`를 먼저 바꾸면 `ABC`가 깨지는 문제를 예방

제한사항:

- 이 로직은 **단일 인용부호 문자열**만 고려합니다.
  - `"..."` (double quote), 백틱, PostgreSQL의 dollar-quoted 문자열 등은 고려하지 않습니다.

### 4.7 `copyToClipboard(text)` / `fallbackCopy(text)` — 자동 복사

우선순위:

1) 표준 Clipboard API 사용

- `navigator.clipboard.writeText(text)`
- 실패 시 경고 로그 후 2)로 폴백

2) 폴백(구형 브라우저)

- 임시 `<textarea>`를 DOM에 붙여 `document.execCommand('copy')` 수행
- 성공/실패를 Promise로 래핑하여 호출부에서 동일하게 처리

복사 실패 시 UX:

- 실패하면 `outputQuery`에 포커스 및 전체 선택(`select()`)하여 사용자가 수동 복사할 수 있게 함

### 4.8 `attachHandlers()` — 버튼 이벤트 연결

- `#runBtn`, `#clearBtn`를 찾지 못하면 100ms 후 재시도
- 찾으면 클릭 이벤트 연결

`runBtn` 클릭 시 처리:

1) 입력 로드
- `inputQuery` 값을 읽음
2) 매핑 파싱
- `parseMappings()` → `{pairs, notice}`
3) 매핑이 없으면
- `outputQuery`에 안내문 + 원본 그대로 출력하고 종료
4) 옵션 로드
- `useWordBoundary`, `skipStrings`
5) 치환 수행
- `skipStrings=true` → `replaceOutsideStrings()`
- `skipStrings=false` → 전체 문자열에 대해 순차 replace
  - 이때도 매핑을 길이 내림차순 정렬 후 적용
6) `notice`가 있으면 결과 앞에 붙여 `outputQuery`에 출력
7) 클립보드 복사 시도
- 성공: 로그
- 실패: 에러 로그 + `outputQuery` 포커스/전체선택

`clearBtn` 클릭 시 처리:

- `inputQuery`, `outputQuery`를 빈 문자열로 초기화
- `.beforeVar`, `.afterVar` 값도 모두 빈 문자열로 초기화

---

## 5) 동작 예시

### 예시 1: 기본 치환

- 매핑
  - `CUST_ID` → `CUSTOMER_ID`
  - `CUST_NM` → `CUSTOMER_NAME`
- 입력

```
SELECT CUST_ID, CUST_NM FROM T_CUSTOMER;
```

- 결과

```
SELECT CUSTOMER_ID, CUSTOMER_NAME FROM T_CUSTOMER;
```

### 예시 2: 문자열 리터럴 내부 치환 스킵

- 매핑
  - `CUST_ID` → `CUSTOMER_ID`
- 입력

```
SELECT 'CUST_ID' AS LIT, CUST_ID FROM T;
```

- `skipStrings=true`이면 결과는

```
SELECT 'CUST_ID' AS LIT, CUSTOMER_ID FROM T;
```

---

## 6) 주의/제한 사항

- `useWordBoundary`는 lookbehind 기반이며, 환경에 따라 폴백이 동작할 수 있습니다(폴백 시 경계 미적용).
- `skipStrings`는 단일 인용부호 문자열만 처리합니다. SQL 방언별 특수 문자열은 제외될 수 있습니다.
- 매핑의 `to`가 빈 값이면 해당 토큰이 삭제(빈 문자열로 치환)될 수 있습니다.
- 매핑 개수가 불일치할 때도 동작은 계속하며, 결과 상단에 `-- 안내:` 주석을 추가합니다.

---

## 7) 유지보수 포인트(개선 아이디어)

- `idChar`에 `$` 등 추가 문자를 포함할지(프로젝트에서 사용하는 식별자 규칙에 맞춰 조정)
- 문자열 리터럴 처리 확장(예: `"..."`, PostgreSQL dollar-quote)
- 매우 긴 SQL에서 성능 향상을 위해 정규식/치환 루프 최적화(필요 시)
