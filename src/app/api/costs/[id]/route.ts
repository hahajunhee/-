import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || (session.role !== 'master' && session.role !== 'manager')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json();
  const amount = Number(body.amount) || 0;
  const customerId = body.customer_id ? Number(body.customer_id) : null;
  const data = await query(
    `UPDATE costs SET customer_id=$1, category=$2, settlement_month=$3, amount=$4, notes=$5
     WHERE id=$6 RETURNING *`,
    [customerId, body.category, body.settlement_month, amount, body.notes || '', Number(id)]
  );
  if (data.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // 로열티 자동 매출 동기화
  const existingRev = await query('SELECT id FROM revenues WHERE related_cost_id = $1', [Number(id)]);
  if (body.category === '로열티' && amount > 0) {
    if (existingRev.length > 0) {
      await query(
        `UPDATE revenues SET settlement_month=$1, amount=$2 WHERE related_cost_id=$3`,
        [body.settlement_month, amount, Number(id)]
      );
    } else {
      await query(
        `INSERT INTO revenues (customer_id, category, settlement_month, amount, notes, source, related_cost_id)
         VALUES (NULL, '로열티', $1, $2, $3, 'royalty_auto', $4)`,
        [body.settlement_month, amount, `자동 생성 (비용 #${id})`, Number(id)]
      );
    }
  } else if (existingRev.length > 0) {
    // 로열티에서 다른 카테고리로 변경되면 자동 매출 삭제
    await query('DELETE FROM revenues WHERE related_cost_id = $1', [Number(id)]);
  }

  return NextResponse.json(data[0]);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || (session.role !== 'master' && session.role !== 'manager')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  // ON DELETE CASCADE로 revenues도 자동 삭제됨
  await query('DELETE FROM costs WHERE id=$1', [Number(id)]);
  return NextResponse.json({ success: true });
}
