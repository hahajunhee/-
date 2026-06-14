// 마진 = 단가(납품가) - 재료원가 - 기타원가
export function calcMargin(sellingPrice: number | string, materialCost: number | string, otherCost: number | string): number {
  return Number(sellingPrice) - (Number(materialCost) + Number(otherCost));
}

// 매출부가세 = 단가(납품가) × 10% (거래명세서에 표시되는 부가세, 거래처가 납부)
export function calcSalesVat(sellingPrice: number | string, vatApply: boolean): number {
  return vatApply ? Math.floor(Number(sellingPrice) * 0.1) : 0;
}

// 매입부가세 = 재료원가 × 10% (자재 매입 시 이미 낸 부가세 - 환급/공제됨)
export function calcPurchaseVat(materialCost: number | string, vatApply: boolean): number {
  return vatApply ? Math.floor(Number(materialCost) * 0.1) : 0;
}

// 납부부가세 = 매출부가세 - 매입부가세 (실제 납부할 부가세)
export function calcNetVat(sellingPrice: number | string, materialCost: number | string, vatApply: boolean): number {
  return calcSalesVat(sellingPrice, vatApply) - calcPurchaseVat(materialCost, vatApply);
}

// (legacy 호환) 부가세 = 단가 × 10%
export function calcVat(sellingPrice: number | string, vatApply: boolean): number {
  return calcSalesVat(sellingPrice, vatApply);
}

// 최종순익 = 마진 - 납부부가세
export function calcNetProfit(margin: number, netVat: number): number {
  return margin - netVat;
}

// 마진율 = 최종순익 / 단가
export function calcMarginRate(netProfit: number, sellingPrice: number | string): number {
  const sp = Number(sellingPrice);
  if (sp === 0) return 0;
  return netProfit / sp;
}

// 금액 = 단가 × 수량
export function calcAmount(unitPrice: number | string, qty: number | string): number {
  return Number(unitPrice) * Number(qty);
}

// 품목의 계산된 필드 산출
// vat_amount = 납부부가세 (매출-매입)
// net_profit = 마진 - 납부부가세
export function computeProductFields(product: {
  selling_price: number | string;
  material_cost: number | string;
  other_cost: number | string;
  vat_apply: boolean;
}) {
  const margin = calcMargin(product.selling_price, product.material_cost, product.other_cost);
  const vat_amount = calcNetVat(product.selling_price, product.material_cost, product.vat_apply);  // 납부부가세
  const net_profit = calcNetProfit(margin, vat_amount);
  const margin_rate = calcMarginRate(net_profit, product.selling_price);
  return { margin, vat_amount, net_profit, margin_rate };
}

// 거래 항목의 계산된 필드 산출
// - vat_amount (거래명세서 표시용): 매출부가세 = 단가 × 10% × 수량
// - net_profit (내부 손익): 마진 - 납부부가세
export function computeItemFields(item: {
  unit_price: number | string;          // 거래 단가 (apply_material_cost에 따라 결정됨)
  material_cost: number | string;
  other_cost: number | string;
  qty: number | string;
  vat_apply: boolean;
}) {
  const qty = Number(item.qty);
  const unitPrice = Number(item.unit_price);
  const materialCost = Number(item.material_cost);
  const otherCost = Number(item.other_cost);

  // 매출부가세 (거래명세서 표시용)
  const salesVatPerUnit = item.vat_apply ? Math.floor(unitPrice * 0.1) : 0;
  // 매입부가세 (손익 계산에 차감)
  const purchaseVatPerUnit = item.vat_apply ? Math.floor(materialCost * 0.1) : 0;
  // 납부부가세
  const netVatPerUnit = salesVatPerUnit - purchaseVatPerUnit;

  // 공급가액(금액) = 단가 × 수량
  const amount = unitPrice * qty;
  // 거래명세서에 표시되는 부가세는 매출부가세
  const vat_amount = salesVatPerUnit * qty;

  // 손익 계산 = 마진 - 납부부가세
  const marginPerUnit = unitPrice - materialCost - otherCost;
  const margin = marginPerUnit * qty;
  const net_profit = margin - netVatPerUnit * qty;

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
