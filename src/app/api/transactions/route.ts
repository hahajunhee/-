import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const dateFrom = sp.get('date_from');
  const dateTo = sp.get('date_to');
  const customerId = sp.get('customer_id');
  const status = sp.get('status');

  let query = supabase
    .from('transactions')
    .select('*, customer:customers(company_name, contact_name), items:transaction_items(*)')
    .order('date', { ascending: false })
    .order('id', { ascending: false });

  if (dateFrom) query = query.gte('date', dateFrom);
  if (dateTo) query = query.lte('date', dateTo);
  if (customerId) query = query.eq('customer_id', Number(customerId));
  if (status) query = query.eq('payment_status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { items, ...header } = body;

  // 거래 헤더 생성
  const { data: txn, error: txnError } = await supabase
    .from('transactions')
    .insert(header)
    .select()
    .single();

  if (txnError) return NextResponse.json({ error: txnError.message }, { status: 500 });

  // 거래 상세 항목 생성
  const itemsWithTxnId = items.map((item: Record<string, unknown>) => ({
    ...item,
    transaction_id: txn.id,
  }));

  const { error: itemsError } = await supabase
    .from('transaction_items')
    .insert(itemsWithTxnId);

  if (itemsError) {
    // 롤백: 헤더 삭제
    await supabase.from('transactions').delete().eq('id', txn.id);
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  return NextResponse.json(txn, { status: 201 });
}
