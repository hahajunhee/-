import { query } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const data = await query(
    `UPDATE products SET name=$1, brand=$2, category=$3, spec=$4, unit=$5,
     material_cost=$6, other_cost=$7, selling_price=$8, vat_apply=$9, apply_material_cost=$10, incentive=$11, invoice_hidden=$12, operation_type=$13
     WHERE id=$14 RETURNING *`,
    [body.name, body.brand || '', body.category, body.spec, body.unit, body.material_cost, body.other_cost, body.selling_price, body.vat_apply, !!body.apply_material_cost, Number(body.incentive) || 0, !!body.invoice_hidden, body.operation_type || '가맹점', Number(id)]
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
