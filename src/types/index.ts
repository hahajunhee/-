export interface Product {
  id: number;
  name: string;
  category: string;
  spec: string;
  unit: string;
  material_cost: number;
  other_cost: number;
  selling_price: number;
  vat_apply: boolean;
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
  contact_name: string;
  address: string;
  tel: string;
  business_type: string;
  business_category: string;
  fax: string;
  reg_number: string;
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
