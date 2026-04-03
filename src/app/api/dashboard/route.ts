import { query } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const year = request.nextUrl.searchParams.get('year') || new Date().getFullYear().toString();

  const monthlyData = await query(`
    SELECT
      TO_CHAR(t.date, 'YYYY-MM') as month,
      COUNT(DISTINCT t.id)::int as transaction_count,
      COALESCE(SUM(t.supply_total), 0)::numeric as supply_total,
      COALESCE(SUM(t.vat_total), 0)::numeric as vat_total,
      COALESCE(SUM(t.grand_total), 0)::numeric as grand_total,
      COALESCE(SUM(ti.margin), 0)::numeric as total_margin,
      COALESCE(SUM(ti.net_profit), 0)::numeric as total_net_profit
    FROM transactions t
    LEFT JOIN transaction_items ti ON t.id = ti.transaction_id
    WHERE EXTRACT(YEAR FROM t.date) = $1
    GROUP BY TO_CHAR(t.date, 'YYYY-MM')
    ORDER BY month
  `, [Number(year)]);

  // 12개월 전부 채우기
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
      month: key, transaction_count: 0, supply_total: 0,
      vat_total: 0, grand_total: 0, total_margin: 0, total_net_profit: 0,
    };
  }

  for (const row of monthlyData) {
    monthlyMap[row.month] = {
      month: row.month,
      transaction_count: Number(row.transaction_count),
      supply_total: Number(row.supply_total),
      vat_total: Number(row.vat_total),
      grand_total: Number(row.grand_total),
      total_margin: Number(row.total_margin),
      total_net_profit: Number(row.total_net_profit),
    };
  }

  const customerData = await query(`
    SELECT
      t.customer_id,
      c.company_name as customer_name,
      COUNT(t.id)::int as transaction_count,
      COALESCE(SUM(t.supply_total), 0)::numeric as supply_total,
      COALESCE(SUM(t.grand_total), 0)::numeric as grand_total,
      COUNT(CASE WHEN t.payment_status = 'unpaid' THEN 1 END)::int as unpaid_count,
      COALESCE(SUM(CASE WHEN t.payment_status = 'unpaid' THEN t.grand_total ELSE 0 END), 0)::numeric as unpaid_total
    FROM transactions t
    JOIN customers c ON t.customer_id = c.id
    WHERE EXTRACT(YEAR FROM t.date) = $1
    GROUP BY t.customer_id, c.company_name
    ORDER BY grand_total DESC
  `, [Number(year)]);

  return NextResponse.json({
    monthly: Object.values(monthlyMap),
    customers: customerData.map((r) => ({
      customer_id: r.customer_id,
      customer_name: r.customer_name,
      transaction_count: Number(r.transaction_count),
      supply_total: Number(r.supply_total),
      grand_total: Number(r.grand_total),
      unpaid_count: Number(r.unpaid_count),
      unpaid_total: Number(r.unpaid_total),
    })),
  });
}
