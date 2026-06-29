import { CostGroup } from '@/types';

interface CatMeta {
  name: string;
  parent_group: string | null;
  order_idx: number | string;
}

// 카테고리별 금액 맵 + 카테고리 메타(상위그룹/정렬) + 매출을 받아
// 통계 화면용 그룹 구조로 변환한다.
// - parent_group이 있는 카테고리는 해당 그룹의 children으로 묶고, 그룹 합계/비율을 낸다.
// - parent_group이 없으면 단독 항목으로 표시.
// - 금액이 0인 항목은 표시에서 제외하되, 그룹 합계에는 반영(0이므로 영향 없음)한다.
export function buildCostGroups(
  amountMap: Record<string, number>,
  categories: CatMeta[],
  revenue: number
): CostGroup[] {
  const ratio = (a: number) => (revenue > 0 ? a / revenue : 0);
  const ordered = [...categories].sort(
    (a, b) => Number(a.order_idx) - Number(b.order_idx)
  );

  const groupMap = new Map<string, CostGroup>();
  const result: CostGroup[] = [];
  const seen = new Set<string>();

  for (const c of ordered) {
    seen.add(c.name);
    const amt = Number(amountMap[c.name] || 0);
    if (c.parent_group) {
      let g = groupMap.get(c.parent_group);
      if (!g) {
        g = { name: c.parent_group, is_group: true, amount: 0, ratio: 0, children: [] };
        groupMap.set(c.parent_group, g);
        result.push(g);
      }
      g.amount += amt;
      if (amt > 0) g.children.push({ category: c.name, amount: amt, ratio: ratio(amt) });
    } else if (amt > 0) {
      result.push({ name: c.name, is_group: false, amount: amt, ratio: ratio(amt), children: [] });
    }
  }

  // 카테고리 목록에 없는데 비용에만 존재하는 이름(과거 데이터 등)은 단독 항목으로
  for (const [name, raw] of Object.entries(amountMap)) {
    if (seen.has(name)) continue;
    const amt = Number(raw || 0);
    if (amt > 0) result.push({ name, is_group: false, amount: amt, ratio: ratio(amt), children: [] });
  }

  // 합계가 0인 그룹은 제거, 그룹 비율 확정
  return result
    .filter((g) => (g.is_group ? g.amount > 0 : true))
    .map((g) => ({ ...g, ratio: ratio(g.amount) }));
}
