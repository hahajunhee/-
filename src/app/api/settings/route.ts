import { query } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const data = await query('SELECT * FROM settings WHERE id = 1');
  if (data.length === 0) {
    return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
  }
  return NextResponse.json(data[0]);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const data = await query(
    `UPDATE settings SET
     company_name=$1, rep_name=$2, reg_number=$3, address=$4,
     business_type=$5, business_category=$6, tel=$7, fax=$8,
     bank_info=$9, print_operator=$10, invoice_note=$11
     WHERE id=1 RETURNING *`,
    [body.company_name, body.rep_name, body.reg_number, body.address,
     body.business_type, body.business_category, body.tel, body.fax,
     body.bank_info, body.print_operator, body.invoice_note || '']
  );
  return NextResponse.json(data[0]);
}
