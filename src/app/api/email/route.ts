import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { sendEmail, buildInvoiceEmailHtml } from '@/lib/email';
import { NextRequest, NextResponse } from 'next/server';

// 거래명세서 이메일 발송 (마스터 전용)
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'master') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { transaction_id } = await request.json();

  // 거래 데이터 조회
  const txnResult = await query(
    `SELECT t.*, c.company_name, c.email as customer_email
     FROM transactions t JOIN customers c ON t.customer_id = c.id
     WHERE t.id = $1`,
    [transaction_id]
  );
  if (txnResult.length === 0) {
    return NextResponse.json({ error: '거래를 찾을 수 없습니다' }, { status: 404 });
  }

  const txn = txnResult[0];
  if (!txn.customer_email) {
    return NextResponse.json({ error: '거래처 이메일이 등록되지 않았습니다' }, { status: 400 });
  }

  const items = await query(
    'SELECT * FROM transaction_items WHERE transaction_id = $1',
    [transaction_id]
  );

  // 설정 조회
  const settingsResult = await query('SELECT * FROM settings WHERE id = 1');
  const settings = settingsResult[0];

  const html = buildInvoiceEmailHtml({
    supplierName: settings?.company_name || '굿푸드시스템',
    customerName: txn.company_name,
    date: txn.date,
    items: items.map((i: any) => ({
      product_name: i.product_name, spec: i.spec, qty: Number(i.qty),
      unit_price: Number(i.unit_price), amount: Number(i.amount),
    })),
    supplyTotal: Number(txn.supply_total),
    vatTotal: Number(txn.vat_total),
    grandTotal: Number(txn.grand_total),
  });

  const result = await sendEmail({
    to: txn.customer_email,
    subject: `[거래명세서] ${txn.date} - ${settings?.company_name || '굿푸드시스템'}`,
    html,
  });

  if (result.success) {
    return NextResponse.json({ success: true, message: `${txn.customer_email}로 발송되었습니다` });
  } else {
    return NextResponse.json({ error: '이메일 발송에 실패했습니다' }, { status: 500 });
  }
}
