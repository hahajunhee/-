import { query } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const data = await query(
    `UPDATE products SET name=$1, category=$2, spec=$3, unit=$4,
     material_cost=$5, other_cost=$6, selling_price=$7, vat_apply=$8
     WHERE id=$9 RETURNING *`,
    [body.name, body.category, body.spec, body.unit, body.material_cost, body.other_cost, body.selling_price, body.vat_apply, Number(id)]
  );
  if (data.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(data[0]);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await query('DELETE FROM products WHERE id=$1', [Number(id)]);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '거래 내역이 있는 품목은 삭제할 수 없습니다' }, { status: 400 });
  }
}
