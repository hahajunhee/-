import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/costs?month=YYYY-MM&customer_id=X&operation_type=X
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== 'master' && session.role !== 'manager')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const sp = request.nextUrl.searchParams;
  const month = sp.get('month');
  const customerId = sp.get('customer_id');
  const operationType = sp.get('operation_type');
  const brand = sp.get('brand');

  let q = `SELECT co.*, c.company_name as customer_name, c.brand as customer_brand, c.operation_type
           FROM costs co
           JOIN customers c ON co.customer_id = c.id
           WHERE 1=1`;
  const params: unknown[] = [];
  if (month) { params.push(month); q += ` AND co.settlement_month = $${params.length}`; }
  if (customerId) { params.push(Number(customerId)); q += ` AND co.customer_id = $${params.length}`; }
  if (operationType) { params.push(operationType); q += ` AND c.operation_type = $${params.length}`; }
  if (brand !== null) { params.push(brand); q += ` AND c.brand = $${params.length}`; }
  q += ' ORDER BY co.settlement_month DESC, co.id DESC';

  const data = await query(q, params);
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== 'master' && session.role !== 'manager')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await request.json();
  if (!body.customer_id || !body.category || !body.settlement_month) {
    return NextResponse.json({ error: '필수 항목을 입력하세요' }, { status: 400 });
  }
  const amount = Number(body.amount) || 0;
  const data = await query(
    `INSERT INTO costs (customer_id, category, settlement_month, amount, notes)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [Number(body.customer_id), body.category, body.settlement_month, amount, body.notes || '']
  );
  const created = data[0];

  // 로열티인 경우 본사 매출 자동 생성 (customer_id=NULL)
  if (body.category === '로열티' && amount > 0) {
    await query(
      `INSERT INTO revenues (customer_id, category, settlement_month, amount, notes, source, related_cost_id)
       VALUES (NULL, '로열티', $1, $2, $3, 'royalty_auto', $4)`,
      [body.settlement_month, amount, `자동 생성 (비용 #${created.id})`, created.id]
    );
  }
  return NextResponse.json(created, { status: 201 });
}
