import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const data = await query('SELECT * FROM cost_categories ORDER BY order_idx, id');
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'master') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await request.json();
  if (!body.name?.trim()) return NextResponse.json({ error: '이름을 입력하세요' }, { status: 400 });
  try {
    const maxRow = await query('SELECT COALESCE(MAX(order_idx), 0) as max FROM cost_categories');
    const nextIdx = Number(maxRow[0]?.max || 0) + 1;
    const data = await query(
      'INSERT INTO cost_categories (name, order_idx) VALUES ($1, $2) RETURNING *',
      [body.name.trim(), nextIdx]
    );
    return NextResponse.json(data[0], { status: 201 });
  } catch {
    return NextResponse.json({ error: '이미 존재하는 카테고리입니다' }, { status: 400 });
  }
}
