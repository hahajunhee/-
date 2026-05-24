import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/customer-stats?customer_id=X&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
// 단일 거래처의 매출/비용/순익 상세
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const customerId = Number(sp.get('customer_id'));
  if (!customerId) return NextResponse.json({ error: 'customer_id required' }, { status: 400 });

  let dateFrom = sp.get('date_from');
  let dateTo = sp.get('date_to');
  if (!dateFrom || !dateTo) {
    const year = new Date().getFullYear();
    dateFrom = `${year}-01-01`;
    dateTo = `${year}-12-31`;
  }
  const monthFrom = dateFrom.substring(0, 7);
  const monthTo = dateTo.substring(0, 7);

  // 거래처 정보
  const custRows = await query('SELECT * FROM customers WHERE id = $1', [customerId]);
  if (custRows.length === 0) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  const customer = custRows[0];

  // 매출 (revenues 탭) - 해당 거래처 매출
  const revenueList = await query(
    `SELECT * FROM revenues WHERE customer_id = $1 AND settlement_month BETWEEN $2 AND $3 ORDER BY settlement_month DESC, id DESC`,
    [customerId, monthFrom, monthTo]
  );

  // 비용 (costs 탭)
  const costList = await query(
    `SELECT * FROM costs WHERE customer_id = $1 AND settlement_month BETWEEN $2 AND $3 ORDER BY settlement_month DESC, id DESC`,
    [customerId, monthFrom, monthTo]
  );

  // 발주내역 (transactions, 본사로부터 매입한 금액 = 거래처의 매입/비용)
  const purchaseList = await query(
    `SELECT id, date, TO_CHAR(date, 'YYYY-MM-DD') as date_formatted, supply_total, vat_total, grand_total, payment_status, source, order_number
     FROM transactions
     WHERE customer_id = $1 AND date BETWEEN $2 AND $3
     ORDER BY date DESC, id DESC`,
    [customerId, dateFrom, dateTo]
  );

  // 월별 집계
  const allMonths: string[] = [];
  const [fy, fm] = monthFrom.split('-').map(Number);
  const [ty, tm] = monthTo.split('-').map(Number);
  let cy = fy, cm = fm;
  while (cy < ty || (cy === ty && cm <= tm)) {
    allMonths.push(`${cy}-${String(cm).padStart(2, '0')}`);
    cm++; if (cm > 12) { cm = 1; cy++; }
  }

  const monthlyMap: Record<string, { month: string; revenue: number; cost_other: number; cost_purchase: number; total_cost: number; profit: number }> = {};
  for (const m of allMonths) {
    monthlyMap[m] = { month: m, revenue: 0, cost_other: 0, cost_purchase: 0, total_cost: 0, profit: 0 };
  }
  for (const r of revenueList) {
    if (monthlyMap[r.settlement_month]) monthlyMap[r.settlement_month].revenue += Number(r.amount);
  }
  for (const c of costList) {
    if (monthlyMap[c.settlement_month]) monthlyMap[c.settlement_month].cost_other += Number(c.amount);
  }
  for (const t of purchaseList) {
    const m = (t.date_formatted || '').substring(0, 7);
    if (monthlyMap[m]) monthlyMap[m].cost_purchase += Number(t.grand_total);
  }
  for (const m of allMonths) {
    const row = monthlyMap[m];
    row.total_cost = row.cost_other + row.cost_purchase;
    row.profit = row.revenue - row.total_cost;
  }

  // 비용 카테고리별
  const costByCategory: Record<string, number> = {};
  for (const c of costList) {
    costByCategory[c.category] = (costByCategory[c.category] || 0) + Number(c.amount);
  }
  // 매출 카테고리별
  const revenueByCategory: Record<string, number> = {};
  for (const r of revenueList) {
    revenueByCategory[r.category] = (revenueByCategory[r.category] || 0) + Number(r.amount);
  }

  const totalRevenue = revenueList.reduce((s, r) => s + Number(r.amount), 0);
  const totalCostOther = costList.reduce((s, c) => s + Number(c.amount), 0);
  const totalCostPurchase = purchaseList.reduce((s, t) => s + Number(t.grand_total), 0);
  const totalCost = totalCostOther + totalCostPurchase;
  const totalProfit = totalRevenue - totalCost;

  return NextResponse.json({
    customer: {
      id: customer.id,
      company_name: customer.company_name,
      brand: customer.brand || '',
      operation_type: customer.operation_type,
      contact_name: customer.contact_name,
    },
    period: { date_from: dateFrom, date_to: dateTo },
    summary: {
      total_revenue: totalRevenue,
      total_cost_other: totalCostOther,
      total_cost_purchase: totalCostPurchase,
      total_cost: totalCost,
      total_profit: totalProfit,
      cost_ratio: totalRevenue > 0 ? totalCost / totalRevenue : 0,
    },
    monthly: Object.values(monthlyMap),
    revenue_by_category: Object.entries(revenueByCategory).map(([k, v]) => ({ category: k, total: v })),
    cost_by_category: Object.entries(costByCategory).map(([k, v]) => ({ category: k, total: v })),
    revenues: revenueList.map(r => ({
      id: r.id, settlement_month: r.settlement_month, category: r.category,
      amount: Number(r.amount), notes: r.notes, source: r.source,
    })),
    costs: costList.map(c => ({
      id: c.id, settlement_month: c.settlement_month, category: c.category,
      amount: Number(c.amount), notes: c.notes,
    })),
    purchases: purchaseList.map(t => ({
      id: t.id, date: t.date_formatted, supply_total: Number(t.supply_total),
      vat_total: Number(t.vat_total), grand_total: Number(t.grand_total),
      payment_status: t.payment_status, source: t.source, order_number: t.order_number,
    })),
  });
}
