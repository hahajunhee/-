import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, buildOrderEmailHtml } from '@/lib/email';
import { calcSalesVat, calcPurchaseVat } from '@/lib/calculator';

// GET /api/orders - 발주 내역 조회 (transactions 테이블에서 source='order'인 것)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sp = request.nextUrl.searchParams;
    const status = sp.get('status');
    const brand = sp.get('brand');
    const operationType = sp.get('operation_type');
    const customerId = sp.get('customer_id');

    let q = `SELECT t.*, c.company_name as customer_name, c.email as customer_email,
      c.brand as customer_brand, c.operation_type as customer_operation_type,
      u.name as user_name,
      TO_CHAR(t.date, 'YYYY-MM-DD') as date_formatted
      FROM transactions t
      JOIN customers c ON t.customer_id = c.id
      LEFT JOIN users u ON t.user_id = u.id
      WHERE t.source = 'order'`;
    const params: unknown[] = [];

    // 협력사는 자기 발주만
    if (session.role === 'partner') {
      params.push(session.id);
      q += ` AND t.user_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      q += ` AND t.order_status = $${params.length}`;
    }
    if (brand !== null) {
      params.push(brand);
      q += ` AND c.brand = $${params.length}`;
    }
    if (operationType) {
      params.push(operationType);
      q += ` AND c.operation_type = $${params.length}`;
    }
    if (customerId) {
      params.push(Number(customerId));
      q += ` AND t.customer_id = $${params.length}`;
    }
    q += ' ORDER BY t.created_at DESC';

    const orders = await query(q, params);

    for (const order of orders) {
      const items = await query('SELECT * FROM transaction_items WHERE transaction_id = $1 ORDER BY id', [order.id]);
      order.items = items;
    }

    return NextResponse.json(orders);
  } catch (err) {
    console.error('Orders GET error:', err);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

// POST /api/orders - 협력사 발주서 제출 (transactions 테이블에 source='order'로 저장)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { items, notes } = body;

    if (!session.customer_id) {
      return NextResponse.json({ error: '거래처가 연결되지 않은 계정입니다' }, { status: 400 });
    }

    // 발주번호 생성
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const countResult = await query(
      "SELECT COUNT(*) as cnt FROM transactions WHERE order_number LIKE $1",
      [`ORD${today}%`]
    );
    const seq = String(Number(countResult[0].cnt) + 1).padStart(3, '0');
    const orderNumber = `ORD${today}${seq}`;

    // 품목 DB에서 원가 정보 조회 후 계산
    let supplyTotal = 0, vatTotal = 0;
    const computedItems = [];

    for (const item of items) {
      // 품목 DB에서 최신 원가/납품가 정보 가져오기
      const productRows = await query('SELECT * FROM products WHERE id = $1', [item.product_id]);
      const product = productRows[0];
      if (!product) continue;

      const qty = Number(item.qty);
      const materialCost = Number(product.material_cost);
      const otherCost = Number(product.other_cost);
      const vatApply = product.vat_apply;
      const incentive = Number(product.incentive) || 0;
      // 재료원가 적용(Y) → 단가 = 재료원가
      const unitPrice = product.apply_material_cost
        ? materialCost
        : Number(product.selling_price);

      const amount = unitPrice * qty;                                     // 금액 = 단가 × 수량
      // 거래명세서 표시 부가세 = 매출부가세 (단가 × 10% × 수량)
      const vatAmount = calcSalesVat(unitPrice, vatApply) * qty;
      // 손익 계산용 납부부가세 = (매출 - 매입) × 수량
      const netVatPerUnit = calcSalesVat(unitPrice, vatApply) - calcPurchaseVat(materialCost, vatApply);
      const marginPerUnit = unitPrice - materialCost - otherCost;
      const margin = marginPerUnit * qty;
      // 순익 = 마진 - 납부부가세 + 수량 × 장려금
      const netProfit = margin - netVatPerUnit * qty + qty * incentive;

      supplyTotal += amount;
      vatTotal += vatAmount;

      computedItems.push({
        product_id: product.id,
        product_name: product.name,
        category: product.category,
        spec: product.spec,
        unit: product.unit,
        qty,
        unit_price: unitPrice,
        material_cost: materialCost,
        other_cost: otherCost,
        amount,
        vat_apply: vatApply,
        vat_amount: vatAmount,
        margin,
        net_profit: netProfit,
        incentive,
        invoice_hidden: !!product.invoice_hidden,
      });
    }
    const grandTotal = supplyTotal + vatTotal;

    // transactions 테이블에 저장 (source='order')
    const txnResult = await query(
      `INSERT INTO transactions (date, customer_id, payment_status, supply_total, vat_total, grand_total, source, notes, order_number, user_id, order_status)
       VALUES (CURRENT_DATE, $1, 'unpaid', $2, $3, $4, 'order', $5, $6, $7, 'pending') RETURNING *`,
      [session.customer_id, supplyTotal, vatTotal, grandTotal, notes || '', orderNumber, session.id]
    );
    const txn = txnResult[0];

    for (const ci of computedItems) {
      await query(
        `INSERT INTO transaction_items
         (transaction_id, product_id, product_name, category, spec, unit, qty, unit_price, material_cost, other_cost, amount, vat_apply, vat_amount, margin, net_profit, incentive, invoice_hidden)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [txn.id, ci.product_id, ci.product_name, ci.category, ci.spec, ci.unit, ci.qty, ci.unit_price, ci.material_cost, ci.other_cost, ci.amount, ci.vat_apply, ci.vat_amount, ci.margin, ci.net_profit, ci.incentive, ci.invoice_hidden]
      );
    }

    // 이메일 발송
    const custResult = await query('SELECT * FROM customers WHERE id = $1', [session.customer_id]);
    if (custResult.length > 0 && custResult[0].email) {
      const emailHtml = buildOrderEmailHtml({
        customerName: custResult[0].company_name,
        orderNumber,
        date: new Date().toISOString().split('T')[0],
        items: computedItems.map(i => ({
          product_name: i.product_name, spec: i.spec, qty: i.qty,
          unit_price: i.unit_price, amount: i.amount,
        })),
        grandTotal,
        notes: notes || '',
      });
      await sendEmail({
        to: custResult[0].email,
        subject: `[발주확인] ${orderNumber} - SOYANG F&C`,
        html: emailHtml,
      });
      await query('UPDATE transactions SET email_sent = true WHERE id = $1', [txn.id]);
    }

    return NextResponse.json(txn, { status: 201 });
  } catch (err) {
    console.error('Orders POST error:', err);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
