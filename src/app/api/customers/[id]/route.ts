import { query } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const data = await query(
    `UPDATE customers SET company_name=$1, contact_name=$2, address=$3, tel=$4,
     business_type=$5, business_category=$6, fax=$7, reg_number=$8
     WHERE id=$9 RETURNING *`,
    [body.company_name, body.contact_name, body.address, body.tel, body.business_type, body.business_category, body.fax, body.reg_number, Number(id)]
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
