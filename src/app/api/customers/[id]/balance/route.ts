import { query } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/customers/[id]/balance?exclude_ids=1,2,3
// 해당 거래처의 미입금 잔액 조회 (특정 거래 제외 가능)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const excludeIdsStr = url.searchParams.get('exclude_ids');
    const excludeIds = excludeIdsStr ? excludeIdsStr.split(',').map(Number).filter(n => !isNaN(n)) : [];

    let sql = `SELECT COALESCE(SUM(grand_total), 0) as balance
               FROM transactions
               WHERE customer_id = $1 AND payment_status = 'unpaid'`;
    const sqlParams: (number)[] = [Number(id)];

    if (excludeIds.length > 0) {
      const placeholders = excludeIds.map((_, i) => `$${i + 2}`).join(',');
      sql += ` AND id NOT IN (${placeholders})`;
      sqlParams.push(...excludeIds);
    }

    const result = await query(sql, sqlParams);
    return NextResponse.json({ balance: Number(result[0]?.balance || 0) });
  } catch (err) {
    console.error('Balance query error:', err);
    return NextResponse.json({ balance: 0 });
  }
}
