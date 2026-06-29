import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { buildCostGroups } from '@/lib/costGroups';

// GET /api/hq-stats?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
// 통계(본사) 페이지용
//
// ※ 2026-06 정책 변경: 발주(transactions)는 통계에 자동 반영하지 않는다.
//    매출 = 매출 탭(revenues) 수기 입력, 비용 = 비용 탭(costs) 수기 입력만으로 집계.
//
// Section 1: 본사   매출 = revenues(customer_id IS NULL),  비용 = costs(customer_id IS NULL)
// Section 2: 본점   매출 = revenues(본점),                  비용 = costs(본점)
// Section 3: 직영점+가맹점 동일 패턴
// Section 4: 합계 = 1 + 2 + 3
// 비용은 cost_categories.parent_group 기준으로 '재료원가' 등 상위 그룹으로 묶어 매출 대비 비율 표시.

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

  // 비용 카테고리 메타 (그룹/정렬)
  const catRows = await query('SELECT name, parent_group, order_idx FROM cost_categories ORDER BY order_idx, id');
  const cats = catRows.map(r => ({ name: r.name, parent_group: r.parent_group ?? null, order_idx: Number(r.order_idx) }));

  // 카테고리별 비용 합계 맵 빌더
  const costCatMap = async (where: string, params: unknown[]): Promise<Record<string, number>> => {
    const rows = await query(
      `SELECT category, COALESCE(SUM(amount), 0)::numeric as total
       FROM costs WHERE ${where} AND settlement_month BETWEEN $1 AND $2
       GROUP BY category`,
      [monthFrom, monthTo, ...params]
    );
    const m: Record<string, number> = {};
    for (const r of rows) m[r.category] = Number(r.total);
    return m;
  };

  // ===== Section 1: 본사 자체 =====
  const hqRevSum = await query(
    `SELECT COALESCE(SUM(amount), 0)::numeric as total,
            COALESCE(SUM(CASE WHEN source='royalty_auto' THEN amount ELSE 0 END), 0)::numeric as royalty,
            COALESCE(SUM(CASE WHEN source='manual' THEN amount ELSE 0 END), 0)::numeric as manual
     FROM revenues WHERE customer_id IS NULL AND settlement_month BETWEEN $1 AND $2`,
    [monthFrom, monthTo]
  );
  const hqRevenue = Number(hqRevSum[0]?.total || 0);
  const hqRoyaltyRevenue = Number(hqRevSum[0]?.royalty || 0);
  const hqManualRevenue = Number(hqRevSum[0]?.manual || 0);

  const hqCostSum = await query(
    `SELECT COALESCE(SUM(amount), 0)::numeric as total
     FROM costs WHERE customer_id IS NULL AND settlement_month BETWEEN $1 AND $2`,
    [monthFrom, monthTo]
  );
  const hqCost = Number(hqCostSum[0]?.total || 0);
  const hqProfit = hqRevenue - hqCost;

  const hqCostMap = await costCatMap('customer_id IS NULL', []);
  const hqCostGroups = buildCostGroups(hqCostMap, cats, hqRevenue);

  // ===== Section 2: 본점들 =====
  const hqCustomerRows = await query(`SELECT id, company_name, brand FROM customers WHERE operation_type = '본점'`);
  const hqCustomerIds = hqCustomerRows.map(r => r.id);

  let mainStoreRevenue = 0, mainStoreCost = 0;
  const mainStores: Array<{ id: number; name: string; brand: string; revenue: number; cost: number; profit: number }> = [];
  let mainCostGroups: ReturnType<typeof buildCostGroups> = [];

  if (hqCustomerIds.length > 0) {
    const idsParams = hqCustomerIds.map((_, i) => `$${i + 3}`).join(',');
    const mainRev = await query(
      `SELECT customer_id, COALESCE(SUM(amount), 0)::numeric as total
       FROM revenues WHERE customer_id IN (${idsParams}) AND settlement_month BETWEEN $1 AND $2
       GROUP BY customer_id`,
      [monthFrom, monthTo, ...hqCustomerIds]
    );
    const mainCost = await query(
      `SELECT customer_id, COALESCE(SUM(amount), 0)::numeric as total
       FROM costs WHERE customer_id IN (${idsParams}) AND settlement_month BETWEEN $1 AND $2
       GROUP BY customer_id`,
      [monthFrom, monthTo, ...hqCustomerIds]
    );
    const revMap: Record<number, number> = {};
    for (const r of mainRev) revMap[r.customer_id] = Number(r.total);
    const costMap: Record<number, number> = {};
    for (const r of mainCost) costMap[r.customer_id] = Number(r.total);

    for (const c of hqCustomerRows) {
      const rev = revMap[c.id] || 0;
      const cost = costMap[c.id] || 0;
      mainStoreRevenue += rev;
      mainStoreCost += cost;
      mainStores.push({ id: c.id, name: c.company_name, brand: c.brand || '', revenue: rev, cost, profit: rev - cost });
    }

    const mapAll = await costCatMap(`customer_id IN (${idsParams})`, hqCustomerIds);
    mainCostGroups = buildCostGroups(mapAll, cats, mainStoreRevenue);
  }
  const mainStoreProfit = mainStoreRevenue - mainStoreCost;

  // ===== Section 3: 직영점 + 가맹점 =====
  const otherStoreCustomerRows = await query(
    `SELECT id, company_name, brand, operation_type FROM customers WHERE operation_type IN ('직영점', '가맹점')`
  );
  const otherStoreIds = otherStoreCustomerRows.map(r => r.id);

  let otherRevenue = 0, otherCost = 0;
  const otherStores: Array<{ id: number; name: string; brand: string; operation_type: string; revenue: number; cost: number; profit: number }> = [];
  let otherCostGroups: ReturnType<typeof buildCostGroups> = [];

  if (otherStoreIds.length > 0) {
    const idsParams = otherStoreIds.map((_, i) => `$${i + 3}`).join(',');
    const otRev = await query(
      `SELECT customer_id, COALESCE(SUM(amount), 0)::numeric as total
       FROM revenues WHERE customer_id IN (${idsParams}) AND settlement_month BETWEEN $1 AND $2
       GROUP BY customer_id`,
      [monthFrom, monthTo, ...otherStoreIds]
    );
    const otCost = await query(
      `SELECT customer_id, COALESCE(SUM(amount), 0)::numeric as total
       FROM costs WHERE customer_id IN (${idsParams}) AND settlement_month BETWEEN $1 AND $2
       GROUP BY customer_id`,
      [monthFrom, monthTo, ...otherStoreIds]
    );
    const revM: Record<number, number> = {};
    for (const r of otRev) revM[r.customer_id] = Number(r.total);
    const costM: Record<number, number> = {};
    for (const r of otCost) costM[r.customer_id] = Number(r.total);

    for (const c of otherStoreCustomerRows) {
      const rev = revM[c.id] || 0;
      const cost = costM[c.id] || 0;
      otherRevenue += rev;
      otherCost += cost;
      otherStores.push({ id: c.id, name: c.company_name, brand: c.brand || '', operation_type: c.operation_type, revenue: rev, cost, profit: rev - cost });
    }

    const mapAll = await costCatMap(`customer_id IN (${idsParams})`, otherStoreIds);
    otherCostGroups = buildCostGroups(mapAll, cats, otherRevenue);
  }
  const otherProfit = otherRevenue - otherCost;

  // ===== Section 4: 전체 사업 총합 =====
  const totalRevenue = hqRevenue + mainStoreRevenue + otherRevenue;
  const totalCost = hqCost + mainStoreCost + otherCost;
  const totalProfit = hqProfit + mainStoreProfit + otherProfit;

  // ===== 월별 (매출=revenues, 비용=costs) =====
  const allMonths: string[] = [];
  const [fy, fm] = monthFrom.split('-').map(Number);
  const [ty, tm] = monthTo.split('-').map(Number);
  let cy = fy, cm = fm;
  while (cy < ty || (cy === ty && cm <= tm)) {
    allMonths.push(`${cy}-${String(cm).padStart(2, '0')}`);
    cm++; if (cm > 12) { cm = 1; cy++; }
  }

  const monthlyRev = async (where: string, params: unknown[]) => query(
    `SELECT settlement_month as month, COALESCE(SUM(amount), 0)::numeric as total
     FROM revenues WHERE ${where} AND settlement_month BETWEEN $1 AND $2
     GROUP BY settlement_month`,
    [monthFrom, monthTo, ...params]
  );
  const monthlyCost = async (where: string, params: unknown[]) => query(
    `SELECT settlement_month as month, COALESCE(SUM(amount), 0)::numeric as total
     FROM costs WHERE ${where} AND settlement_month BETWEEN $1 AND $2
     GROUP BY settlement_month`,
    [monthFrom, monthTo, ...params]
  );

  const hqIdsP = (offset: number, ids: number[]) => ids.map((_, i) => `$${i + offset}`).join(',');

  const monthlyHqRev = await monthlyRev('customer_id IS NULL', []);
  const monthlyHqCost = await monthlyCost('customer_id IS NULL', []);
  const monthlyMainRev = hqCustomerIds.length > 0 ? await monthlyRev(`customer_id IN (${hqIdsP(3, hqCustomerIds)})`, hqCustomerIds) : [];
  const monthlyMainCost = hqCustomerIds.length > 0 ? await monthlyCost(`customer_id IN (${hqIdsP(3, hqCustomerIds)})`, hqCustomerIds) : [];
  const monthlyOtherRev = otherStoreIds.length > 0 ? await monthlyRev(`customer_id IN (${hqIdsP(3, otherStoreIds)})`, otherStoreIds) : [];
  const monthlyOtherCost = otherStoreIds.length > 0 ? await monthlyCost(`customer_id IN (${hqIdsP(3, otherStoreIds)})`, otherStoreIds) : [];

  const toMap = (rows: { month: string; total: string | number }[]) => {
    const m: Record<string, number> = {};
    for (const r of rows) m[r.month] = Number(r.total);
    return m;
  };
  const mHqRev = toMap(monthlyHqRev);
  const mHqCost = toMap(monthlyHqCost);
  const mMainRev = toMap(monthlyMainRev);
  const mMainCost = toMap(monthlyMainCost);
  const mOtherRev = toMap(monthlyOtherRev);
  const mOtherCost = toMap(monthlyOtherCost);

  const monthly = allMonths.map(m => {
    const hqRev = mHqRev[m] || 0;
    const hqC = mHqCost[m] || 0;
    const mainRev = mMainRev[m] || 0;
    const mainC = mMainCost[m] || 0;
    const otRev = mOtherRev[m] || 0;
    const otC = mOtherCost[m] || 0;
    const tRev = hqRev + mainRev + otRev;
    const tC = hqC + mainC + otC;
    return {
      month: m,
      hq_revenue: hqRev, hq_cost: hqC, hq_profit: hqRev - hqC,
      main_revenue: mainRev, main_cost: mainC, main_profit: mainRev - mainC,
      other_revenue: otRev, other_cost: otC, other_profit: otRev - otC,
      total_revenue: tRev, total_cost: tC, total_profit: tRev - tC,
    };
  });

  return NextResponse.json({
    period: { date_from: dateFrom, date_to: dateTo },
    hq: {
      revenue: hqRevenue,
      cost: hqCost,
      profit: hqProfit,
      breakdown: {
        royalty_revenue: hqRoyaltyRevenue,   // 로열티 자동
        manual_revenue: hqManualRevenue,     // 본사 수동 매출
      },
      cost_groups: hqCostGroups,
    },
    main_stores: {
      revenue: mainStoreRevenue,
      cost: mainStoreCost,
      profit: mainStoreProfit,
      stores: mainStores,
      cost_groups: mainCostGroups,
    },
    other_stores: {
      revenue: otherRevenue,
      cost: otherCost,
      profit: otherProfit,
      stores: otherStores,
      cost_groups: otherCostGroups,
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
