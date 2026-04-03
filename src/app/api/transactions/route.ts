import { query } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const dateFrom = sp.get('date_from');
    const dateTo = sp.get('date_to');
    const customerId = sp.get('customer_id');
    const status = sp.get('status');

    let q = `
      SELECT t.*, c.company_name as customer_name, c.contact_name,
             TO_CHAR(t.date, 'YYYY-MM-DD') as date_formatted
      FROM transactions t
      JOIN customers c ON t.customer_id = c.id
      WHERE 1=1`;
    const params: unknown[] = [];

    if (dateFrom) {
      params.push(dateFrom);
      q += ` AND t.date >= $${params.length}`;
    }
    if (dateTo) {
      params.push(dateTo);
      q += ` AND t.date <= $${params.length}`;
    }
    if (customerId) {
      params.push(Number(customerId));
      q += ` AND t.customer_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      q += ` AND t.payment_status = $${params.length}`;
    }
    q += ' ORDER BY t.date DESC, t.id DESC';

    const transactions = await query(q, params);

    for (const txn of transactions) {
      const items = await query(
        'SELECT * FROM transaction_items WHERE transaction_id = $1 ORDER BY id',
        [txn.id]
      );
      txn.items = items;
      txn.customer = { company_name: txn.customer_name, contact_name: txn.contact_name };
    }

    return NextResponse.json(transactions);
  } catch (err) {
    console.error('Transactions GET error:', err);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, ...header } = body;

    const txnResult = await query(
      `INSERT INTO transactions (date, customer_id, payment_status, supply_total, vat_total, grand_total, source)
       VALUES ($1, $2, $3, $4, $5, $6, 'manual') RETURNING *`,
      [header.date, header.customer_id, header.payment_status, header.supply_total, header.vat_total, header.grand_total]
    );
    const txn = txnResult[0];

    for (const item of items) {
      await query(
        `INSERT INTO transaction_items
         (transaction_id, product_id, product_name, category, spec, unit, qty, unit_price, material_cost, other_cost, amount, vat_apply, vat_amount, margin, net_profit)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [txn.id, item.product_id, item.product_name, item.category, item.spec, item.unit, item.qty, item.unit_price, item.material_cost, item.other_cost, item.amount, item.vat_apply, item.vat_amount, item.margin, item.net_profit]
      );
    }

    return NextResponse.json(txn, { status: 201 });
  } catch (err) {
    console.error('Transactions POST error:', err);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
