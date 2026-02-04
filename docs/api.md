# API 문서

## 화면(엔트리포인트) 요약

이 문서는 함수 레퍼런스가 중심이지만, 프로젝트 내 주요 화면(HTML)과 연결된 스크립트를 빠르게 찾을 수 있도록 엔트리포인트를 함께 정리합니다.

- 기본 변수 치환 도우미: `index.html` → `js/script.js`
  - 사용 가이드: `docs/usage-guide.md`
  - 상세 설명: `docs/script-js.md`
- DW/DM 공통 변수 변환: `comMapper.html` → `js/comMapper.js`
- VAR → VALUE 변환: `variable-mapper.html` → `js/variable-mapper.js`
- 한글 식별자 → 백틱 래핑(BigQuery): `backtick-wrapper.html` → `js/backtick-wrapper.js`
  - 상세 문서: `docs/backtick-wrapper-guide.md`

## 함수 레퍼런스

이 문서는 CS-Convert의 JavaScript 함수들에 대한 상세한 기술 문서입니다.

---

## 목차
1. [유틸리티 함수](#유틸리티-함수)
2. [매핑 처리 함수](#매핑-처리-함수)
3. [정규식 처리 함수](#정규식-처리-함수)
4. [치환 처리 함수](#치환-처리-함수)
5. [이벤트 핸들러](#이벤트-핸들러)

---

## 유틸리티 함수

### `byId(id)`

DOM 요소를 ID로 가져오는 헬퍼 함수입니다.

**매개변수:**
- `id` (string): 요소의 ID

**반환값:**
- `HTMLElement`: 해당 ID를 가진 DOM 요소

**예시:**
```javascript
const inputBox = byId('inputQuery');
console.log(inputBox.value);
```

**사용 위치:**
- 모든 DOM 조작 시 사용
- `document.getElementById()`의 축약형

---

## 매핑 처리 함수

### `parseMappings()`

변경 전/후 변수 매핑을 파싱하여 처리 가능한 형태로 변환합니다.

**매개변수:**
- 없음 (DOM에서 직접 읽음)

**반환값:**
- `Object`:
  - `pairs` (Array): `{from, to}` 형태의 매핑 객체 배열
  - `notice` (string): 줄 수 불일치 시 안내 메시지

**처리 과정:**
```
1. beforeVars와 afterVars에서 텍스트 가져오기
2. 줄바꿈(\r?\n)으로 분리
3. 각 줄의 공백 제거 (trim)
4. 빈 줄 필터링 (filter(Boolean))
5. 같은 인덱스끼리 매칭
6. 줄 수 불일치 검사
```

**예시:**
```javascript
// 입력:
// beforeVars: ":OLD\n:VAR1\n\n:VAR2"
// afterVars:  ":NEW\n:VAR_1\n:VAR_2"

const {pairs, notice} = parseMappings();
// pairs: [
//   {from: ":OLD", to: ":NEW"},
//   {from: ":VAR1", to: ":VAR_1"},
//   {from: ":VAR2", to: ":VAR_2"}
// ]
// notice: ""
```

**반환 예시 (불일치):**
```javascript
// beforeVars에 5줄, afterVars에 3줄인 경우
{
  pairs: [{...}, {...}, {...}],  // 3개만
  notice: "-- 안내: 매핑 줄 수 불일치 (변경전:5, 변경후:3) -> 앞에서 3개만 적용됨\n"
}
```

---

## 정규식 처리 함수

### `escapeRegExp(s)`

정규식 특수 문자를 이스케이프합니다.

**매개변수:**
- `s` (string): 이스케이프할 문자열

**반환값:**
- `string`: 이스케이프된 문자열

**처리되는 특수문자:**
```
. * + ? ^ $ { } ( ) | [ ] \
```

**예시:**
```javascript
escapeRegExp("test.value");     // "test\\.value"
escapeRegExp("price*discount"); // "price\\*discount"
escapeRegExp("a+b");            // "a\\+b"
escapeRegExp("$100");           // "\\$100"
```

**정규식 패턴:**
```javascript
/[.*+?^${}()|[\]\\]/g
```

---

### `regexFlags()`

현재 대소문자 구분 옵션에 따라 정규식 플래그를 반환합니다.

**매개변수:**
- 없음 (DOM에서 직접 읽음)

**반환값:**
- `string`: 정규식 플래그
  - `"gi"`: 대소문자 구분 안 함 (global + case-insensitive)
  - `"g"`: 대소문자 구분함 (global only)

**예시:**
```javascript
// caseMode = "insensitive"
regexFlags(); // "gi"

// caseMode = "sensitive"
regexFlags(); // "g"
```

---

### `makeRegexPattern(raw, useWordBoundary)`

검색 문자열에 대한 정규식 패턴을 생성합니다.

**매개변수:**
- `raw` (string): 원본 검색 문자열
- `useWordBoundary` (boolean): 단어 경계 사용 여부

**반환값:**
- `RegExp`: 생성된 정규식 객체

**동작 방식:**

#### 1. 단순 모드 (useWordBoundary = false)
```javascript
makeRegexPattern(":OLD_VAR", false);
// 결과: /\:OLD_VAR/gi (또는 /g)
```

#### 2. 경계 매칭 모드 (useWordBoundary = true)
```javascript
makeRegexPattern(":OLD_VAR", true);
// 결과: /(?<![A-Za-z0-9_]|:)\:OLD_VAR(?![A-Za-z0-9_]|:)/gi
```

**경계 조건 설명:**
```javascript
const idChar = '[A-Za-z0-9_]';           // 식별자 문자
const boundaryBefore = `(?<!${idChar}|:)`; // Negative Lookbehind
const boundaryAfter = `(?!${idChar}|:)`;   // Negative Lookahead
```

**예시:**
```javascript
// 입력 문자열: "SELECT :ID, :ID_NAME, :USER_ID"
const pattern = makeRegexPattern(":ID", true);

// 매칭 결과:
// :ID       ✅ 매칭 (앞뒤로 경계)
// :ID_NAME  ❌ 매칭 안 됨 (뒤에 _NAME)
// :USER_ID  ❌ 매칭 안 됨 (앞에 USER_)
```

---

## 치환 처리 함수

### `replaceOutsideStrings(sql, pairs, useWordBoundary)`

SQL 문자열에서 따옴표 리터럴 외부만 치환합니다.

**매개변수:**
- `sql` (string): 입력 SQL 또는 텍스트
- `pairs` (Array): `{from, to}` 매핑 배열
- `useWordBoundary` (boolean): 단어 경계 사용 여부

**반환값:**
- `string`: 치환된 결과 문자열

**알고리즘:**

```javascript
// 1단계: 문자열 분리
const segments = sql.split(/('(?:''|[^'])*')/g);
// 정규식 설명:
// '           - 시작 따옴표
// (?:''|[^'])* - 이스케이프된 따옴표('') 또는 따옴표가 아닌 문자
// '           - 종료 따옴표

// 2단계: 세그먼트 처리
for (let i = 0; i < segments.length; i++) {
  if (i % 2 === 1) continue;  // 홀수 인덱스는 문자열 리터럴
  // 짝수 인덱스는 일반 코드 영역 → 치환 수행
}

// 3단계: 재결합
return segments.join('');
```

**예시:**

```javascript
const sql = "SELECT * FROM t WHERE name = 'John :OLD' AND id = :OLD";
const pairs = [{from: ":OLD", to: ":NEW"}];

replaceOutsideStrings(sql, pairs, false);
// 결과: "SELECT * FROM t WHERE name = 'John :OLD' AND id = :NEW"
//                                              ↑ 유지        ↑ 변경
```

**세그먼트 분리 예시:**
```javascript
// 입력: "A 'B' C 'D' E"
// 분리 결과:
// [0]: "A "      (일반 코드)
// [1]: "'B'"     (문자열 리터럴)
// [2]: " C "     (일반 코드)
// [3]: "'D'"     (문자열 리터럴)
// [4]: " E"      (일반 코드)
```

**긴 문자열 우선 처리:**
```javascript
const sorted = [...pairs].sort((a, b) => b.from.length - a.from.length);
// 이유: :OLD_VAR보다 :OLD를 먼저 치환하면 문제 발생
// 올바른 순서: :OLD_VAR_NAME → :OLD_VAR → :OLD
```

---

## 이벤트 핸들러

### 변경 버튼 클릭 핸들러

**이벤트:** `click` on `#runBtn`

**처리 순서:**
```javascript
1. 입력 쿼리 가져오기
   const input = byId('inputQuery').value;

2. 매핑 정보 파싱
   const {pairs, notice} = parseMappings();

3. 매핑 검증
   if (pairs.length === 0) { 안내 메시지 출력; return; }

4. 옵션 읽기
   const useBoundary = byId('useWordBoundary').checked;
   const skipStrings = byId('skipStrings').checked;

5. 치환 수행
   if (skipStrings) {
     output = replaceOutsideStrings(input, pairs, useBoundary);
   } else {
     // 전체 텍스트 치환
   }

6. 결과 출력
   byId('outputQuery').value = (notice || '') + output;
```

**전체 텍스트 치환 로직:**
```javascript
let s = input;
const sorted = [...pairs].sort((a,b) => b.from.length - a.from.length);
for (const {from, to} of sorted) {
  const re = makeRegexPattern(from, useBoundary);
  s = s.replace(re, to);
}
output = s;
```

---

### 초기화 버튼 클릭 핸들러

**이벤트:** `click` on `#clearBtn`

**동작:**
```javascript
byId('inputQuery').value = '';   // 입력 쿼리 초기화
byId('beforeVars').value = '';   // 변경 전 변수 초기화
byId('afterVars').value = '';    // 변경 후 변수 초기화
byId('outputQuery').value = '';  // 출력 결과 초기화
```

---

## 데이터 구조

### Pair 객체
```typescript
interface Pair {
  from: string;  // 변경 전 문자열
  to: string;    // 변경 후 문자열
}
```

### ParseResult 객체
```typescript
interface ParseResult {
  pairs: Pair[];   // 매핑 배열
  notice: string;  // 안내 메시지 (없으면 빈 문자열)
}
```

---

## 사용 예시

### 기본 사용
```javascript
// 1. 매핑 파싱
const {pairs, notice} = parseMappings();

// 2. 정규식 생성
const regex = makeRegexPattern(":OLD_VAR", true);

// 3. 치환 수행
const result = input.replace(regex, ":NEW_VAR");
```

### 고급 사용
```javascript
// 여러 변수 일괄 치환
const pairs = [
  {from: ":VAR1", to: ":NEW_VAR1"},
  {from: ":VAR2", to: ":NEW_VAR2"}
];

let result = input;
for (const {from, to} of pairs) {
  const pattern = makeRegexPattern(from, true);
  result = result.replace(pattern, to);
}
```

### 문자열 보호 치환
```javascript
const sql = "SELECT ':OLD' AS col, :OLD FROM table";
const pairs = [{from: ":OLD", to: ":NEW"}];

const output = replaceOutsideStrings(sql, pairs, true);
// 결과: "SELECT ':OLD' AS col, :NEW FROM table"
```

---

## 성능 고려사항

### 시간 복잡도

1. **parseMappings()**: O(n) - n은 총 줄 수
2. **escapeRegExp()**: O(m) - m은 문자열 길이
3. **makeRegexPattern()**: O(m)
4. **replaceOutsideStrings()**: O(n × m × p)
   - n: SQL 문자열 길이
   - m: 평균 세그먼트 길이
   - p: 매핑 개수

### 최적화 팁

1. **긴 문자열 우선**: 자동으로 처리됨
2. **정규식 캐싱**: 동일 패턴 재사용 시 고려
3. **대용량 처리**: 배치 처리 고려

---

## 에러 처리

현재 버전에서는 명시적인 에러 처리가 없습니다. 향후 버전에서 추가 예정:

```javascript
// 향후 계획
try {
  const result = replaceOutsideStrings(sql, pairs, true);
} catch (error) {
  console.error('치환 중 오류:', error);
}
```

---

## 브라우저 호환성

### 필수 기능
- ES6 Arrow Functions
- ES6 Const/Let
- ES6 Template Literals
- ES6 Array Methods (map, filter, sort)
- ES6 Spread Operator (...)
- Regex Lookbehind (Chrome 62+, Firefox 78+)

### 지원 브라우저
- ✅ Chrome 62+
- ✅ Firefox 78+
- ✅ Safari 16.4+
- ✅ Edge 79+
- ❌ IE (미지원)

---

## 테스트 가이드

### 단위 테스트 예시

```javascript
// escapeRegExp 테스트
console.assert(
  escapeRegExp("a.b") === "a\\.b",
  "점(.) 이스케이프 실패"
);

// makeRegexPattern 테스트
const pattern = makeRegexPattern(":ID", true);
const testString = ":ID :ID_NAME :USER_ID";
const matches = testString.match(pattern);
console.assert(
  matches.length === 1,
  "경계 매칭 실패"
);

// replaceOutsideStrings 테스트
const input = "SELECT ':OLD', :OLD";
const pairs = [{from: ":OLD", to: ":NEW"}];
const output = replaceOutsideStrings(input, pairs, false);
console.assert(
  output === "SELECT ':OLD', :NEW",
  "문자열 보호 실패"
);
```

---

**마지막 업데이트**: 2025-12-14
**API 버전**: 1.0.0
