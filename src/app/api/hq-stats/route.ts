import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/hq-stats?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
// 통계(본사) 페이지용
//
// Section 1: 본사 자체 PL
//   매출: SUM(transactions.grand_total) [본사가 거래처에 판 발주 매출] + SUM(revenues.amount where customer_id IS NULL)
//   비용: SUM(transaction_items.material_cost * qty) [발주재료원가] + SUM(costs.amount where customer_id IS NULL)
//   손익: 매출 - 비용
//
// Section 2: 본점들 PL
//   매출: SUM(revenues.amount where customer_id IN 본점 customers)
//   비용: SUM(transactions.grand_total where customer_id IN 본점) [본점이 본사에서 매입] + SUM(costs.amount where customer_id IN 본점)
//   손익: 매출 - 비용
//
// Section 3: 합계 = 1 + 2

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const isManager = session.role === 'manager';

  const sp = request.nextUrl.searchParams;
  let dateFrom = sp.get('date_from');
  let dateTo = sp.get('date_to');
  if (!dateFrom || !dateTo) {
    const year = new Date().getFullYear();
    dateFrom = `${year}-01-01`;
    dateTo = `${year}-12-31`;
  }
  const monthFrom = dateFrom.substring(0, 7);
  const monthTo = dateTo.substring(0, 7);

  // ===== Section 1: 본사 자체 =====
  // 1-1) 발주매출 = 모든 transactions.grand_total
  const txnSum = await query(
    `SELECT COALESCE(SUM(grand_total), 0)::numeric as total FROM transactions WHERE date BETWEEN $1 AND $2`,
    [dateFrom, dateTo]
  );
  const hqOrderRevenue = Number(txnSum[0]?.total || 0);

  // 1-2) 본사 매출 (revenues customer_id IS NULL: 로열티 자동 + 본사 수동)
  const hqRevSum = await query(
    `SELECT COALESCE(SUM(amount), 0)::numeric as total,
            COALESCE(SUM(CASE WHEN source='royalty_auto' THEN amount ELSE 0 END), 0)::numeric as royalty,
            COALESCE(SUM(CASE WHEN source='manual' THEN amount ELSE 0 END), 0)::numeric as manual
     FROM revenues WHERE customer_id IS NULL AND settlement_month BETWEEN $1 AND $2`,
    [monthFrom, monthTo]
  );
  const hqOtherRevenue = Number(hqRevSum[0]?.total || 0);
  const hqRoyaltyRevenue = Number(hqRevSum[0]?.royalty || 0);
  const hqManualRevenue = Number(hqRevSum[0]?.manual || 0);

  // 1-3) 발주재료원가 = SUM(transaction_items.material_cost * qty)
  const txnItemSum = await query(
    `SELECT COALESCE(SUM(ti.material_cost * ti.qty), 0)::numeric as total
     FROM transaction_items ti
     JOIN transactions t ON ti.transaction_id = t.id
     WHERE t.date BETWEEN $1 AND $2`,
    [dateFrom, dateTo]
  );
  const hqMaterialCost = Number(txnItemSum[0]?.total || 0);

  // 1-4) 본사 비용 (costs customer_id IS NULL)
  const hqCostSum = await query(
    `SELECT COALESCE(SUM(amount), 0)::numeric as total
     FROM costs WHERE customer_id IS NULL AND settlement_month BETWEEN $1 AND $2`,
    [monthFrom, monthTo]
  );
  const hqOtherCost = Number(hqCostSum[0]?.total || 0);

  const hqRevenue = hqOrderRevenue + hqOtherRevenue;
  const hqCost = hqMaterialCost + hqOtherCost;
  const hqProfit = hqRevenue - hqCost;

  // ===== Section 2: 본점들 =====
  // 본점 customers
  const hqCustomerRows = await query(`SELECT id, company_name, brand FROM customers WHERE operation_type = '본점'`);
  const hqCustomerIds = hqCustomerRows.map(r => r.id);

  let mainStoreRevenue = 0, mainStoreCost = 0, mainStorePurchase = 0;
  const mainStores: Array<{ id: number; name: string; brand: string; revenue: number; cost: number; profit: number; cost_purchase: number; cost_other: number }> = [];

  if (hqCustomerIds.length > 0) {
    const idsParams = hqCustomerIds.map((_, i) => `$${i + 3}`).join(',');

    // 본점들 매출
    const mainRev = await query(
      `SELECT customer_id, COALESCE(SUM(amount), 0)::numeric as total
       FROM revenues WHERE customer_id IN (${idsParams}) AND settlement_month BETWEEN $1 AND $2
       GROUP BY customer_id`,
      [monthFrom, monthTo, ...hqCustomerIds]
    );
    // 본점들 매입(=발주)
    const mainPurchase = await query(
      `SELECT customer_id, COALESCE(SUM(grand_total), 0)::numeric as total
       FROM transactions WHERE customer_id IN (${idsParams}) AND date BETWEEN $1 AND $2
       GROUP BY customer_id`,
      [dateFrom, dateTo, ...hqCustomerIds]
    );
    // 본점들 기타비용
    const mainOtherCost = await query(
      `SELECT customer_id, COALESCE(SUM(amount), 0)::numeric as total
       FROM costs WHERE customer_id IN (${idsParams}) AND settlement_month BETWEEN $1 AND $2
       GROUP BY customer_id`,
      [monthFrom, monthTo, ...hqCustomerIds]
    );

    const revMap: Record<number, number> = {};
    for (const r of mainRev) revMap[r.customer_id] = Number(r.total);
    const purMap: Record<number, number> = {};
    for (const r of mainPurchase) purMap[r.customer_id] = Number(r.total);
    const costMap: Record<number, number> = {};
    for (const r of mainOtherCost) costMap[r.customer_id] = Number(r.total);

    for (const c of hqCustomerRows) {
      const rev = revMap[c.id] || 0;
      const pur = purMap[c.id] || 0;
      const oth = costMap[c.id] || 0;
      const cost = pur + oth;
      mainStoreRevenue += rev;
      mainStoreCost += cost;
      mainStorePurchase += pur;
      mainStores.push({
        id: c.id, name: c.company_name, brand: c.brand || '',
        revenue: rev, cost, profit: rev - cost,
        cost_purchase: pur, cost_other: oth,
      });
    }
  }
  const mainStoreProfit = mainStoreRevenue - mainStoreCost;

  // ===== Section 3: 합계 =====
  const totalRevenue = hqRevenue + mainStoreRevenue;
  const totalCost = hqCost + mainStoreCost;
  const totalProfit = hqProfit + mainStoreProfit;

  // ===== 월별 (본사 + 본점 합산, 차트용) =====
  const allMonths: string[] = [];
  const [fy, fm] = monthFrom.split('-').map(Number);
  const [ty, tm] = monthTo.split('-').map(Number);
  let cy = fy, cm = fm;
  while (cy < ty || (cy === ty && cm <= tm)) {
    allMonths.push(`${cy}-${String(cm).padStart(2, '0')}`);
    cm++; if (cm > 12) { cm = 1; cy++; }
  }

  // 월별 본사 매출(발주) + 본점 매출(revenues for 본점)
  const monthlyTxn = await query(
    `SELECT TO_CHAR(date, 'YYYY-MM') as month, COALESCE(SUM(grand_total), 0)::numeric as total
     FROM transactions WHERE date BETWEEN $1 AND $2
     GROUP BY TO_CHAR(date, 'YYYY-MM')`,
    [dateFrom, dateTo]
  );
  const monthlyHqRev = await query(
    `SELECT settlement_month as month, COALESCE(SUM(amount), 0)::numeric as total
     FROM revenues WHERE customer_id IS NULL AND settlement_month BETWEEN $1 AND $2
     GROUP BY settlement_month`,
    [monthFrom, monthTo]
  );
  const monthlyMainRev = hqCustomerIds.length > 0 ? await query(
    `SELECT settlement_month as month, COALESCE(SUM(amount), 0)::numeric as total
     FROM revenues WHERE customer_id = ANY($3::int[]) AND settlement_month BETWEEN $1 AND $2
     GROUP BY settlement_month`,
    [monthFrom, monthTo, hqCustomerIds]
  ) : [];
  const monthlyMaterial = await query(
    `SELECT TO_CHAR(t.date, 'YYYY-MM') as month, COALESCE(SUM(ti.material_cost * ti.qty), 0)::numeric as total
     FROM transaction_items ti JOIN transactions t ON ti.transaction_id = t.id
     WHERE t.date BETWEEN $1 AND $2 GROUP BY TO_CHAR(t.date, 'YYYY-MM')`,
    [dateFrom, dateTo]
  );
  const monthlyHqCost = await query(
    `SELECT settlement_month as month, COALESCE(SUM(amount), 0)::numeric as total
     FROM costs WHERE customer_id IS NULL AND settlement_month BETWEEN $1 AND $2
     GROUP BY settlement_month`,
    [monthFrom, monthTo]
  );
  const monthlyMainCost = hqCustomerIds.length > 0 ? await query(
    `SELECT settlement_month as month, COALESCE(SUM(amount), 0)::numeric as total
     FROM costs WHERE customer_id = ANY($3::int[]) AND settlement_month BETWEEN $1 AND $2
     GROUP BY settlement_month`,
    [monthFrom, monthTo, hqCustomerIds]
  ) : [];
  const monthlyMainPurchase = hqCustomerIds.length > 0 ? await query(
    `SELECT TO_CHAR(date, 'YYYY-MM') as month, COALESCE(SUM(grand_total), 0)::numeric as total
     FROM transactions WHERE customer_id = ANY($3::int[]) AND date BETWEEN $1 AND $2
     GROUP BY TO_CHAR(date, 'YYYY-MM')`,
    [dateFrom, dateTo, hqCustomerIds]
  ) : [];

  const toMap = (rows: { month: string; total: string | number }[]) => {
    const m: Record<string, number> = {};
    for (const r of rows) m[r.month] = Number(r.total);
    return m;
  };
  const mTxn = toMap(monthlyTxn);
  const mHqRev = toMap(monthlyHqRev);
  const mMainRev = toMap(monthlyMainRev);
  const mMat = toMap(monthlyMaterial);
  const mHqCost = toMap(monthlyHqCost);
  const mMainCost = toMap(monthlyMainCost);
  const mMainPur = toMap(monthlyMainPurchase);

  const monthly = allMonths.map(m => {
    const hqRev = (mTxn[m] || 0) + (mHqRev[m] || 0);
    const hqC = (mMat[m] || 0) + (mHqCost[m] || 0);
    const mainRev = mMainRev[m] || 0;
    const mainC = (mMainPur[m] || 0) + (mMainCost[m] || 0);
    return {
      month: m,
      hq_revenue: hqRev, hq_cost: hqC, hq_profit: hqRev - hqC,
      main_revenue: mainRev, main_cost: mainC, main_profit: mainRev - mainC,
      total_revenue: hqRev + mainRev, total_cost: hqC + mainC, total_profit: (hqRev + mainRev) - (hqC + mainC),
    };
  });

  return NextResponse.json({
    period: { date_from: dateFrom, date_to: dateTo },
    hq: {
      revenue: hqRevenue,
      cost: hqCost,
      profit: hqProfit,
      breakdown: {
        order_revenue: hqOrderRevenue,        // 발주 매출
        royalty_revenue: hqRoyaltyRevenue,    // 로열티 자동
        manual_revenue: hqManualRevenue,      // 본사 수동 매출
        material_cost: hqMaterialCost,         // 발주재료원가
        other_cost: hqOtherCost,               // 본사 운영비 (인건비/임차료 등)
      },
    },
    main_stores: {
      revenue: mainStoreRevenue,
      cost: mainStoreCost,
      profit: mainStoreProfit,
      cost_purchase: mainStorePurchase,
      cost_other: mainStoreCost - mainStorePurchase,
      stores: mainStores,
    },
    total: {
      revenue: totalRevenue,
      cost: totalCost,
      profit: totalProfit,
    },
    monthly,
    is_manager: isManager,
  });
}
