// 마진 = 납품가 - (재료원가 + 기타원가)
export function calcMargin(sellingPrice: number, materialCost: number, otherCost: number): number {
  return sellingPrice - (materialCost + otherCost);
}

// 부가세 = 마진 × 10% (부가세여부 Y인 경우만)
export function calcVat(margin: number, vatApply: boolean): number {
  return vatApply ? Math.floor(margin * 0.1) : 0;
}

// 최종순익 = 마진 - 부가세
export function calcNetProfit(margin: number, vat: number): number {
  return margin - vat;
}

// 마진율 = 마진 / 납품가
export function calcMarginRate(margin: number, sellingPrice: number): number {
  if (sellingPrice === 0) return 0;
  return margin / sellingPrice;
}

// 금액 = 납품가 × 수량
export function calcAmount(unitPrice: number, qty: number): number {
  return unitPrice * qty;
}

// 품목의 계산된 필드를 모두 산출
export function computeProductFields(product: {
  selling_price: number;
  material_cost: number;
  other_cost: number;
  vat_apply: boolean;
}) {
  const margin = calcMargin(product.selling_price, product.material_cost, product.other_cost);
  const vat_amount = calcVat(margin, product.vat_apply);
  const net_profit = calcNetProfit(margin, vat_amount);
  const margin_rate = calcMarginRate(margin, product.selling_price);
  return { margin, vat_amount, net_profit, margin_rate };
}

// 거래 항목의 계산된 필드를 산출
export function computeItemFields(item: {
  unit_price: number;
  material_cost: number;
  other_cost: number;
  qty: number;
  vat_apply: boolean;
}) {
  const amount = calcAmount(item.unit_price, item.qty);
  const marginPerUnit = calcMargin(item.unit_price, item.material_cost, item.other_cost);
  const margin = marginPerUnit * item.qty;
  const vat_amount = calcVat(margin, item.vat_apply);
  const net_profit = calcNetProfit(margin, vat_amount);
  return { amount, margin, vat_amount, net_profit };
}

// 숫자를 한국 원화 형식으로 포맷
export function formatKRW(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount);
}

// 퍼센트 포맷
export function formatPercent(rate: number): string {
  return (rate * 100).toFixed(1) + '%';
}
