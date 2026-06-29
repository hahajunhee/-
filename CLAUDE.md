@AGENTS.md

# SOYANG F&C 거래·매출·비용 관리 시스템

소양에프앤씨(SOYANG F&C)의 본사·본점·직영점·가맹점 통합 관리 웹 애플리케이션. 발주(거래명세서) 발행, 매출/비용 집계, 로열티 자동 정산, 거래처별/본사 전체 PL 통계를 제공한다.

## 기술 스택

- **프레임워크**: Next.js 16.2.2 (App Router, Turbopack 빌드) — 반드시 `node_modules/next/dist/docs/`의 가이드를 참조 (training data와 다름)
- **언어**: TypeScript 5 (strict)
- **UI**: React 19 + Tailwind CSS v4 (`@tailwindcss/postcss`) + lucide-react 아이콘
- **DB**: Neon Postgres (serverless) — `@neondatabase/serverless` 사용
- **인증**: 자체 JWT (jsonwebtoken + bcryptjs), httpOnly 쿠키 `auth_token`
- **이메일**: nodemailer (Gmail SMTP)
- **PDF**: jspdf + html2canvas (클라이언트사이드 거래명세서 → PDF)
- **차트**: recharts
- **알림**: react-hot-toast
- **호스팅**: Vercel (GitHub push 시 자동 배포)

## 폴더 구조

```
src/
├── app/
│   ├── (master)/                  # 관리자/매니저 페이지 (route group)
│   │   ├── page.tsx               # 통계(본사) — 본사/본점/직영점·가맹점/총합 4단 PL
│   │   ├── customer-stats/        # 통계(거래처) — 거래처 1곳 단일 조회
│   │   ├── customers/             # 거래처 관리 (브랜드/운영구분/연락처)
│   │   ├── products/              # 품목 관리 (브랜드×운영구분 4탭, 순서 편집)
│   │   ├── transactions/new/      # 발주 (= 거래 입력)
│   │   ├── transactions/          # 발주 내역 (구 거래 내역)
│   │   ├── orders-manage/         # 발주 관리 (협력사 발주 승인)
│   │   ├── revenues/              # 매출 (본사/본점/직영점/가맹점)
│   │   ├── costs/                 # 비용 (식재료비/인건비/로열티 등)
│   │   ├── invoice/               # 거래명세서 (PDF/이메일 발송)
│   │   ├── members/               # 계정 관리 (관리자/매니저/거래처 계정)
│   │   └── settings/              # 본사 정보 (회사명/도장/계좌/브랜드 등록)
│   ├── (partner)/partner/         # 협력사(거래처) 포털
│   │   └── orders/                # 발주서 작성/내역
│   ├── api/                       # Route Handlers (모든 데이터 페칭)
│   │   ├── auth/                  # 로그인/세션
│   │   ├── customers/             # 거래처 CRUD
│   │   ├── products/              # 품목 CRUD + reorder
│   │   ├── transactions/          # 거래 CRUD
│   │   ├── orders/                # 발주 (transactions의 source='order')
│   │   ├── revenues/              # 매출 CRUD
│   │   ├── revenue-categories/    # 매출 카테고리
│   │   ├── costs/                 # 비용 CRUD (로열티 카테고리 시 본사 매출 자동 생성)
│   │   ├── cost-categories/       # 비용 카테고리
│   │   ├── hq-stats/              # 통계(본사) 집계
│   │   ├── customer-stats/        # 통계(거래처) 집계
│   │   ├── members/               # 계정 CRUD + 권한
│   │   ├── settings/              # 본사 정보
│   │   ├── email/                 # 거래명세서 이메일 발송
│   │   └── customers/[id]/balance/  # 거래처 미입금 잔액
│   ├── login/                     # 로그인 페이지
│   ├── register/                  # 회원가입 (협력사 신청)
│   ├── layout.tsx                 # 루트 레이아웃
│   └── globals.css                # Tailwind 디렉티브 + 인쇄 CSS
├── components/
│   ├── AuthGuard.tsx              # 역할별 페이지 가드 (master|manager|partner)
│   ├── MasterSidebar.tsx          # 관리자/매니저 사이드바
│   ├── PartnerSidebar.tsx         # 협력사 사이드바
│   ├── Modal.tsx                  # 공통 모달
│   └── PageHeader.tsx             # 페이지 헤더
├── lib/
│   ├── auth.ts                    # JWT 토큰 발급/검증, 세션
│   ├── db.ts                      # Neon 클라이언트 wrapper (`query()`)
│   ├── calculator.ts              # 마진·VAT·순익 등 비즈니스 계산
│   └── email.ts                   # nodemailer + 거래명세서 HTML 빌더
└── types/
    └── index.ts                   # Customer, Product, Transaction, Revenue, Cost 등 타입
```

## 주요 명령어

```bash
npm install           # 의존성 설치 (pnpm/yarn 도 가능)

npm run dev           # 개발 서버 (http://localhost:3000)
npm run build         # 프로덕션 빌드 (Turbopack)
npm run start         # 프로덕션 서버
npm run lint          # ESLint
```

## 환경변수 (`.env.local`)

다른 컴퓨터로 옮긴 뒤 반드시 아래 키들을 채워야 한다.

```
DATABASE_URL=                   # Neon Postgres 연결 문자열 (필수)
JWT_SECRET=                     # JWT 서명 비밀키 (필수 — 운영 환경)
GMAIL_USER=                     # 거래명세서 이메일 발송용 Gmail 주소 (선택)
GMAIL_APP_PASSWORD=             # Gmail 앱 비밀번호 16자리 (GMAIL_USER 사용 시 필수)
```

- `GMAIL_USER`/`GMAIL_APP_PASSWORD`가 없으면 이메일 발송이 mock 모드 (콘솔에만 로그)
- `JWT_SECRET`이 비어 있으면 코드 fallback 사용되나 운영 환경에선 반드시 설정

## 아키텍처 규칙

### 데이터 페칭
- **반드시** Route Handler(`src/app/api/.../route.ts`)를 거치도록 한다.
- 클라이언트 컴포넌트에서 `@neondatabase/serverless`를 직접 import 금지.
- `lib/db.ts`의 `query(sql, params)` 사용 — parameterized query, 다이렉트 문자열 보간 금지.

### 인증/권한
- `src/lib/auth.ts`의 `getSession()`을 Route Handler 최상단에서 호출.
- 역할: `master` | `manager` | `partner`.
- 권한 매트릭스:
  - `master`: 전체
  - `manager`: 거래처/품목/발주/발주내역/발주관리/매출/비용 + 통계(본사) 일부 (본점 매출/마진 차단)
    - `users.allowed_tabs` (JSONB) 로 탭별 권한 제한 가능
    - `users.can_view_margin` 으로 마진/순익 노출 여부 제어
  - `partner`: `/partner/...` 전용 (발주서 작성/내역)
- 라우트 그룹 `(master)` 는 master+manager 둘 다 접근, `(partner)` 는 partner 전용.

### 비즈니스 계산 (모두 `src/lib/calculator.ts`)
- 마진 = 단가(납품가) − 재료원가 − 기타원가
- 매출부가세 = 단가 × 10% (vat_apply=Y일 때만)
- 매입부가세 = 재료원가 × 10% (vat_apply=Y일 때만)
- **납부부가세 = 매출부가세 − 매입부가세** (손익 계산용)
- 거래명세서 표시 부가세는 매출부가세, 손익 계산은 납부부가세
- ~~장려금(incentive)~~ → **2026-06 제거됨**. 공장 리베이트 등 별도 수익은 **매출 탭에 본사 매출로 직접 입력**. (DB 컬럼은 보존되나 항상 0, UI/계산 미사용)

### UI 컴포넌트
- 데이터 페칭/상태 변경 로직은 페이지 컴포넌트에. 작은 `components/`는 표현만.
- 공통 색상 배지:
  - 운영구분: 본점=보라 / 직영점=파랑 / 가맹점=초록 / 초도물품=앰버
  - 본사(SOYANG F&C 자체) = 앰버 + Crown 아이콘
  - 브랜드 배지: indigo

### 핵심 데이터 모델
- `customers.operation_type`: 본점/직영점/가맹점 (3종)
- `products.operation_type`: 본점/직영점/가맹점/**초도물품** (4종)
- `customers.brand`: 브랜드명 문자열 (settings.brands 와 매칭)
- `products.brand` + `products.operation_type` 조합으로 발주 시 노출 결정
- `transactions.source`: `'manual'` (수기 입력) / `'order'` (협력사 발주)
- `revenues.customer_id`: NULL = 본사 매출
- `revenues.source`: `'manual'` / `'royalty_auto'` (비용 탭 로열티 자동 생성)
- `costs.customer_id`: NULL = 본사 비용

### 통계 계산 로직 (변경 시 신중)
- **2026-06 정책 변경**: 발주(transactions)는 통계에 **자동 반영하지 않음**. 매출=매출 탭(revenues), 비용=비용 탭(costs) **수기 입력만으로** 집계 (월단위 합산 입력). 발주/거래명세서 발행 기능 자체는 유지하되 손익/통계엔 미반영.
- **본사 매출** = SUM(revenues where customer_id IS NULL)
- **본사 비용** = SUM(costs where customer_id IS NULL)
- **본점 매출** = SUM(revenues for op_type='본점' customers), **본점 비용** = SUM(costs for 본점)
- **직영점/가맹점** 동일 패턴
- **총합** = 본사 + 본점 + 직영점 + 가맹점
- **비용 그룹핑**: `cost_categories.parent_group` 으로 상위 그룹(예: `재료원가`) 묶음. `lib/costGroups.ts`의 `buildCostGroups()`가 카테고리별 합계 → 그룹 합계 + 매출 대비 비율 구조로 변환. 통계 화면에서 그룹 헤더 + 하위 항목 + 합계 표시.
- 재료원가 하위 기본 6개: 재료_육류 / 재료_가공 / 재료_식자재 / 재료_소스 / 재료_주류 / 재료_음료 (비용구분 관리에서 그룹 변경 가능)

### 로열티 자동화
- `costs.category='로열티'` 추가 시 → 같은 금액으로 `revenues.source='royalty_auto', customer_id=NULL` 자동 생성
- 비용 수정/삭제 시 자동 매출도 동기화 (CASCADE 삭제)
- 자동 매출은 매출 페이지에서 수정/삭제 불가 (관련 비용을 수정해야 함)
- 거래처 테이블의 `royalty_rate/royalty_type/royalty_amount` 컬럼은 데이터 보존 차원에서 남아있으나 **UI에선 사용 X**

## 코드 컨벤션

- 커밋 메시지: Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`)
- PR 없이 main 직접 커밋 허용 (1인 운영). 기능 단위로 잘게 쪼개기.
- 새 SQL 컬럼 추가는 항상 `ADD COLUMN IF NOT EXISTS` + (필요 시) `ALTER ... DROP CONSTRAINT IF EXISTS` 패턴.
- DB 마이그레이션은 임시 `migrate.js` 스크립트로 직접 실행 후 삭제 (체크인하지 않음).
- 큰 변경 시 `npm run build`로 빌드 확인 후 커밋.

## 건드리지 말 것

- **`AGENTS.md`** — Next.js 버전 가이드. 함부로 수정 금지.
- **`schema.sql`** 의 시드 데이터 — 운영 DB와 분리된 참고용. 실제 변경은 마이그레이션 스크립트로.
- **`(master)/page.tsx` 의 4단 PL 구조** — 사용자가 직접 설계한 구조. 1.본사 / 2.본점 / 3.직영점·가맹점 / 4.총합 순서 유지. (※ 2026-06부터 계산식은 매출/비용 탭 수기 입력 기준 — 발주 미반영)
- **`lib/calculator.ts`** — 매출부가세/매입부가세/납부부가세 분리는 사용자 합의된 회계 모델. 함부로 단순화 X.
- **`/api/costs` 로열티 자동화 로직** — 비용 ↔ 본사 매출 양방향 동기. 삭제/변경 시 데이터 불일치 위험.

## DB 스키마 (요약)

| 테이블 | 핵심 컬럼 |
|---|---|
| `users` | role, status, customer_id(FK), allowed_tabs(JSONB), can_view_margin |
| `customers` | brand, operation_type, royalty_*(deprecated) |
| `products` | brand, operation_type, material_cost, selling_price, vat_apply, apply_material_cost, incentive, invoice_hidden, sort_order |
| `transactions` | source, customer_id, date, supply_total, vat_total, grand_total, payment_status, order_number |
| `transaction_items` | qty, unit_price, material_cost, amount, vat_amount, margin, net_profit, incentive, invoice_hidden |
| `revenues` | customer_id(nullable), category, settlement_month, amount, source, related_cost_id |
| `costs` | customer_id(nullable), category, settlement_month, amount |
| `revenue_categories` / `cost_categories` | 카테고리 목록 (관리자가 추가/삭제). `cost_categories.parent_group`: 상위 그룹(예: 재료원가) |
| `settings` | id=1 (단일행), company_name, brands(JSONB), seal_image, invoice_note 등 |
