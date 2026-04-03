import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, buildOrderEmailHtml } from '@/lib/email';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const status = request.nextUrl.searchParams.get('status');

  let q = `SELECT o.*, c.company_name as customer_name, c.email as customer_email, u.name as user_name
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    JOIN users u ON o.user_id = u.id
    WHERE 1=1`;
  const params: unknown[] = [];

  // 협력사는 자기 발주만
  if (session.role === 'partner') {
    params.push(session.id);
    q += ` AND o.user_id = $${params.length}`;
  }
  if (status) {
    params.push(status);
    q += ` AND o.status = $${params.length}`;
  }
  q += ' ORDER BY o.created_at DESC';

  const orders = await query(q, params);

  for (const order of orders) {
    const items = await query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id', [order.id]);
    order.items = items;
  }

  return NextResponse.json(orders);
}

export async function POST(request: NextRequest) {
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
    "SELECT COUNT(*) as cnt FROM orders WHERE order_number LIKE $1",
    [`ORD${today}%`]
  );
  const seq = String(Number(countResult[0].cnt) + 1).padStart(3, '0');
  const orderNumber = `ORD${today}${seq}`;

  // 합계 계산
  let supplyTotal = 0, vatTotal = 0;
  for (const item of items) {
    supplyTotal += Number(item.amount);
    vatTotal += Number(item.vat_amount || 0);
  }
  const grandTotal = supplyTotal + vatTotal;

  const orderResult = await query(
    `INSERT INTO orders (order_number, customer_id, user_id, date, notes, supply_total, vat_total, grand_total)
     VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, $7) RETURNING *`,
    [orderNumber, session.customer_id, session.id, notes || '', supplyTotal, vatTotal, grandTotal]
  );
  const order = orderResult[0];

  for (const item of items) {
    await query(
      `INSERT INTO order_items (order_id, product_id, product_name, category, spec, unit, qty, unit_price, amount, vat_apply, vat_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [order.id, item.product_id, item.product_name, item.category, item.spec, item.unit, item.qty, item.unit_price, item.amount, item.vat_apply, item.vat_amount]
    );
  }

  // 이메일 발송 (협력사 이메일로)
  const custResult = await query('SELECT * FROM customers WHERE id = $1', [session.customer_id]);
  if (custResult.length > 0 && custResult[0].email) {
    const emailHtml = buildOrderEmailHtml({
      customerName: custResult[0].company_name,
      orderNumber,
      date: new Date().toISOString().split('T')[0],
      items: items.map((i: any) => ({
        product_name: i.product_name, spec: i.spec, qty: i.qty,
        unit_price: i.unit_price, amount: i.amount,
      })),
      grandTotal,
      notes: notes || '',
    });
    await sendEmail({
      to: custResult[0].email,
      subject: `[발주확인] ${orderNumber} - 굿푸드시스템`,
      html: emailHtml,
    });
    await query('UPDATE orders SET email_sent = true WHERE id = $1', [order.id]);
  }

  return NextResponse.json(order, { status: 201 });
}
