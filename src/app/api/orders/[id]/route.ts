import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'master') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    const { status } = await request.json();

    const data = await query(
      'UPDATE transactions SET order_status = $1 WHERE id = $2 AND source = $3 RETURNING *',
      [status, Number(id), 'order']
    );
    if (data.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(data[0]);
  } catch (err) {
    console.error('Order PUT error:', err);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
