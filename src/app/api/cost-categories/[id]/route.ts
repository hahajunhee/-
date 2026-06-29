import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'master') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json();
  // parent_group: 명시적으로 보내면 갱신(빈 문자열/null이면 단독 카테고리로). 미전송이면 기존 유지.
  const hasGroup = Object.prototype.hasOwnProperty.call(body, 'parent_group');
  const parentGroup = body.parent_group?.trim() ? body.parent_group.trim() : null;
  const data = hasGroup
    ? await query(
        'UPDATE cost_categories SET name=COALESCE($1, name), parent_group=$2 WHERE id=$3 RETURNING *',
        [body.name?.trim() || null, parentGroup, Number(id)]
      )
    : await query(
        'UPDATE cost_categories SET name=$1 WHERE id=$2 RETURNING *',
        [body.name?.trim(), Number(id)]
      );
  if (data.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(data[0]);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'master') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  await query('DELETE FROM cost_categories WHERE id=$1', [Number(id)]);
  return NextResponse.json({ success: true });
}
