import { query } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const year = sp.get('year') || new Date().getFullYear().toString();
  const opType = sp.get('operation_type'); // 본사/직영/대리점/null=전체
  const customerId = sp.get('customer_id');

  // 공통 WHERE 절 구성 (year + 선택적 필터)
  // 거래 기반 쿼리: t, c 조인되어 있음
  const buildTxnWhere = (yearParam: number) => {
    const clauses = [`EXTRACT(YEAR FROM t.date) = $1`];
    const params: unknown[] = [yearParam];
    if (opType) { params.push(opType); clauses.push(`c.operation_type = $${params.length}`); }
    if (customerId) { params.push(Number(customerId)); clauses.push(`t.customer_id = $${params.length}`); }
    return { where: clauses.join(' AND '), params };
  };

  // 1) 월별 거래 헤더 합계
  const w1 = buildTxnWhere(Number(year));
  const monthlyTxn = await query(`
    SELECT
      TO_CHAR(t.date, 'YYYY-MM') as month,
      COUNT(t.id)::int as transaction_count,
      COALESCE(SUM(t.supply_total), 0)::numeric as supply_total,
      COALESCE(SUM(t.vat_total), 0)::numeric as vat_total,
      COALESCE(SUM(t.grand_total), 0)::numeric as grand_total
    FROM transactions t
    JOIN customers c ON t.customer_id = c.id
    WHERE ${w1.where}
    GROUP BY TO_CHAR(t.date, 'YYYY-MM')
  `, w1.params);

  // 2) 월별 손익 (transaction_items 집계)
  const w2 = buildTxnWhere(Number(year));
  const monthlyItem = await query(`
    SELECT
      TO_CHAR(t.date, 'YYYY-MM') as month,
      COALESCE(SUM(ti.margin), 0)::numeric as total_margin,
      COALESCE(SUM(ti.net_profit), 0)::numeric as total_net_profit
    FROM transaction_items ti
    JOIN transactions t ON ti.transaction_id = t.id
    JOIN customers c ON t.customer_id = c.id
    WHERE ${w2.where}
    GROUP BY TO_CHAR(t.date, 'YYYY-MM')
  `, w2.params);

  // 3) 월별 비용
  const buildCostWhere = (yearParam: number) => {
    const clauses = [`co.settlement_month LIKE $1`];
    const params: unknown[] = [`${yearParam}-%`];
    if (opType) { params.push(opType); clauses.push(`c.operation_type = $${params.length}`); }
    if (customerId) { params.push(Number(customerId)); clauses.push(`co.customer_id = $${params.length}`); }
    return { where: clauses.join(' AND '), params };
  };
  const w3 = buildCostWhere(Number(year));
  const monthlyCost = await query(`
    SELECT co.settlement_month as month, COALESCE(SUM(co.amount), 0)::numeric as total_cost
    FROM costs co
    JOIN customers c ON co.customer_id = c.id
    WHERE ${w3.where}
    GROUP BY co.settlement_month
  `, w3.params);

  const monthlyItemMap: Record<string, { total_margin: number; total_net_profit: number }> = {};
  for (const r of monthlyItem) {
    monthlyItemMap[r.month] = {
      total_margin: Number(r.total_margin),
      total_net_profit: Number(r.total_net_profit),
    };
  }
  const monthlyCostMap: Record<string, number> = {};
  for (const r of monthlyCost) monthlyCostMap[r.month] = Number(r.total_cost);

  const monthlyMap: Record<string, {
    month: string;
    transaction_count: number;
    supply_total: number;
    vat_total: number;
    grand_total: number;
    total_margin: number;
    total_net_profit: number;
    total_cost: number;
    final_profit: number;  // 매출 - 비용
  }> = {};
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`;
    monthlyMap[key] = {
      month: key, transaction_count: 0, supply_total: 0, vat_total: 0, grand_total: 0,
      total_margin: 0, total_net_profit: 0, total_cost: 0, final_profit: 0,
    };
  }
  for (const row of monthlyTxn) {
    const item = monthlyItemMap[row.month] || { total_margin: 0, total_net_profit: 0 };
    const cost = monthlyCostMap[row.month] || 0;
    const grand_total = Number(row.grand_total);
    monthlyMap[row.month] = {
      month: row.month,
      transaction_count: Number(row.transaction_count),
      supply_total: Number(row.supply_total),
      vat_total: Number(row.vat_total),
      grand_total,
      total_margin: item.total_margin,
      total_net_profit: item.total_net_profit,
      total_cost: cost,
      final_profit: grand_total - cost,
    };
  }
  // 비용만 있고 거래는 없는 월도 반영
  for (const [m, cost] of Object.entries(monthlyCostMap)) {
    if (monthlyMap[m] && monthlyMap[m].total_cost === 0) {
      monthlyMap[m].total_cost = cost;
      monthlyMap[m].final_profit = monthlyMap[m].grand_total - cost;
    }
  }

  // 4) 거래처별 집계
  const w4 = buildTxnWhere(Number(year));
  const customerTxn = await query(`
    SELECT
      t.customer_id,
      c.company_name as customer_name,
      c.operation_type,
      COUNT(t.id)::int as transaction_count,
      COALESCE(SUM(t.supply_total), 0)::numeric as supply_total,
      COALESCE(SUM(t.grand_total), 0)::numeric as grand_total,
      COUNT(CASE WHEN t.payment_status = 'unpaid' THEN 1 END)::int as unpaid_count,
      COALESCE(SUM(CASE WHEN t.payment_status = 'unpaid' THEN t.grand_total ELSE 0 END), 0)::numeric as unpaid_total
    FROM transactions t
    JOIN customers c ON t.customer_id = c.id
    WHERE ${w4.where}
    GROUP BY t.customer_id, c.company_name, c.operation_type
  `, w4.params);

  // 5) 거래처별 부가세 + 마진
  const w5 = buildTxnWhere(Number(year));
  const customerVat = await query(`
    SELECT
      t.customer_id,
      COALESCE(SUM(ti.vat_amount), 0)::numeric as sales_vat,
      COALESCE(SUM(CASE WHEN ti.vat_apply THEN FLOOR(ti.material_cost * 0.1) * ti.qty ELSE 0 END), 0)::numeric as purchase_vat,
      COALESCE(SUM(ti.margin), 0)::numeric as total_margin,
      COALESCE(SUM(ti.net_profit), 0)::numeric as total_net_profit
    FROM transaction_items ti
    JOIN transactions t ON ti.transaction_id = t.id
    JOIN customers c ON t.customer_id = c.id
    WHERE ${w5.where}
    GROUP BY t.customer_id
  `, w5.params);

  // 6) 거래처별 비용
  const w6 = buildCostWhere(Number(year));
  const customerCost = await query(`
    SELECT co.customer_id, COALESCE(SUM(co.amount), 0)::numeric as total_cost
    FROM costs co
    JOIN customers c ON co.customer_id = c.id
    WHERE ${w6.where}
    GROUP BY co.customer_id
  `, w6.params);

  const customerVatMap: Record<number, { sales_vat: number; purchase_vat: number; total_margin: number; total_net_profit: number }> = {};
  for (const r of customerVat) customerVatMap[r.customer_id] = {
    sales_vat: Number(r.sales_vat), purchase_vat: Number(r.purchase_vat),
    total_margin: Number(r.total_margin), total_net_profit: Number(r.total_net_profit),
  };
  const customerCostMap: Record<number, number> = {};
  for (const r of customerCost) customerCostMap[r.customer_id] = Number(r.total_cost);

  const customers = customerTxn.map((r) => {
    const vat = customerVatMap[r.customer_id] || { sales_vat: 0, purchase_vat: 0, total_margin: 0, total_net_profit: 0 };
    const cost = customerCostMap[r.customer_id] || 0;
    const grand_total = Number(r.grand_total);
    const cost_ratio = grand_total > 0 ? cost / grand_total : 0;
    return {
      customer_id: r.customer_id,
      customer_name: r.customer_name,
      operation_type: r.operation_type || '대리점',
      transaction_count: Number(r.transaction_count),
      supply_total: Number(r.supply_total),
      grand_total,
      unpaid_count: Number(r.unpaid_count),
      unpaid_total: Number(r.unpaid_total),
      sales_vat: vat.sales_vat,
      purchase_vat: vat.purchase_vat,
      net_vat: vat.sales_vat - vat.purchase_vat,
      total_margin: vat.total_margin,
      total_net_profit: vat.total_net_profit,
      total_cost: cost,
      cost_ratio,
      final_profit: grand_total - cost,
    };
  }).sort((a, b) => b.grand_total - a.grand_total);

  // 비용만 있는 거래처도 포함
  for (const [cid, cost] of Object.entries(customerCostMap)) {
    if (!customers.find(c => c.customer_id === Number(cid))) {
      const custRow = await query('SELECT company_name, operation_type FROM customers WHERE id = $1', [Number(cid)]);
      if (custRow.length > 0) {
        customers.push({
          customer_id: Number(cid),
          customer_name: custRow[0].company_name,
          operation_type: custRow[0].operation_type || '대리점',
          transaction_count: 0,
          supply_total: 0,
          grand_total: 0,
          unpaid_count: 0,
          unpaid_total: 0,
          sales_vat: 0,
          purchase_vat: 0,
          net_vat: 0,
          total_margin: 0,
          total_net_profit: 0,
          total_cost: cost,
          cost_ratio: 0,
          final_profit: -cost,
        });
      }
    }
  }

  // 7) 품목별 집계
  const w7 = buildTxnWhere(Number(year));
  const productData = await query(`
    SELECT
      ti.product_id,
      ti.product_name,
      ti.category,
      COALESCE(SUM(ti.qty), 0)::numeric as total_qty,
      COALESCE(SUM(ti.amount), 0)::numeric as total_amount,
      COALESCE(SUM(ti.vat_amount), 0)::numeric as sales_vat,
      COALESCE(SUM(CASE WHEN ti.vat_apply THEN FLOOR(ti.material_cost * 0.1) * ti.qty ELSE 0 END), 0)::numeric as purchase_vat,
      COALESCE(SUM(ti.net_profit), 0)::numeric as total_net_profit
    FROM transaction_items ti
    JOIN transactions t ON ti.transaction_id = t.id
    JOIN customers c ON t.customer_id = c.id
    WHERE ${w7.where}
    GROUP BY ti.product_id, ti.product_name, ti.category
    ORDER BY total_amount DESC
  `, w7.params);

  // 8) 비용 카테고리별 집계
  const w8 = buildCostWhere(Number(year));
  const costByCategory = await query(`
    SELECT co.category, COALESCE(SUM(co.amount), 0)::numeric as total
    FROM costs co
    JOIN customers c ON co.customer_id = c.id
    WHERE ${w8.where}
    GROUP BY co.category
    ORDER BY total DESC
  `, w8.params);

  // 전체 부가세/비용 합계
  const totalSalesVat = customers.reduce((s, r) => s + r.sales_vat, 0);
  const totalPurchaseVat = customers.reduce((s, r) => s + r.purchase_vat, 0);
  const totalCost = customers.reduce((s, r) => s + r.total_cost, 0);
  const totalGrandTotal = customers.reduce((s, r) => s + r.grand_total, 0);

  // 대리점 평균 (비교용) - operation_type=대리점인 것만
  const agencyCustomers = customers.filter(c => c.operation_type === '대리점');
  const agencyAvg = {
    grand_total: agencyCustomers.length > 0 ? agencyCustomers.reduce((s, c) => s + c.grand_total, 0) / agencyCustomers.length : 0,
    total_cost: agencyCustomers.length > 0 ? agencyCustomers.reduce((s, c) => s + c.total_cost, 0) / agencyCustomers.length : 0,
    cost_ratio: agencyCustomers.length > 0 ? agencyCustomers.reduce((s, c) => s + c.cost_ratio, 0) / agencyCustomers.length : 0,
    final_profit: agencyCustomers.length > 0 ? agencyCustomers.reduce((s, c) => s + c.final_profit, 0) / agencyCustomers.length : 0,
  };

  return NextResponse.json({
    monthly: Object.values(monthlyMap),
    customers,
    products: productData.map((r) => {
      const salesVat = Number(r.sales_vat);
      const purchaseVat = Number(r.purchase_vat);
      return {
        product_id: r.product_id,
        product_name: r.product_name,
        category: r.category,
        total_qty: Number(r.total_qty),
        total_amount: Number(r.total_amount),
        sales_vat: salesVat,
        purchase_vat: purchaseVat,
        net_vat: salesVat - purchaseVat,
        total_net_profit: Number(r.total_net_profit),
      };
    }),
    vat_summary: { sales_vat: totalSalesVat, purchase_vat: totalPurchaseVat, net_vat: totalSalesVat - totalPurchaseVat },
    cost_summary: {
      total_cost: totalCost,
      by_category: costByCategory.map(r => ({ category: r.category, total: Number(r.total) })),
    },
    grand_summary: {
      grand_total: totalGrandTotal,
      total_cost: totalCost,
      final_profit: totalGrandTotal - totalCost,
    },
    agency_avg: agencyAvg,
  });
}
