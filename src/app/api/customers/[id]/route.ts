import { query } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const data = await query(
    `UPDATE customers SET company_name=$1, brand=$2, contact_name=$3, email=$4, address=$5, tel=$6,
     business_type=$7, business_category=$8, fax=$9, reg_number=$10, operation_type=$11, royalty_rate=$12,
     royalty_type=$13, royalty_amount=$14
     WHERE id=$15 RETURNING *`,
    [body.company_name, body.brand || '', body.contact_name, body.email || '', body.address, body.tel, body.business_type, body.business_category, body.fax, body.reg_number, body.operation_type || '가맹점', Number(body.royalty_rate) || 0, body.royalty_type === 'fixed_monthly' ? 'fixed_monthly' : 'percent', Number(body.royalty_amount) || 0, Number(id)]
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
    await query('DELETE FROM customers WHERE id=$1', [Number(id)]);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '거래 내역이 있는 거래처는 삭제할 수 없습니다' }, { status: 400 });
  }
}
