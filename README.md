# CS-Convert (변수 치환 도우미)

## 📋 프로젝트 소개

SQL 쿼리나 코드에서 변수명을 일괄 치환해주는 오프라인 웹 도구입니다. 
복잡한 SQL 쿼리에서 여러 변수를 한 번에 변경할 때 유용하게 사용할 수 있습니다.

## ✨ 주요 기능

### 1. 1:1 변수 매핑
- 변경 전/후 변수를 같은 줄 번호끼리 자동 매칭
- 여러 변수를 동시에 치환 가능
- 빈 줄은 자동으로 무시

### 2. 스마트 치환 옵션

#### 📌 따옴표 문자열 건너뛰기
```sql
-- 옵션 활성화 시
SELECT * FROM table WHERE name = ':OLD_VAR';  -- 따옴표 안은 치환되지 않음
SELECT :OLD_VAR FROM table;                   -- 이 부분만 치환됨
```

#### 📌 식별자 경계 매칭
```sql
-- 부분 문자열 오치환 방지
:OLD → :NEW 치환 시
:OLD_VAR → 변경되지 않음 (경계 검사로 보호)
:OLD     → :NEW (정확히 매칭되는 경우만 치환)
```

#### 📌 대소문자 구분
- **구분함**: 정확히 일치하는 경우만 치환
- **구분하지 않음** (기본값): 대소문자 무관하게 치환

### 3. 한글 식별자 백틱 래핑(BigQuery)
- 한글(예: 변수명/컬럼명/테이블명)이 포함된 식별자를 BigQuery에서 사용 가능하도록 `...`로 감싸는 보조 화면 제공
- 화면: `backtick-wrapper.html`
- 문서: `docs/backtick-wrapper-guide.md`

## 🚀 사용 방법

### 1단계: 쿼리 입력
변경하고자 하는 SQL 쿼리나 텍스트를 입력 박스에 붙여넣습니다.

```sql
SELECT * FROM `SCHEMA`.`TAB_A` 
WHERE col1 = :OLD_VAR1 
  AND col2 = :OLD_VAR2;
```

### 2단계: 변수 매핑 설정
**변경 전 변수**와 **변경 후 변수**를 각각 입력합니다.

| 변경 전 변수 | 변경 후 변수 |
|-------------|-------------|
| :OLD_VAR1   | :NEW_VAR1   |
| :OLD_VAR2   | :NEW_VAR2   |
| :TEMP_ID    | :USER_ID    |

### 3단계: 옵션 선택
필요에 따라 치환 옵션을 체크/해제합니다.

### 4단계: 변환 실행
**변경버튼**을 클릭하면 결과가 출력 박스에 표시됩니다.

```sql
SELECT * FROM `SCHEMA`.`TAB_A` 
WHERE col1 = :NEW_VAR1 
  AND col2 = :NEW_VAR2;
```

## 💡 사용 예시

### 예시 1: 기본 변수 치환
```sql
-- 입력
SELECT :SRC_DATE, :SRC_NAME FROM table;

-- 매핑
:SRC_DATE → :DST_DATE
:SRC_NAME → :DST_NAME

-- 출력
SELECT :DST_DATE, :DST_NAME FROM table;
```

### 예시 2: 문자열 내부 보호
```sql
-- 입력
INSERT INTO logs VALUES (':OLD_VAR', :OLD_VAR);

-- 옵션: 따옴표 문자열 건너뛰기 ✓
-- 매핑: :OLD_VAR → :NEW_VAR

-- 출력
INSERT INTO logs VALUES (':OLD_VAR', :NEW_VAR);
                        -- ↑ 따옴표 안은 유지됨
```

### 예시 3: 부분 치환 방지
```sql
-- 입력
SELECT :ID, :ID_NAME, :USER_ID FROM table;

-- 옵션: 식별자 경계 매칭 ✓
-- 매핑: :ID → :NEW_ID

-- 출력
SELECT :NEW_ID, :ID_NAME, :USER_ID FROM table;
       -- ↑ 정확히 :ID만 변경됨
```

## 🛠 기술 스택

- **HTML5**: 기본 구조
- **Vanilla JavaScript**: 순수 자바스크립트 (프레임워크 없음)
- **정규식(RegEx)**: 스마트한 패턴 매칭
  - Negative Lookbehind/Lookahead 활용
  - 동적 플래그 생성

## 📂 프로젝트 구조

```
CS-Convert/
├── index.html          # 메인 HTML 파일 (주석 포함)
├── README.md           # 프로젝트 문서
├── css/                # (향후 스타일 파일)
├── html/               # (향후 추가 HTML 파일)
└── js/                 # (향후 분리된 JS 파일)
```

## 🎯 주요 특징

### ✅ 오프라인 동작
- 인터넷 연결 없이 로컬에서 완전히 동작
- 데이터가 외부로 전송되지 않아 보안에 유리

### ✅ 경량 설계
- 외부 라이브러리 의존성 없음
- 단일 HTML 파일로 구성
- 빠른 로딩과 실행

### ✅ 사용자 친화적
- 직관적인 UI
- 실시간 치환 결과 확인
- 초기화 버튼으로 간편한 리셋

## 🔧 코드 구조

### 주요 함수

| 함수명 | 설명 |
|--------|------|
| `parseMappings()` | 변경 전/후 변수 매핑 파싱 |
| `escapeRegExp()` | 정규식 특수 문자 이스케이프 |
| `makeRegexPattern()` | 단어 경계를 고려한 정규식 생성 |
| `regexFlags()` | 대소문자 옵션에 따른 플래그 생성 |
| `replaceOutsideStrings()` | 문자열 리터럴 외부만 치환 |

### 이벤트 핸들러

- **변경 버튼**: 입력 쿼리를 옵션에 따라 치환하여 출력
- **초기화 버튼**: 모든 입력/출력 필드 초기화

## 📝 라이선스

이 프로젝트는 자유롭게 사용 가능합니다.

## 👨‍💻 개발자

- **GitHub**: [@joj1209](https://github.com/joj1209)
- **Repository**: [CS-Convert](https://github.com/joj1209/CS-Convert)

## 🔄 버전 히스토리

### v1.0.0 (2025-11-09)
- ✨ 초기 릴리스
- 📝 상세한 한글 주석 추가
- 🎯 기본 변수 치환 기능 구현
- 🛡️ 문자열 보호 및 경계 매칭 기능
- 📚 README 문서 작성

## 🤝 기여하기

버그 리포트, 기능 제안, Pull Request 환영합니다!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 문의

프로젝트에 대한 문의사항이나 버그 리포트는 [Issues](https://github.com/joj1209/CS-Convert/issues) 페이지를 이용해주세요.

---

**Made with ❤️ by joj1209**
