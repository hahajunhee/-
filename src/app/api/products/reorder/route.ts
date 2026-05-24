import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/products/reorder { ids: [3, 1, 4, 2] }
// 주어진 순서대로 sort_order를 1, 2, 3... 으로 저장
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== 'master' && session.role !== 'manager')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { ids } = await request.json();
  if (!Array.isArray(ids)) return NextResponse.json({ error: 'ids array required' }, { status: 400 });

  for (let i = 0; i < ids.length; i++) {
    const pid = Number(ids[i]);
    if (!Number.isFinite(pid)) continue;
    await query('UPDATE products SET sort_order = $1 WHERE id = $2', [i + 1, pid]);
  }
  return NextResponse.json({ success: true });
}
