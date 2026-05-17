import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const session = await getSession();
  const isManager = session?.role === 'manager';

  const sp = request.nextUrl.searchParams;
  // 기간: date_from/date_to (YYYY-MM-DD). 둘 다 없으면 year로 폴백
  let dateFrom = sp.get('date_from');
  let dateTo = sp.get('date_to');
  if (!dateFrom || !dateTo) {
    const year = sp.get('year') || new Date().getFullYear().toString();
    dateFrom = `${year}-01-01`;
    dateTo = `${year}-12-31`;
  }
  let opType = sp.get('operation_type'); // 본점/직영점/가맹점/null=전체
  const brand = sp.get('brand');         // 브랜드 필터
  const customerIdsStr = sp.get('customer_ids') || sp.get('customer_id');
  const customerIds: number[] = customerIdsStr
    ? customerIdsStr.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n))
    : [];

  // 매니저 권한: 본점 통계 차단 → 본점 필터 차단, 직영점/가맹점만 보여줌
  if (isManager) {
    if (opType === '본점') opType = '직영점';  // 차단
    // customer_ids에 본점 포함되면 제외
    if (customerIds.length > 0) {
      const cust = await query(`SELECT id FROM customers WHERE id = ANY($1::int[]) AND operation_type != '본점'`, [customerIds]);
      const allowedIds = cust.map((c: { id: number }) => c.id);
      customerIds.length = 0;
      customerIds.push(...allowedIds);
    }
  }

  // 정산월 범위 (YYYY-MM) - 비용 테이블용
  const monthFrom = dateFrom.substring(0, 7);
  const monthTo = dateTo.substring(0, 7);

  // 트랜잭션 WHERE 절 빌더
  const buildTxnWhere = () => {
    const clauses = [`t.date BETWEEN $1 AND $2`];
    const params: unknown[] = [dateFrom, dateTo];
    if (opType) { params.push(opType); clauses.push(`c.operation_type = $${params.length}`); }
    if (brand !== null) { params.push(brand); clauses.push(`c.brand = $${params.length}`); }
    if (isManager) clauses.push(`c.operation_type != '본점'`);
    if (customerIds.length > 0) {
      const placeholders = customerIds.map((_, i) => `$${params.length + i + 1}`).join(',');
      clauses.push(`t.customer_id IN (${placeholders})`);
      params.push(...customerIds);
    }
    return { where: clauses.join(' AND '), params };
  };

  // 비용 WHERE 절 빌더
  const buildCostWhere = () => {
    const clauses = [`co.settlement_month BETWEEN $1 AND $2`];
    const params: unknown[] = [monthFrom, monthTo];
    if (opType) { params.push(opType); clauses.push(`c.operation_type = $${params.length}`); }
    if (brand !== null) { params.push(brand); clauses.push(`c.brand = $${params.length}`); }
    if (isManager) clauses.push(`c.operation_type != '본점'`);
    if (customerIds.length > 0) {
      const placeholders = customerIds.map((_, i) => `$${params.length + i + 1}`).join(',');
      clauses.push(`co.customer_id IN (${placeholders})`);
      params.push(...customerIds);
    }
    return { where: clauses.join(' AND '), params };
  };

  // 1) 월별 거래
  const w1 = buildTxnWhere();
  const monthlyTxn = await query(`
    SELECT TO_CHAR(t.date, 'YYYY-MM') as month,
      COUNT(t.id)::int as transaction_count,
      COALESCE(SUM(t.supply_total), 0)::numeric as supply_total,
      COALESCE(SUM(t.vat_total), 0)::numeric as vat_total,
      COALESCE(SUM(t.grand_total), 0)::numeric as grand_total
    FROM transactions t JOIN customers c ON t.customer_id = c.id
    WHERE ${w1.where}
    GROUP BY TO_CHAR(t.date, 'YYYY-MM')
  `, w1.params);

  // 2) 월별 손익 (transaction_items)
  const w2 = buildTxnWhere();
  const monthlyItem = await query(`
    SELECT TO_CHAR(t.date, 'YYYY-MM') as month,
      COALESCE(SUM(ti.margin), 0)::numeric as total_margin,
      COALESCE(SUM(ti.net_profit), 0)::numeric as total_net_profit
    FROM transaction_items ti
    JOIN transactions t ON ti.transaction_id = t.id
    JOIN customers c ON t.customer_id = c.id
    WHERE ${w2.where}
    GROUP BY TO_CHAR(t.date, 'YYYY-MM')
  `, w2.params);

  // 3) 월별 비용
  const w3 = buildCostWhere();
  const monthlyCost = await query(`
    SELECT co.settlement_month as month, COALESCE(SUM(co.amount), 0)::numeric as total_cost
    FROM costs co JOIN customers c ON co.customer_id = c.id
    WHERE ${w3.where}
    GROUP BY co.settlement_month
  `, w3.params);

  const monthlyItemMap: Record<string, { total_margin: number; total_net_profit: number }> = {};
  for (const r of monthlyItem) monthlyItemMap[r.month] = { total_margin: Number(r.total_margin), total_net_profit: Number(r.total_net_profit) };
  const monthlyCostMap: Record<string, number> = {};
  for (const r of monthlyCost) monthlyCostMap[r.month] = Number(r.total_cost);

  // 기간 내 모든 월 생성
  const allMonths: string[] = [];
  const [fy, fm] = monthFrom.split('-').map(Number);
  const [ty, tm] = monthTo.split('-').map(Number);
  let cy = fy, cm = fm;
  while (cy < ty || (cy === ty && cm <= tm)) {
    allMonths.push(`${cy}-${String(cm).padStart(2, '0')}`);
    cm++;
    if (cm > 12) { cm = 1; cy++; }
  }

  const monthlyMap: Record<string, {
    month: string; transaction_count: number; supply_total: number; vat_total: number;
    grand_total: number; total_margin: number; total_net_profit: number;
    total_cost: number; final_profit: number;
  }> = {};
  for (const m of allMonths) {
    monthlyMap[m] = {
      month: m, transaction_count: 0, supply_total: 0, vat_total: 0, grand_total: 0,
      total_margin: 0, total_net_profit: 0, total_cost: 0, final_profit: 0,
    };
  }
  for (const row of monthlyTxn) {
    const item = monthlyItemMap[row.month] || { total_margin: 0, total_net_profit: 0 };
    const cost = monthlyCostMap[row.month] || 0;
    const grand_total = Number(row.grand_total);
    if (!monthlyMap[row.month]) continue;
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
  for (const m of allMonths) {
    if (monthlyMap[m].total_cost === 0 && monthlyCostMap[m]) {
      monthlyMap[m].total_cost = monthlyCostMap[m];
      monthlyMap[m].final_profit = monthlyMap[m].grand_total - monthlyCostMap[m];
    }
  }

  // 4) 거래처별 집계 (선택 필터 적용)
  const w4 = buildTxnWhere();
  const customerTxn = await query(`
    SELECT t.customer_id, c.company_name as customer_name, c.brand as customer_brand,
      c.operation_type, c.royalty_rate,
      COUNT(t.id)::int as transaction_count,
      COALESCE(SUM(t.supply_total), 0)::numeric as supply_total,
      COALESCE(SUM(t.grand_total), 0)::numeric as grand_total,
      COUNT(CASE WHEN t.payment_status = 'unpaid' THEN 1 END)::int as unpaid_count,
      COALESCE(SUM(CASE WHEN t.payment_status = 'unpaid' THEN t.grand_total ELSE 0 END), 0)::numeric as unpaid_total
    FROM transactions t JOIN customers c ON t.customer_id = c.id
    WHERE ${w4.where}
    GROUP BY t.customer_id, c.company_name, c.brand, c.operation_type, c.royalty_rate
  `, w4.params);

  const w5 = buildTxnWhere();
  const customerVat = await query(`
    SELECT t.customer_id,
      COALESCE(SUM(ti.vat_amount), 0)::numeric as sales_vat,
      COALESCE(SUM(CASE WHEN ti.vat_apply THEN FLOOR(ti.material_cost * 0.1) * ti.qty ELSE 0 END), 0)::numeric as purchase_vat,
      COALESCE(SUM(ti.margin), 0)::numeric as total_margin,
      COALESCE(SUM(ti.net_profit), 0)::numeric as total_net_profit
    FROM transaction_items ti JOIN transactions t ON ti.transaction_id = t.id
    JOIN customers c ON t.customer_id = c.id
    WHERE ${w5.where}
    GROUP BY t.customer_id
  `, w5.params);

  const w6 = buildCostWhere();
  const customerCost = await query(`
    SELECT co.customer_id, COALESCE(SUM(co.amount), 0)::numeric as total_cost
    FROM costs co JOIN customers c ON co.customer_id = c.id
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
    return {
      customer_id: r.customer_id,
      customer_name: r.customer_name,
      brand: r.customer_brand || '',
      operation_type: r.operation_type || '가맹점',
      royalty_rate: Number(r.royalty_rate) || 0,
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
      cost_ratio: grand_total > 0 ? cost / grand_total : 0,
      final_profit: grand_total - cost,
      royalty_paid: 0,        // 가맹점이 본점에 낸 로열티 비용 (자기 비용에 가산됨)
      royalty_received: 0,    // 본점이 가맹점으로부터 받은 로열티 매출 (자기 매출에 가산됨)
    };
  }).sort((a, b) => b.grand_total - a.grand_total);

  // 비용만 있는 거래처도 포함
  for (const [cid, cost] of Object.entries(customerCostMap)) {
    if (!customers.find(c => c.customer_id === Number(cid))) {
      const custRow = await query('SELECT company_name, brand, operation_type, royalty_rate FROM customers WHERE id = $1', [Number(cid)]);
      if (custRow.length > 0) {
        customers.push({
          customer_id: Number(cid), customer_name: custRow[0].company_name,
          brand: custRow[0].brand || '',
          operation_type: custRow[0].operation_type || '가맹점',
          royalty_rate: Number(custRow[0].royalty_rate) || 0,
          transaction_count: 0, supply_total: 0, grand_total: 0, unpaid_count: 0, unpaid_total: 0,
          sales_vat: 0, purchase_vat: 0, net_vat: 0, total_margin: 0, total_net_profit: 0,
          total_cost: cost, cost_ratio: 0, final_profit: -cost,
          royalty_paid: 0, royalty_received: 0,
        });
      }
    }
  }

  // 로열티 계산: 가맹점이 본점에 지불하는 로열티(부가세 별도)
  // - 가맹점.total_cost += royalty_amount × 1.1
  // - 가맹점.royalty_paid = royalty_amount × 1.1
  // - 같은 브랜드 본점.grand_total += royalty_amount (본점이 받는 매출)
  // - 같은 브랜드 본점.sales_vat += royalty_amount × 0.1
  // - 같은 브랜드 본점.royalty_received = royalty_amount
  // 본점은 customers 배열에 없을 수도 있어 (필터에 의해) - 그래도 같은 브랜드의 본점을 찾아 처리
  // 단, 매니저는 본점 통계 비공개라 본점 추가 X. 가맹점 비용은 그대로.
  const allBrandMasters = await query(
    `SELECT id, brand FROM customers WHERE operation_type = '본점'`
  );
  const brandMasterMap: Record<string, number> = {};
  for (const m of allBrandMasters) brandMasterMap[m.brand || ''] = m.id;

  for (const c of customers) {
    if (c.operation_type === '가맹점' && c.royalty_rate > 0 && c.grand_total > 0) {
      const royaltyAmount = Math.floor(c.grand_total * c.royalty_rate / 100);
      const royaltyVat = Math.floor(royaltyAmount * 0.1);
      const royaltyTotalWithVat = royaltyAmount + royaltyVat;

      // 가맹점 비용에 가산 (부가세 포함)
      c.total_cost += royaltyTotalWithVat;
      c.royalty_paid = royaltyTotalWithVat;
      c.final_profit = c.grand_total - c.total_cost;
      c.cost_ratio = c.grand_total > 0 ? c.total_cost / c.grand_total : 0;

      // 본점 매출에 가산 (같은 브랜드)
      const masterId = brandMasterMap[c.brand || ''];
      if (masterId && !isManager) {
        let master = customers.find(x => x.customer_id === masterId);
        if (!master) {
          // 본점이 현재 결과에 없으면 추가
          const m = await query('SELECT id, company_name, brand, operation_type, royalty_rate FROM customers WHERE id = $1', [masterId]);
          if (m.length > 0) {
            master = {
              customer_id: m[0].id,
              customer_name: m[0].company_name,
              brand: m[0].brand || '',
              operation_type: m[0].operation_type,
              royalty_rate: Number(m[0].royalty_rate) || 0,
              transaction_count: 0, supply_total: 0, grand_total: 0, unpaid_count: 0, unpaid_total: 0,
              sales_vat: 0, purchase_vat: 0, net_vat: 0, total_margin: 0, total_net_profit: 0,
              total_cost: 0, cost_ratio: 0, final_profit: 0,
              royalty_paid: 0, royalty_received: 0,
            };
            customers.push(master);
          }
        }
        if (master) {
          master.grand_total += royaltyAmount;
          master.sales_vat += royaltyVat;
          master.net_vat = master.sales_vat - master.purchase_vat;
          master.royalty_received += royaltyAmount;
          master.final_profit = master.grand_total - master.total_cost;
          master.cost_ratio = master.grand_total > 0 ? master.total_cost / master.grand_total : 0;
        }
      }
    }
  }
  customers.sort((a, b) => b.grand_total - a.grand_total);

  // 5) 벤치마크 (필터와 무관하게 기간 내 전체 거래처 평균)
  // 운영구분별 평균을 항상 제공 (operation_type 필터 무시)
  const benchmarkTxn = await query(`
    SELECT t.customer_id, c.company_name, c.operation_type,
      COALESCE(SUM(t.grand_total), 0)::numeric as grand_total,
      COALESCE(SUM(t.supply_total), 0)::numeric as supply_total,
      COALESCE(SUM(CASE WHEN t.payment_status='unpaid' THEN t.grand_total ELSE 0 END), 0)::numeric as unpaid_total
    FROM transactions t JOIN customers c ON t.customer_id = c.id
    WHERE t.date BETWEEN $1 AND $2
    GROUP BY t.customer_id, c.company_name, c.operation_type
  `, [dateFrom, dateTo]);

  const benchmarkVat = await query(`
    SELECT t.customer_id,
      COALESCE(SUM(ti.vat_amount), 0)::numeric as sales_vat,
      COALESCE(SUM(CASE WHEN ti.vat_apply THEN FLOOR(ti.material_cost * 0.1) * ti.qty ELSE 0 END), 0)::numeric as purchase_vat,
      COALESCE(SUM(ti.net_profit), 0)::numeric as total_net_profit
    FROM transaction_items ti JOIN transactions t ON ti.transaction_id = t.id
    WHERE t.date BETWEEN $1 AND $2
    GROUP BY t.customer_id
  `, [dateFrom, dateTo]);

  const benchmarkCost = await query(`
    SELECT co.customer_id, COALESCE(SUM(co.amount), 0)::numeric as total_cost
    FROM costs co
    WHERE co.settlement_month BETWEEN $1 AND $2
    GROUP BY co.customer_id
  `, [monthFrom, monthTo]);

  const bVatMap: Record<number, { sales_vat: number; purchase_vat: number; total_net_profit: number }> = {};
  for (const r of benchmarkVat) bVatMap[r.customer_id] = {
    sales_vat: Number(r.sales_vat), purchase_vat: Number(r.purchase_vat),
    total_net_profit: Number(r.total_net_profit),
  };
  const bCostMap: Record<number, number> = {};
  for (const r of benchmarkCost) bCostMap[r.customer_id] = Number(r.total_cost);

  // 모든 거래처 (거래만 있거나 비용만 있는 경우 포함)
  const allCustIds = new Set<number>([
    ...benchmarkTxn.map(r => r.customer_id),
    ...Object.keys(bCostMap).map(Number),
  ]);

  const benchmarkRows: Array<{
    customer_id: number; operation_type: string; grand_total: number; total_cost: number;
    cost_ratio: number; final_profit: number; sales_vat: number; purchase_vat: number; net_vat: number;
    unpaid_total: number;
  }> = [];

  for (const cid of allCustIds) {
    const txnRow = benchmarkTxn.find(r => r.customer_id === cid);
    let operation_type = '가맹점';
    let grand_total = 0, supply_total = 0, unpaid_total = 0;
    if (txnRow) {
      operation_type = txnRow.operation_type || '가맹점';
      grand_total = Number(txnRow.grand_total);
      supply_total = Number(txnRow.supply_total);
      unpaid_total = Number(txnRow.unpaid_total);
    } else {
      const cust = await query('SELECT operation_type FROM customers WHERE id = $1', [cid]);
      if (cust.length > 0) operation_type = cust[0].operation_type || '가맹점';
    }
    const vat = bVatMap[cid] || { sales_vat: 0, purchase_vat: 0, total_net_profit: 0 };
    const cost = bCostMap[cid] || 0;
    benchmarkRows.push({
      customer_id: cid, operation_type, grand_total, total_cost: cost,
      cost_ratio: grand_total > 0 ? cost / grand_total : 0,
      final_profit: grand_total - cost,
      sales_vat: vat.sales_vat, purchase_vat: vat.purchase_vat,
      net_vat: vat.sales_vat - vat.purchase_vat,
      unpaid_total,
    });
  }

  const avgOf = (rows: typeof benchmarkRows, key: keyof typeof benchmarkRows[number]) => {
    if (rows.length === 0) return 0;
    const sum = rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
    return sum / rows.length;
  };

  const buildBenchmark = (rows: typeof benchmarkRows) => ({
    count: rows.length,
    grand_total: avgOf(rows, 'grand_total'),
    total_cost: avgOf(rows, 'total_cost'),
    cost_ratio: avgOf(rows, 'cost_ratio'),
    final_profit: avgOf(rows, 'final_profit'),
    sales_vat: avgOf(rows, 'sales_vat'),
    purchase_vat: avgOf(rows, 'purchase_vat'),
    net_vat: avgOf(rows, 'net_vat'),
    unpaid_total: avgOf(rows, 'unpaid_total'),
  });

  const benchmarks = {
    본점: buildBenchmark(benchmarkRows.filter(r => r.operation_type === '본점')),
    직영점: buildBenchmark(benchmarkRows.filter(r => r.operation_type === '직영점')),
    가맹점: buildBenchmark(benchmarkRows.filter(r => r.operation_type === '가맹점')),
    전체: buildBenchmark(benchmarkRows),
  };

  // 5-A) 선택 거래처별 월별 (customer_ids가 있을 때만)
  const monthlyPerCustomer: Record<number, Record<string, { grand_total: number; total_cost: number; final_profit: number }>> = {};
  if (customerIds.length > 0) {
    const placeholders = customerIds.map((_, i) => `$${i + 3}`).join(',');
    const pcTxn = await query(`
      SELECT t.customer_id, TO_CHAR(t.date, 'YYYY-MM') as month,
        COALESCE(SUM(t.grand_total), 0)::numeric as grand_total
      FROM transactions t
      WHERE t.date BETWEEN $1 AND $2 AND t.customer_id IN (${placeholders})
      GROUP BY t.customer_id, TO_CHAR(t.date, 'YYYY-MM')
    `, [dateFrom, dateTo, ...customerIds]);

    const pcCostPlaceholders = customerIds.map((_, i) => `$${i + 3}`).join(',');
    const pcCost = await query(`
      SELECT co.customer_id, co.settlement_month as month,
        COALESCE(SUM(co.amount), 0)::numeric as total_cost
      FROM costs co
      WHERE co.settlement_month BETWEEN $1 AND $2 AND co.customer_id IN (${pcCostPlaceholders})
      GROUP BY co.customer_id, co.settlement_month
    `, [monthFrom, monthTo, ...customerIds]);

    for (const id of customerIds) {
      monthlyPerCustomer[id] = {};
      for (const m of allMonths) monthlyPerCustomer[id][m] = { grand_total: 0, total_cost: 0, final_profit: 0 };
    }
    for (const r of pcTxn) {
      const cid = r.customer_id;
      if (monthlyPerCustomer[cid] && monthlyPerCustomer[cid][r.month]) {
        monthlyPerCustomer[cid][r.month].grand_total = Number(r.grand_total);
      }
    }
    for (const r of pcCost) {
      const cid = r.customer_id;
      if (monthlyPerCustomer[cid] && monthlyPerCustomer[cid][r.month]) {
        monthlyPerCustomer[cid][r.month].total_cost = Number(r.total_cost);
      }
    }
    for (const id of customerIds) {
      for (const m of allMonths) {
        const v = monthlyPerCustomer[id][m];
        v.final_profit = v.grand_total - v.total_cost;
      }
    }
  }

  // 5-B) 운영구분별 월 평균 (기간 전체 데이터, 운영구분 필터 무시)
  const monthlyBenchTxn = await query(`
    SELECT TO_CHAR(t.date, 'YYYY-MM') as month, c.operation_type,
      COUNT(DISTINCT t.customer_id)::int as cust_count,
      COALESCE(SUM(t.grand_total), 0)::numeric as total_grand
    FROM transactions t JOIN customers c ON t.customer_id = c.id
    WHERE t.date BETWEEN $1 AND $2
    GROUP BY TO_CHAR(t.date, 'YYYY-MM'), c.operation_type
  `, [dateFrom, dateTo]);

  const monthlyBenchCost = await query(`
    SELECT co.settlement_month as month, c.operation_type,
      COUNT(DISTINCT co.customer_id)::int as cust_count,
      COALESCE(SUM(co.amount), 0)::numeric as total_cost
    FROM costs co JOIN customers c ON co.customer_id = c.id
    WHERE co.settlement_month BETWEEN $1 AND $2
    GROUP BY co.settlement_month, c.operation_type
  `, [monthFrom, monthTo]);

  // 운영구분별 월별 평균 매출/비용/순익
  type OpMonthly = Record<string, { grand_total: number; total_cost: number; final_profit: number }>;
  const monthlyBench: Record<string, OpMonthly> = { 본점: {}, 직영점: {}, 가맹점: {}, 전체: {} };
  for (const op of ['본점','직영점','가맹점','전체']) {
    for (const m of allMonths) monthlyBench[op][m] = { grand_total: 0, total_cost: 0, final_profit: 0 };
  }

  // 운영구분별 매출 합계와 customer count
  const benchTxnMap: Record<string, Record<string, { total: number; cnt: number }>> = { 본점: {}, 직영점: {}, 가맹점: {} };
  for (const r of monthlyBenchTxn) {
    const op = r.operation_type || '가맹점';
    if (!benchTxnMap[op]) continue;
    benchTxnMap[op][r.month] = { total: Number(r.total_grand), cnt: Number(r.cust_count) };
  }
  const benchCostMap: Record<string, Record<string, { total: number; cnt: number }>> = { 본점: {}, 직영점: {}, 가맹점: {} };
  for (const r of monthlyBenchCost) {
    const op = r.operation_type || '가맹점';
    if (!benchCostMap[op]) continue;
    benchCostMap[op][r.month] = { total: Number(r.total_cost), cnt: Number(r.cust_count) };
  }

  for (const op of ['본점','직영점','가맹점'] as const) {
    for (const m of allMonths) {
      const t = benchTxnMap[op][m] || { total: 0, cnt: 0 };
      const c = benchCostMap[op][m] || { total: 0, cnt: 0 };
      const avgGrand = t.cnt > 0 ? t.total / t.cnt : 0;
      const avgCost = c.cnt > 0 ? c.total / c.cnt : 0;
      monthlyBench[op][m] = {
        grand_total: avgGrand, total_cost: avgCost,
        final_profit: avgGrand - avgCost,
      };
    }
  }
  // 전체 평균: 모든 운영구분 통합
  for (const m of allMonths) {
    const totals = (['본점','직영점','가맹점'] as const).reduce((acc, op) => {
      const t = benchTxnMap[op][m] || { total: 0, cnt: 0 };
      const c = benchCostMap[op][m] || { total: 0, cnt: 0 };
      acc.tTotal += t.total; acc.tCnt += t.cnt;
      acc.cTotal += c.total; acc.cCnt += c.cnt;
      return acc;
    }, { tTotal: 0, tCnt: 0, cTotal: 0, cCnt: 0 });
    const avgGrand = totals.tCnt > 0 ? totals.tTotal / totals.tCnt : 0;
    const avgCost = totals.cCnt > 0 ? totals.cTotal / totals.cCnt : 0;
    monthlyBench['전체'][m] = { grand_total: avgGrand, total_cost: avgCost, final_profit: avgGrand - avgCost };
  }

  // 6) 품목별
  const w7 = buildTxnWhere();
  const productData = await query(`
    SELECT ti.product_id, ti.product_name, ti.category,
      COALESCE(SUM(ti.qty), 0)::numeric as total_qty,
      COALESCE(SUM(ti.amount), 0)::numeric as total_amount,
      COALESCE(SUM(ti.vat_amount), 0)::numeric as sales_vat,
      COALESCE(SUM(CASE WHEN ti.vat_apply THEN FLOOR(ti.material_cost * 0.1) * ti.qty ELSE 0 END), 0)::numeric as purchase_vat,
      COALESCE(SUM(ti.net_profit), 0)::numeric as total_net_profit
    FROM transaction_items ti JOIN transactions t ON ti.transaction_id = t.id
    JOIN customers c ON t.customer_id = c.id
    WHERE ${w7.where}
    GROUP BY ti.product_id, ti.product_name, ti.category
    ORDER BY total_amount DESC
  `, w7.params);

  // 7) 비용 카테고리
  const w8 = buildCostWhere();
  const costByCategory = await query(`
    SELECT co.category, COALESCE(SUM(co.amount), 0)::numeric as total
    FROM costs co JOIN customers c ON co.customer_id = c.id
    WHERE ${w8.where}
    GROUP BY co.category
    ORDER BY total DESC
  `, w8.params);

  // 매니저는 마진 정보 비공개
  if (isManager) {
    for (const c of customers) {
      c.total_margin = 0;
      c.total_net_profit = 0;
    }
  }

  // 합계
  const totalSalesVat = customers.reduce((s, r) => s + r.sales_vat, 0);
  const totalPurchaseVat = customers.reduce((s, r) => s + r.purchase_vat, 0);
  const totalCost = customers.reduce((s, r) => s + r.total_cost, 0);
  const totalGrandTotal = customers.reduce((s, r) => s + r.grand_total, 0);

  return NextResponse.json({
    period: { date_from: dateFrom, date_to: dateTo },
    monthly: Object.values(monthlyMap),
    monthly_per_customer: monthlyPerCustomer,  // { customer_id: { month: {grand_total, total_cost, final_profit} } }
    monthly_benchmarks: monthlyBench,           // { 본점|직영점|가맹점|전체: { month: {grand_total, total_cost, final_profit} } }
    customers,
    benchmarks,
    products: productData.map((r) => ({
      product_id: r.product_id, product_name: r.product_name, category: r.category,
      total_qty: Number(r.total_qty), total_amount: Number(r.total_amount),
      sales_vat: Number(r.sales_vat), purchase_vat: Number(r.purchase_vat),
      net_vat: Number(r.sales_vat) - Number(r.purchase_vat),
      total_net_profit: Number(r.total_net_profit),
    })),
    vat_summary: { sales_vat: totalSalesVat, purchase_vat: totalPurchaseVat, net_vat: totalSalesVat - totalPurchaseVat },
    cost_summary: {
      total_cost: totalCost,
      by_category: costByCategory.map(r => ({ category: r.category, total: Number(r.total) })),
    },
    grand_summary: { grand_total: totalGrandTotal, total_cost: totalCost, final_profit: totalGrandTotal - totalCost },
  });
}
