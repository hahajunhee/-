import { query } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get('search');

  let q = 'SELECT * FROM customers WHERE 1=1';
  const params: unknown[] = [];

  if (search) {
    params.push(`%${search}%`);
    q += ` AND (company_name ILIKE $${params.length} OR contact_name ILIKE $${params.length})`;
  }
  q += ' ORDER BY id';

  const data = await query(q, params);
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = await query(
    `INSERT INTO customers (company_name, brand, contact_name, email, address, tel, business_type, business_category, fax, reg_number, operation_type, royalty_rate)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
    [body.company_name, body.brand || '', body.contact_name, body.email || '', body.address, body.tel, body.business_type, body.business_category, body.fax, body.reg_number, body.operation_type || '가맹점', Number(body.royalty_rate) || 0]
  );
  return NextResponse.json(data[0], { status: 201 });
}
