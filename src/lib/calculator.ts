// 마진 = 단가(납품가) - 재료원가 - 기타원가
export function calcMargin(sellingPrice: number | string, materialCost: number | string, otherCost: number | string): number {
  return Number(sellingPrice) - (Number(materialCost) + Number(otherCost));
}

// 부가세 = 단가 × 10% (부가세여부 Y인 경우만)  — 엑셀 공식 G×10%
export function calcVat(sellingPrice: number | string, vatApply: boolean): number {
  return vatApply ? Math.floor(Number(sellingPrice) * 0.1) : 0;
}

// 최종순익 = 마진 - 부가세
export function calcNetProfit(margin: number, vat: number): number {
  return margin - vat;
}

// 마진율 = 최종순익 / 단가  — 엑셀 공식 (J-부가세)/G
export function calcMarginRate(netProfit: number, sellingPrice: number | string): number {
  const sp = Number(sellingPrice);
  if (sp === 0) return 0;
  return netProfit / sp;
}

// 금액 = 단가 × 수량
export function calcAmount(unitPrice: number | string, qty: number | string): number {
  return Number(unitPrice) * Number(qty);
}

// 품목의 계산된 필드 산출 (엑셀 공식과 동일)
export function computeProductFields(product: {
  selling_price: number | string;
  material_cost: number | string;
  other_cost: number | string;
  vat_apply: boolean;
}) {
  const margin = calcMargin(product.selling_price, product.material_cost, product.other_cost);
  const vat_amount = calcVat(product.selling_price, product.vat_apply);
  const net_profit = calcNetProfit(margin, vat_amount);
  const margin_rate = calcMarginRate(net_profit, product.selling_price);
  return { margin, vat_amount, net_profit, margin_rate };
}

// 거래 항목의 계산된 필드 산출
// apply_material_cost=true인 경우 단가로 재료원가를 사용함 (line의 unit_price가 이미 재료원가로 세팅되어 있음)
export function computeItemFields(item: {
  unit_price: number | string;          // 이미 apply_material_cost에 따라 재료원가 또는 납품가로 선택된 값
  material_cost: number | string;
  other_cost: number | string;
  qty: number | string;
  vat_apply: boolean;
}) {
  const qty = Number(item.qty);
  const unitPrice = Number(item.unit_price);
  const materialCost = Number(item.material_cost);
  const otherCost = Number(item.other_cost);

  // 단위 부가세 = 단가 × 10% (vat_apply=Y일 때)
  const vatPerUnit = item.vat_apply ? Math.floor(unitPrice * 0.1) : 0;

  // 공급가액(금액) = 단가 × 수량
  const amount = unitPrice * qty;
  const vat_amount = vatPerUnit * qty;

  // 마진/순익 계산 (분석용)
  const marginPerUnit = unitPrice - materialCost - otherCost;
  const margin = marginPerUnit * qty;
  const net_profit = margin - vat_amount;

  return { amount, margin, vat_amount, net_profit };
}

// 숫자를 한국 원화 형식으로 포맷
export function formatKRW(amount: number | string): string {
  return new Intl.NumberFormat('ko-KR').format(Number(amount));
}

// 퍼센트 포맷
export function formatPercent(rate: number): string {
  return (rate * 100).toFixed(1) + '%';
}
