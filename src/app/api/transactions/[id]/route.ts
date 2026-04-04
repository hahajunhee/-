import { query } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const txnResult = await query(
    `SELECT t.*,
     TO_CHAR(t.date, 'YYYY-MM-DD') as date_formatted,
     c.company_name, c.contact_name, c.email as customer_email,
     c.address as customer_address,
     c.tel as customer_tel,
     c.business_type as customer_business_type,
     c.business_category as customer_business_category,
     c.fax as customer_fax,
     c.reg_number as customer_reg_number
     FROM transactions t
     JOIN customers c ON t.customer_id = c.id
     WHERE t.id = $1`,
    [Number(id)]
  );

  if (txnResult.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const row = txnResult[0];
  const items = await query(
    'SELECT * FROM transaction_items WHERE transaction_id = $1 ORDER BY id',
    [Number(id)]
  );

  return NextResponse.json({
    id: row.id,
    date: row.date,
    date_formatted: row.date_formatted,
    customer_id: row.customer_id,
    payment_status: row.payment_status,
    supply_total: row.supply_total,
    vat_total: row.vat_total,
    grand_total: row.grand_total,
    items,
    customer: {
      company_name: row.company_name,
      contact_name: row.contact_name,
      email: row.customer_email,
      address: row.customer_address,
      tel: row.customer_tel,
      business_type: row.customer_business_type,
      business_category: row.customer_business_category,
      fax: row.customer_fax,
      reg_number: row.customer_reg_number,
    },
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const data = await query(
    'UPDATE transactions SET payment_status=$1 WHERE id=$2 RETURNING *',
    [body.payment_status, Number(id)]
  );
  if (data.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(data[0]);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await query('DELETE FROM transaction_items WHERE transaction_id=$1', [Number(id)]);
  await query('DELETE FROM transactions WHERE id=$1', [Number(id)]);
  return NextResponse.json({ success: true });
}
