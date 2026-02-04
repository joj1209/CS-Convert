# CS-Convert 사용 가이드

## 목차
1. [시작하기](#시작하기)
2. [기본 사용법](#기본-사용법)
3. [고급 기능](#고급-기능)
4. [실전 예제](#실전-예제)
5. [FAQ](#faq)
6. [추가 도구](#추가-도구)

---

## 시작하기

### 실행 방법
1. `index.html` 파일을 웹 브라우저에서 엽니다
2. 인터넷 연결 없이도 완전히 동작합니다
3. 모든 처리는 클라이언트 측에서 이루어집니다

> 참고: 이 프로젝트에는 목적별로 분리된 보조 화면들이 있습니다. (각 화면은 오프라인으로 동일하게 동작)

### 화면 구성
```
┌─────────────────────────────────────┐
│  변경전 입력박스                    │
│  (SQL 쿼리 또는 텍스트 입력)         │
└─────────────────────────────────────┘

┌──────────────────┬──────────────────┐
│ 변경전 변수      │ 변경후 변수      │
│ :OLD_VAR1        │ :NEW_VAR1        │
│ :OLD_VAR2        │ :NEW_VAR2        │
└──────────────────┴──────────────────┘

┌─────────────────────────────────────┐
│  옵션 설정                          │
│  ☑ 따옴표 문자열 내부 건너뛰기      │
│  ☑ 식별자 경계 매칭                 │
│  대소문자 구분: [구분하지 않음▼]   │
└─────────────────────────────────────┘

[변경버튼] [초기화]

┌─────────────────────────────────────┐
│  변경후 출력박스                    │
│  (치환 결과 표시)                   │
└─────────────────────────────────────┘
```

---

## 추가 도구

CS-Convert는 단일 치환 화면 외에도 아래 보조 도구 화면을 제공합니다.

- **DW/DM 공통 변수 변환**: `comMapper.html`
- **VAR → VALUE 변환**: `variable-mapper.html`
- **한글 식별자 → 백틱 래핑(BigQuery)**: `backtick-wrapper.html`
  - 상세 문서: [backtick-wrapper-guide.md](backtick-wrapper-guide.md)


## 기본 사용법

### 1단계: 입력 준비
변환하려는 SQL 쿼리를 복사하여 **변경전 입력박스**에 붙여넣습니다.

```sql
SELECT 
    :EMPLOYEE_ID,
    :EMPLOYEE_NAME,
    :DEPARTMENT_ID
FROM employees
WHERE status = ':ACTIVE'
  AND hire_date >= :START_DATE;
```

### 2단계: 변수 매핑 설정

**변경전 변수** 입력:
```
:EMPLOYEE_ID
:EMPLOYEE_NAME
:DEPARTMENT_ID
:START_DATE
```

**변경후 변수** 입력:
```
:EMP_ID
:EMP_NAME
:DEPT_ID
:BEGIN_DATE
```

> 💡 **팁**: 같은 줄 번호끼리 1:1로 매칭됩니다!

### 3단계: 변환 실행
**변경버튼**을 클릭하면 결과가 출력됩니다:

```sql
SELECT 
    :EMP_ID,
    :EMP_NAME,
    :DEPT_ID
FROM employees
WHERE status = ':ACTIVE'
  AND hire_date >= :BEGIN_DATE;
```

---

## 고급 기능

### 옵션 1: 따옴표 문자열 내부 건너뛰기 ☑

SQL 문자열 리터럴 내부의 변수명은 치환하지 않습니다.

#### 예시
**입력:**
```sql
INSERT INTO logs (message, code) 
VALUES (':ERROR_CODE detected', :ERROR_CODE);
```

**매핑:** `:ERROR_CODE` → `:ERR_CD`

**출력 (옵션 활성화):**
```sql
INSERT INTO logs (message, code) 
VALUES (':ERROR_CODE detected', :ERR_CD);
        -- ↑ 따옴표 안은 그대로 유지
```

**출력 (옵션 비활성화):**
```sql
INSERT INTO logs (message, code) 
VALUES (':ERR_CD detected', :ERR_CD);
        -- ↑ 따옴표 안도 변경됨
```

### 옵션 2: 식별자 경계 매칭 ☑

변수명의 부분 문자열이 아닌 경우만 치환합니다.

#### 예시
**입력:**
```sql
SELECT :ID, :ID_NO, :USER_ID, :MAIN_ID_CODE FROM table;
```

**매핑:** `:ID` → `:IDENTIFIER`

**출력 (옵션 활성화):**
```sql
SELECT :IDENTIFIER, :ID_NO, :USER_ID, :MAIN_ID_CODE FROM table;
       -- ↑ 정확히 :ID만 변경됨
```

**출력 (옵션 비활성화):**
```sql
SELECT :IDENTIFIER, :IDENTIFIER_NO, :USER_IDENTIFIER, :MAIN_IDENTIFIER_CODE FROM table;
       -- ↑ 부분 문자열까지 모두 변경됨 (위험!)
```

### 옵션 3: 대소문자 구분

#### 구분하지 않음 (기본값)
```sql
-- 입력
SELECT :user_id, :USER_ID, :User_Id FROM table;

-- 매핑: :user_id → :account_id
-- 출력
SELECT :account_id, :account_id, :account_id FROM table;
```

#### 구분함
```sql
-- 입력
SELECT :user_id, :USER_ID, :User_Id FROM table;

-- 매핑: :user_id → :account_id
-- 출력
SELECT :account_id, :USER_ID, :User_Id FROM table;
       -- ↑ 정확히 일치하는 것만 변경
```

---

## 실전 예제

### 예제 1: 테이블 이름 변경

**시나리오**: 모든 `old_table`을 `new_table`로 변경

**입력:**
```sql
SELECT * FROM old_table WHERE id IN (SELECT id FROM old_table_backup);
```

**매핑:**
```
old_table → new_table
```

**출력:**
```sql
SELECT * FROM new_table WHERE id IN (SELECT id FROM old_table_backup);
-- ↑ 정확히 일치하는 것만 변경 (경계 매칭 덕분에 old_table_backup은 유지)
```

### 예제 2: 컬럼명 일괄 변경

**시나리오**: 프로젝트 전체에서 변수명 규칙 변경

**입력:**
```sql
SELECT 
    a.src_emp_id,
    a.src_emp_name,
    a.src_dept_code,
    b.src_salary
FROM employees a
LEFT JOIN salaries b ON a.src_emp_id = b.src_emp_id;
```

**매핑:**
```
src_emp_id    → employee_id
src_emp_name  → employee_name
src_dept_code → department_code
src_salary    → salary_amount
```

**출력:**
```sql
SELECT 
    a.employee_id,
    a.employee_name,
    a.department_code,
    b.salary_amount
FROM employees a
LEFT JOIN salaries b ON a.employee_id = b.employee_id;
```

### 예제 3: 파라미터 치환 (Oracle → PostgreSQL)

**시나리오**: Oracle 바인드 변수를 PostgreSQL 형식으로 변경

**입력:**
```sql
SELECT * FROM users 
WHERE user_id = :user_id
  AND status = :status
  AND created_at >= :start_date;
```

**매핑:**
```
:user_id    → $1
:status     → $2
:start_date → $3
```

**출력:**
```sql
SELECT * FROM users 
WHERE user_id = $1
  AND status = $2
  AND created_at >= $3;
```

---

## FAQ

### Q1: 매핑 줄 수가 다르면 어떻게 되나요?
**A:** 짧은 쪽에 맞춰 처리됩니다. 출력 상단에 안내 메시지가 표시됩니다.
```
-- 안내: 매핑 줄 수 불일치 (변경전:5, 변경후:3) -> 앞에서 3개만 적용됨
```

### Q2: 빈 줄은 어떻게 처리되나요?
**A:** 자동으로 무시됩니다. 아래 두 경우는 동일하게 처리됩니다:
```
:VAR1          :VAR1
:VAR2    vs    
:VAR3          :VAR2
               :VAR3
```

### Q3: 정규식이나 특수문자도 치환할 수 있나요?
**A:** 네! 특수문자는 자동으로 이스케이프됩니다.
```
입력: SELECT * FROM table WHERE col LIKE '%test%';
매핑: %test% → %exam%
출력: SELECT * FROM table WHERE col LIKE '%exam%';
```

### Q4: 긴 변수명과 짧은 변수명이 겹치면?
**A:** 자동으로 긴 변수명부터 처리하여 문제를 방지합니다.
```
매핑:
:OLD_VAR → :NEW_VAR
:OLD     → :CHANGED

처리 순서: :OLD_VAR 먼저 → :OLD 나중에
```

### Q5: 데이터가 서버로 전송되나요?
**A:** 아니요! 모든 처리는 브라우저에서만 이루어집니다. 완전히 안전합니다.

### Q6: 대용량 SQL도 처리 가능한가요?
**A:** 네! 브라우저 메모리가 허용하는 한 크기 제한이 없습니다.

### Q7: 결과를 파일로 저장할 수 있나요?
**A:** 출력 박스의 내용을 전체 선택(Ctrl+A) 후 복사하여 사용하세요.

---

## 단축키

| 키 조합 | 기능 |
|---------|------|
| `Ctrl + A` | 전체 선택 |
| `Ctrl + C` | 복사 |
| `Ctrl + V` | 붙여넣기 |
| `Tab` | 다음 필드로 이동 |

---

## 주의사항

⚠️ **경고사항**

1. **백업 먼저**: 중요한 SQL을 변환할 때는 원본을 먼저 백업하세요
2. **결과 검증**: 변환 후 반드시 결과를 확인하세요
3. **복잡한 쿼리**: 매우 복잡한 쿼리는 단계별로 나누어 처리하는 것이 안전합니다

✅ **권장사항**

1. 변환 전 옵션을 신중히 선택하세요
2. 소규모 테스트를 먼저 수행하세요
3. 예상치 못한 결과가 나오면 옵션을 조정해보세요

---

## 지원

- **버그 리포트**: [GitHub Issues](https://github.com/joj1209/CS-Convert/issues)
- **기능 제안**: [GitHub Discussions](https://github.com/joj1209/CS-Convert/discussions)
- **문서 개선**: Pull Request 환영합니다!

---

**마지막 업데이트**: 2025-12-14
