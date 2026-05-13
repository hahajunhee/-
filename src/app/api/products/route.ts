import { query } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get('category');
  const search = request.nextUrl.searchParams.get('search');
  const operationType = request.nextUrl.searchParams.get('operation_type');

  let q = 'SELECT * FROM products WHERE 1=1';
  const params: unknown[] = [];

  if (category) {
    params.push(category);
    q += ` AND category = $${params.length}`;
  }
  if (operationType) {
    params.push(operationType);
    q += ` AND operation_type = $${params.length}`;
  }
  if (search) {
    params.push(`%${search}%`);
    q += ` AND name ILIKE $${params.length}`;
  }
  q += ' ORDER BY id';

  const data = await query(q, params);
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = await query(
    `INSERT INTO products (name, category, spec, unit, material_cost, other_cost, selling_price, vat_apply, apply_material_cost, incentive, invoice_hidden, operation_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
    [body.name, body.category, body.spec, body.unit, body.material_cost, body.other_cost, body.selling_price, body.vat_apply, !!body.apply_material_cost, Number(body.incentive) || 0, !!body.invoice_hidden, body.operation_type || '대리점']
  );
  return NextResponse.json(data[0], { status: 201 });
}
