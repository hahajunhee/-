# 거래관리 시스템 - 굿푸드시스템

식자재 유통업체를 위한 거래명세서 관리 및 자동 생성 웹 애플리케이션

## 기능

- **대시보드**: 월별 매출/순익 차트, 거래처별 비중, 미입금 현황
- **품목 관리**: 상품 CRUD, 카테고리 필터, 마진/순익 자동 계산
- **거래처 관리**: 거래처 CRUD, 검색
- **거래 입력**: 날짜/거래처 선택 → 품목 추가 → 실시간 금액 계산
- **거래 내역**: 날짜/거래처/입금상태 필터, 입금 처리
- **거래명세서**: 공급자/공급받는자 정보 포함 인쇄용 명세서
- **설정**: 공급자 정보, 계좌 정보 관리

## 기술 스택

- **Frontend**: Next.js 16 + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Charts**: Recharts
- **Deployment**: Vercel

## 설치 및 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. Supabase 설정
1. [Supabase](https://supabase.com)에서 프로젝트 생성
2. `supabase_schema.sql`의 SQL을 Supabase SQL Editor에서 실행
3. `.env.example`을 `.env.local`로 복사 후 Supabase URL/Key 입력

```bash
cp .env.example .env.local
```

### 3. 개발 서버 실행
```bash
npm run dev
```

http://localhost:3000 에서 확인

## 배포 (Vercel)

1. GitHub에 push
2. Vercel에서 Import Repository
3. Environment Variables에 Supabase URL/Key 추가
4. Deploy
