import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const year = request.nextUrl.searchParams.get('year') || new Date().getFullYear().toString();

  // 월별 집계
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('*, items:transaction_items(*)')
    .gte('date', `${year}-01-01`)
    .lte('date', `${year}-12-31`)
    .order('date');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 월별 집계 계산
  const monthlyMap: Record<string, {
    month: string;
    transaction_count: number;
    supply_total: number;
    vat_total: number;
    grand_total: number;
    total_margin: number;
    total_net_profit: number;
  }> = {};

  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`;
    monthlyMap[key] = {
      month: key,
      transaction_count: 0,
      supply_total: 0,
      vat_total: 0,
      grand_total: 0,
      total_margin: 0,
      total_net_profit: 0,
    };
  }

  // 거래처별 집계
  const customerMap: Record<number, {
    customer_id: number;
    customer_name: string;
    transaction_count: number;
    supply_total: number;
    grand_total: number;
    unpaid_count: number;
    unpaid_total: number;
  }> = {};

  for (const txn of transactions || []) {
    const month = txn.date.substring(0, 7);
    if (monthlyMap[month]) {
      monthlyMap[month].transaction_count++;
      monthlyMap[month].supply_total += Number(txn.supply_total);
      monthlyMap[month].vat_total += Number(txn.vat_total);
      monthlyMap[month].grand_total += Number(txn.grand_total);

      for (const item of txn.items || []) {
        monthlyMap[month].total_margin += Number(item.margin);
        monthlyMap[month].total_net_profit += Number(item.net_profit);
      }
    }

    if (!customerMap[txn.customer_id]) {
      customerMap[txn.customer_id] = {
        customer_id: txn.customer_id,
        customer_name: '',
        transaction_count: 0,
        supply_total: 0,
        grand_total: 0,
        unpaid_count: 0,
        unpaid_total: 0,
      };
    }
    const c = customerMap[txn.customer_id];
    c.transaction_count++;
    c.supply_total += Number(txn.supply_total);
    c.grand_total += Number(txn.grand_total);
    if (txn.payment_status === 'unpaid') {
      c.unpaid_count++;
      c.unpaid_total += Number(txn.grand_total);
    }
  }

  // 거래처 이름 채우기
  const { data: customers } = await supabase.from('customers').select('id, company_name');
  for (const c of customers || []) {
    if (customerMap[c.id]) {
      customerMap[c.id].customer_name = c.company_name;
    }
  }

  return NextResponse.json({
    monthly: Object.values(monthlyMap),
    customers: Object.values(customerMap).sort((a, b) => b.grand_total - a.grand_total),
  });
}
