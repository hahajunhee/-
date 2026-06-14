export type OperationType = '본점' | '직영점' | '가맹점' | '초도물품';

// 거래처용 (3종) — 거래처는 초도물품으로 지정할 수 없음
export const OPERATION_TYPES: OperationType[] = ['본점', '직영점', '가맹점'];
// 품목용 (4종) — 초도물품 별도 카테고리 포함
export const PRODUCT_OPERATION_TYPES: OperationType[] = ['본점', '직영점', '가맹점', '초도물품'];

export interface Product {
  id: number;
  name: string;
  brand: string;
  category: string;
  spec: string;
  unit: string;
  operation_type: OperationType;
  material_cost: number;
  other_cost: number;
  selling_price: number;
  vat_apply: boolean;
  apply_material_cost: boolean;  // Y: 거래 시 단가=재료원가 사용, N: 단가(납품가) 사용
  invoice_hidden: boolean;       // Y: 거래명세서/이메일에 표시 안 함 (대시보드/내부 손익에만 반영)
  sort_order?: number;           // 사용자 정렬 순서
  created_at?: string;
  // computed fields
  margin?: number;
  vat_amount?: number;
  net_profit?: number;
  margin_rate?: number;
}

export interface Customer {
  id: number;
  company_name: string;
  brand: string;             // 브랜드명 (한 상호가 여러 브랜드 운영 가능)
  contact_name: string;
  email: string;
  address: string;
  tel: string;
  business_type: string;
  business_category: string;
  fax: string;
  reg_number: string;
  operation_type: OperationType;
  royalty_type: 'percent' | 'fixed_monthly';  // 로열티 산정 방식
  royalty_rate: number;      // percent일 때 % (예: 5 = 5%)
  royalty_amount: number;    // fixed_monthly일 때 월 정기 금액 (원)
  created_at?: string;
}

export interface CostCategory {
  id: number;
  name: string;
  order_idx: number;
}

export interface Cost {
  id: number;
  customer_id: number | null;        // NULL = 본사 비용
  customer_name?: string;
  customer_brand?: string;
  operation_type?: OperationType;
  category: string;
  settlement_month: string;  // YYYY-MM
  amount: number;
  notes: string;
  created_at?: string;
}

export interface RevenueCategory {
  id: number;
  name: string;
  order_idx: number;
}

export interface Revenue {
  id: number;
  customer_id: number | null;       // NULL = 본사 매출
  customer_name?: string;
  customer_brand?: string;
  operation_type?: OperationType;
  category: string;
  settlement_month: string;          // YYYY-MM
  amount: number;
  notes: string;
  source: 'manual' | 'royalty_auto';  // 자동 생성된 본사 매출 식별용
  related_cost_id?: number | null;
  created_at?: string;
}

export interface TransactionItem {
  id?: number;
  transaction_id?: number;
  product_id: number;
  product_name: string;
  category: string;
  spec: string;
  unit: string;
  qty: number;
  unit_price: number;
  material_cost: number;
  other_cost: number;
  amount: number;
  vat_apply: boolean;
  vat_amount: number;
  margin: number;
  net_profit: number;
  invoice_hidden?: boolean;
}

export interface Transaction {
  id: number;
  date: string;
  customer_id: number;
  customer_name?: string;
  payment_status: 'paid' | 'unpaid';
  supply_total: number;
  vat_total: number;
  grand_total: number;
  created_at?: string;
  items?: TransactionItem[];
  customer?: Customer;
}

export interface Settings {
  id: number;
  company_name: string;
  rep_name: string;
  reg_number: string;
  address: string;
  business_type: string;
  business_category: string;
  tel: string;
  fax: string;
  bank_info: string;
  print_operator: string;
  invoice_note: string;
  seal_image: string;  // 법인 도장 이미지 (data URL 형식)
  brands: string[];    // 브랜드 목록 (본사에서 등록)
  categories: string[];
}

export interface DashboardSummary {
  month: string;
  transaction_count: number;
  supply_total: number;
  vat_total: number;
  grand_total: number;
  total_margin: number;
  total_net_profit: number;
}

export interface CustomerSummary {
  customer_id: number;
  customer_name: string;
  transaction_count: number;
  supply_total: number;
  grand_total: number;
  unpaid_count: number;
  unpaid_total: number;
}
