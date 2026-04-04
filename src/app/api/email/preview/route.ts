import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { buildInvoiceEmailHtml } from '@/lib/email';

// POST /api/email/preview - 이메일 미리보기 HTML 생성
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'master') {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
    }

    const { transaction_ids } = await request.json();
    if (!transaction_ids || !Array.isArray(transaction_ids) || transaction_ids.length === 0) {
      return NextResponse.json({ error: '거래를 선택하세요' }, { status: 400 });
    }

    // 선택된 거래들 조회 (customer 전체 정보 포함)
    const placeholders = transaction_ids.map((_: any, i: number) => `$${i + 1}`).join(',');
    const txns = await query(
      `SELECT t.*, c.company_name, c.contact_name, c.address as customer_address,
       c.tel as customer_tel, c.business_type as customer_business_type,
       c.business_category as customer_business_category, c.fax as customer_fax,
       c.reg_number as customer_reg_number, c.email as customer_email,
       TO_CHAR(t.date, 'YYYY-MM-DD') as date_formatted
       FROM transactions t
       JOIN customers c ON t.customer_id = c.id
       WHERE t.id IN (${placeholders})
       ORDER BY t.date, t.id`,
      transaction_ids
    );

    if (txns.length === 0) {
      return NextResponse.json({ error: '거래를 찾을 수 없습니다' }, { status: 404 });
    }

    // 같은 거래처인지 확인
    const customerIds = [...new Set(txns.map(t => t.customer_id))];
    if (customerIds.length > 1) {
      return NextResponse.json({ error: '같은 거래처의 거래만 선택하세요' }, { status: 400 });
    }

    const customerEmail = txns[0].customer_email;
    if (!customerEmail) {
      return NextResponse.json({ error: '해당 거래처에 이메일이 등록되지 않았습니다' }, { status: 400 });
    }

    // 모든 아이템 조회
    const allItems = [];
    for (const txn of txns) {
      const items = await query(
        'SELECT * FROM transaction_items WHERE transaction_id = $1 ORDER BY id',
        [txn.id]
      );
      for (const item of items) {
        allItems.push({
          product_name: item.product_name,
          spec: item.spec,
          unit: item.unit || '',
          qty: Number(item.qty),
          unit_price: Number(item.unit_price),
          amount: Number(item.amount),
          vat_apply: item.vat_apply,
          vat_amount: Number(item.vat_amount),
        });
      }
    }

    // 설정 조회
    const settingsRows = await query('SELECT * FROM settings WHERE id = 1');
    const settings = settingsRows[0];

    const supplyTotal = allItems.reduce((s, i) => s + i.amount, 0);
    const vatTotal = allItems.reduce((s, i) => s + i.vat_amount, 0);
    const grandTotal = supplyTotal + vatTotal;

    const dateRange = txns.length === 1
      ? txns[0].date_formatted
      : `${txns[0].date_formatted} ~ ${txns[txns.length - 1].date_formatted}`;

    const html = buildInvoiceEmailHtml({
      supplier: {
        company_name: settings?.company_name || '굿푸드시스템',
        rep_name: settings?.rep_name || '',
        reg_number: settings?.reg_number || '',
        address: settings?.address || '',
        business_type: settings?.business_type || '',
        tel: settings?.tel || '',
        fax: settings?.fax || '',
        bank_info: settings?.bank_info || '',
        print_operator: settings?.print_operator || '',
      },
      customer: {
        company_name: txns[0].company_name || '',
        contact_name: txns[0].contact_name || '',
        reg_number: txns[0].customer_reg_number || '',
        address: txns[0].customer_address || '',
        business_type: txns[0].customer_business_type || '',
        business_category: txns[0].customer_business_category || '',
        tel: txns[0].customer_tel || '',
        fax: txns[0].customer_fax || '',
      },
      date: dateRange,
      items: allItems,
      supplyTotal,
      vatTotal,
      grandTotal,
    });

    return NextResponse.json({
      html,
      to: customerEmail,
      subject: `[거래명세서] ${dateRange} - ${settings?.company_name || '굿푸드시스템'}`,
      txnIds: transaction_ids,
    });
  } catch (err) {
    console.error('Email preview error:', err);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
