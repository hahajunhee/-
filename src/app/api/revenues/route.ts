import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/revenues?month=YYYY-MM&customer_id=X&operation_type=X&brand=X
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
  const includeHq = sp.get('include_hq') !== 'false'; // 기본 본사 매출 포함

  let q = `SELECT r.*, c.company_name as customer_name, c.brand as customer_brand, c.operation_type
           FROM revenues r
           LEFT JOIN customers c ON r.customer_id = c.id
           WHERE 1=1`;
  const params: unknown[] = [];
  if (month) { params.push(month); q += ` AND r.settlement_month = $${params.length}`; }
  if (customerId === 'null') {
    q += ` AND r.customer_id IS NULL`;
  } else if (customerId) {
    params.push(Number(customerId)); q += ` AND r.customer_id = $${params.length}`;
  }
  if (operationType) { params.push(operationType); q += ` AND c.operation_type = $${params.length}`; }
  if (brand !== null) { params.push(brand); q += ` AND c.brand = $${params.length}`; }
  if (!includeHq) q += ` AND r.customer_id IS NOT NULL`;
  q += ' ORDER BY r.settlement_month DESC, r.id DESC';

  const data = await query(q, params);
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== 'master' && session.role !== 'manager')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await request.json();
  if (!body.category || !body.settlement_month) {
    return NextResponse.json({ error: '필수 항목을 입력하세요' }, { status: 400 });
  }
  const customerId = body.customer_id ? Number(body.customer_id) : null;
  const data = await query(
    `INSERT INTO revenues (customer_id, category, settlement_month, amount, notes, source)
     VALUES ($1, $2, $3, $4, $5, 'manual') RETURNING *`,
    [customerId, body.category, body.settlement_month, Number(body.amount) || 0, body.notes || '']
  );
  return NextResponse.json(data[0], { status: 201 });
}
