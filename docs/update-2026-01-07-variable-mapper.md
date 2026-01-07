# 2026-01-07 변경사항 정리 (variable-mapper)

## 목적
`variable-mapper.html` 화면에서 SQL 내 변수 토큰을 실제 값으로 치환할 때,
- **DM 포맷(헤더에 PGM ID 존재)** 인 경우는 DM 규칙으로만 동작
- **DW 포맷(헤더에 PGM ID 없음)** 인 경우는 DW 규칙으로 동작
하도록 분기하여 매핑의 혼선을 방지했습니다.

또한 DW 규칙에서 테이블명 생성 시 특정 문자열을 하드코딩하지 않고, 프로그램ID로부터 서비스명을 동적으로 추출하도록 수정했습니다.

---

## 변경 파일
- `variable-mapper.html`
- `js/variable-mapper.js`

---

## 화면(UI) 변경
### DM 영역(기존 3개)
- DM 섹션 라벨: `[ETL : DM] ...` 문구 표시
- 매핑 입력 3개는 그대로 사용
  - 변경전 토큰은 현재 `@program_id`, `@target_table`, `@standard_date` 형태

### DW 영역(추가 5개)
- `run` 버튼 아래에 `[ETL : DW] ...` 문구 + 5개 매핑 입력을 추가
- 입력 토큰(변경전) 5개
  - `@program_id`
  - `@standard_date`
  - `@target_table`
  - `@job_seq`
  - `@temp_table`

---

## SQL 포맷 판별 규칙(중요)
실행 시 입력 SQL에 아래 주석 헤더가 있으면 **DM 포맷**으로 판별합니다.

- `/* PGM ID : ... */`

DM 포맷이면 **DW 자동매핑/치환은 적용하지 않습니다.**
(= DW 입력 영역은 존재하더라도 로직상 무시)

---

## DM 규칙(헤더 기반)
입력 SQL의 헤더에서 값을 읽어 치환합니다.

- `@program_id` ← `/* PGM ID : ... */`
- `@target_table` ← `/* TARGET TABLE : ... */`
- `@standard_date` ← `default`

DM 영역(3개 입력칸)은 화면 값도 사용하지만, DM 포맷인 경우 위의 헤더 기반 치환이 우선 적용됩니다.

---

## DW 규칙(헤더 없을 때)
### 1) @program_id 채움
- 우선순위
  1) `/* PGM ID : ... */`가 있으면 그 값을 사용
  2) 없으면 다음 패턴에서 따옴표 값을 파싱
  - 아래 형태(주석 처리된 형태도 인식)

```sql
DECLARE `log_프로그램ID` STRING DEFAULT '...';
--DECLARE `log_프로그램ID` STRING DEFAULT '...';
```

> 참고: 아래처럼 따옴표 실값이 없는 라인은 파싱 대상이 아닙니다.

```sql
DECLARE `log_프로그램ID` STRING DEFAULT @program_id;
```

### 2) @standard_date
- 비어있으면 `default`

### 3) @job_seq
- 비어있으면 `''`(빈 문자열)

### 4) @target_table / @temp_table
- `@program_id`에서 서비스명을 추출하여 생성
  - `@target_table` = `DW.<서비스명>`
  - `@temp_table` = `DWWRK.<서비스명>`

#### 서비스명 추출(하드코딩 제거)
- 규칙: `programId`에서 첫 `_` 뒤 문자열을 후보로 사용하고, 끝의 숫자(예: `01`)는 제거
  - 예: `wcsbv_서비스내역01` → `서비스내역`
  - 예: `abc_주문02` → `주문`

---

## 회사(내일) 업데이트 절차 (권장)
1. 회사 PC에서 최신 소스 받기
   - `git pull`
2. 브라우저에서 `variable-mapper.html` 열기
3. 케이스별로 확인
   - DM 포맷(헤더에 PGM ID 존재): DM 치환만 되는지
   - DW 포맷(헤더에 PGM ID 없음): DW 규칙 자동매핑이 되는지
4. 이상 시 확인 포인트
   - 개발자 도구(F12) → Console 로그 확인
   - 입력 SQL에 헤더 `/* PGM ID : ... */`가 있는지 여부 (DM/DW 분기 핵심)

---

## 변경사항 요약
- UI에 DW 매핑(5개) 입력 영역을 run 버튼 아래 추가
- DM/DW 포맷을 헤더 `PGM ID` 유무로 판별
- DW 자동매핑에서 프로그램별 서비스명 하드코딩 제거(동적 추출)
