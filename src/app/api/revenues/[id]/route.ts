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
  // 자동 매출(source=royalty_auto)은 직접 수정 금지 (관련 비용을 수정해야 함)
  const existing = await query('SELECT source FROM revenues WHERE id = $1', [Number(id)]);
  if (existing.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing[0].source === 'royalty_auto') {
    return NextResponse.json({ error: '로열티 자동 매출은 비용 항목에서 수정해주세요' }, { status: 400 });
  }
  const customerId = body.customer_id ? Number(body.customer_id) : null;
  const data = await query(
    `UPDATE revenues SET customer_id=$1, category=$2, settlement_month=$3, amount=$4, notes=$5
     WHERE id=$6 RETURNING *`,
    [customerId, body.category, body.settlement_month, Number(body.amount) || 0, body.notes || '', Number(id)]
  );
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
  const existing = await query('SELECT source FROM revenues WHERE id = $1', [Number(id)]);
  if (existing.length > 0 && existing[0].source === 'royalty_auto') {
    return NextResponse.json({ error: '로열티 자동 매출은 관련 비용을 삭제해야 함께 삭제됩니다' }, { status: 400 });
  }
  await query('DELETE FROM revenues WHERE id=$1', [Number(id)]);
  return NextResponse.json({ success: true });
}
