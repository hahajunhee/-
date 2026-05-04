import { query } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get('category');
  const search = request.nextUrl.searchParams.get('search');

  let q = 'SELECT * FROM products WHERE 1=1';
  const params: unknown[] = [];

  if (category) {
    params.push(category);
    q += ` AND category = $${params.length}`;
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
    `INSERT INTO products (name, category, spec, unit, material_cost, other_cost, selling_price, vat_apply, apply_material_cost, incentive)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [body.name, body.category, body.spec, body.unit, body.material_cost, body.other_cost, body.selling_price, body.vat_apply, !!body.apply_material_cost, Number(body.incentive) || 0]
  );
  return NextResponse.json(data[0], { status: 201 });
}
