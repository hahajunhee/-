-- =============================================
-- 거래명세서 관리 시스템 - Neon DB 스키마
-- Neon SQL Editor에서 실행하세요
-- =============================================

-- 0. 사용자 테이블 (인증/권한)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'partner' CHECK (role IN ('master', 'partner')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  customer_id INTEGER,  -- 협력사 계정은 거래처에 연결
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 마스터 계정 (비밀번호: admin1234)
INSERT INTO users (email, password_hash, name, role, status) VALUES
  ('admin@goodfood.co.kr', '$2b$10$7d9PE4ErnHckjE5nK3iOw.JrKjEK3aMvftwMq/3v5iT/W/eZjACPe', '김수길', 'master', 'approved')
ON CONFLICT (email) DO NOTHING;

-- 1. 설정 테이블 (공급자 정보)
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  company_name TEXT NOT NULL DEFAULT '굿푸드시스템',
  rep_name TEXT NOT NULL DEFAULT '김수길',
  reg_number TEXT NOT NULL DEFAULT '132-81-60911',
  address TEXT NOT NULL DEFAULT '경기 구리시 동구릉로460번길 95 (사노동) 1층, 3층',
  business_type TEXT NOT NULL DEFAULT '제조,도소매,서비스',
  business_category TEXT NOT NULL DEFAULT '',
  tel TEXT NOT NULL DEFAULT '031-555-6663',
  fax TEXT NOT NULL DEFAULT '031-555-7774',
  bank_info TEXT NOT NULL DEFAULT '하나: 486-910008-32704 / 국민: 442801-01-132431',
  print_operator TEXT NOT NULL DEFAULT '신현숙',
  categories JSONB NOT NULL DEFAULT '["고기","야채","소스","가공","음료"]'::jsonb,
  CONSTRAINT settings_singleton CHECK (id = 1)
);

INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 2. 품목 테이블
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  spec TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT 'ea',
  material_cost NUMERIC(12,0) NOT NULL DEFAULT 0,
  other_cost NUMERIC(12,0) NOT NULL DEFAULT 0,
  selling_price NUMERIC(12,0) NOT NULL DEFAULT 0,
  vat_apply BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO products (name, category, spec, unit, material_cost, other_cost, selling_price, vat_apply) VALUES
  ('돈가그리살', '고기', '200g*4', 'kg', 5000, 5000, 30000, true),
  ('한우 등심(1++)', '고기', '냉장/진공', 'kg', 65000, 5000, 98000, false),
  ('돈삼겹살(무관/국산)', '고기', '1cm 슬라이스', 'kg', 12000, 2000, 18500, true),
  ('프리미엄 양갈비(숄더랙)', '고기', '8대/진공', 'kg', 28000, 3000, 45000, true),
  ('청경채(상급)', '야채', '1kg/봉', 'ea', 3500, 500, 5200, true),
  ('깐마늘(국내산)', '야채', '1kg/팩', 'ea', 7800, 200, 9500, true),
  ('특제 마라 소스(업소용)', '소스', '2kg/통', 'ea', 15000, 1000, 22000, true),
  ('냉동 중화면', '가공', '250g*5입', 'ea', 4200, 300, 6000, true),
  ('무라벨 생수(500ml)', '음료', '20병/박스', 'box', 3800, 1200, 7500, true)
ON CONFLICT DO NOTHING;

-- 3. 거래처 테이블 (= 협력사)
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  tel TEXT NOT NULL DEFAULT '',
  business_type TEXT NOT NULL DEFAULT '',
  business_category TEXT NOT NULL DEFAULT '',
  fax TEXT NOT NULL DEFAULT '',
  reg_number TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO customers (company_name, contact_name, email, address, tel, business_type, business_category, fax, reg_number) VALUES
  ('미식당 성수본점', '김도윤', 'misicdang@example.com', '서울 성동구 아차산로 17길 25, 1층', '010-1234-5678', '숙박 및 음식업', '한식 일반 음식점', '02-123-5679', '527-42-01009'),
  ('청담 갈비 가든', '이서준', 'cheongdam@example.com', '서울 강남구 삼성로 120길 48, 2층', '010-9876-5432', '숙박 및 음식업', '육류 구이 전문점', '02-987-5433', '527-42-01010'),
  ('더 스테이크 종로', '박민아', 'steak@example.com', '서울 종로구 인사동5길 11, B1', '010-2233-4455', '숙박 및 음식업', '서양식 음식점', '02-223-4456', '527-42-01011'),
  ('한남 테이블', '최지원', 'hannam@example.com', '서울 용산구 이태원로 222, 103호', '010-5566-7788', '숙박 및 음식업', '이탈리안 레스토랑', '02-556-7789', '527-42-01012'),
  ('연남동 소바집', '정해인', 'soba@example.com', '서울 마포구 동교로 38길 15', '010-9988-1122', '숙박 및 음식업', '일식 면 요리 전문', '02-998-1123', '527-42-01013')
ON CONFLICT DO NOTHING;

-- users → customers FK
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT fk_users_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. 거래 테이블 (거래입력 + 발주 통합)
-- source: 'manual' = 관리자 수기입력, 'order' = 협력사 발주
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'unpaid')),
  supply_total NUMERIC(12,0) NOT NULL DEFAULT 0,
  vat_total NUMERIC(12,0) NOT NULL DEFAULT 0,
  grand_total NUMERIC(12,0) NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual',
  notes TEXT NOT NULL DEFAULT '',
  order_number TEXT,
  user_id INTEGER,
  order_status TEXT NOT NULL DEFAULT 'confirmed',
  email_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. 거래 상세 테이블
CREATE TABLE IF NOT EXISTS transaction_items (
  id SERIAL PRIMARY KEY,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  spec TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT 'ea',
  qty NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit_price NUMERIC(12,0) NOT NULL DEFAULT 0,
  material_cost NUMERIC(12,0) NOT NULL DEFAULT 0,
  other_cost NUMERIC(12,0) NOT NULL DEFAULT 0,
  amount NUMERIC(12,0) NOT NULL DEFAULT 0,
  vat_apply BOOLEAN NOT NULL DEFAULT true,
  vat_amount NUMERIC(12,0) NOT NULL DEFAULT 0,
  margin NUMERIC(12,0) NOT NULL DEFAULT 0,
  net_profit NUMERIC(12,0) NOT NULL DEFAULT 0
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_source ON transactions(source);
CREATE INDEX IF NOT EXISTS idx_transaction_items_txn ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
