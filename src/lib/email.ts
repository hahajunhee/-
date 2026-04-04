import nodemailer from 'nodemailer';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    console.log('[EMAIL MOCK] To:', to, 'Subject:', subject);
    return { success: true, mock: true };
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  try {
    const info = await transporter.sendMail({
      from: `거래관리시스템 <${user}>`,
      to,
      subject,
      html,
    });
    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error };
  }
}

export function buildInvoiceEmailHtml(params: {
  supplierName: string;
  customerName: string;
  date: string;
  items: { product_name: string; spec: string; qty: number; unit_price: number; amount: number; vat_apply: boolean; vat_amount: number }[];
  supplyTotal: number;
  vatTotal: number;
  grandTotal: number;
}) {
  const fmt = (n: number) => new Intl.NumberFormat('ko-KR').format(n);
  const itemRows = params.items.map(i =>
    `<tr>
      <td style="padding:8px;border:1px solid #ddd">${i.product_name}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center">${i.spec}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:right">${i.qty}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:right">${fmt(i.unit_price)}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:right">${fmt(i.amount)}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:right">${i.vat_apply ? fmt(i.vat_amount) : '-'}</td>
    </tr>`
  ).join('');

  return `
    <div style="font-family:'맑은 고딕',sans-serif;max-width:700px;margin:0 auto;padding:20px">
      <h2 style="color:#1e40af;border-bottom:2px solid #1e40af;padding-bottom:8px">거 래 명 세 서</h2>
      <p><strong>공급자:</strong> ${params.supplierName}</p>
      <p><strong>공급받는자:</strong> ${params.customerName}</p>
      <p><strong>거래일자:</strong> ${params.date}</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0">
        <thead>
          <tr style="background:#f3f4f6">
            <th style="padding:8px;border:1px solid #ddd">품목명</th>
            <th style="padding:8px;border:1px solid #ddd">규격</th>
            <th style="padding:8px;border:1px solid #ddd">수량</th>
            <th style="padding:8px;border:1px solid #ddd">단가</th>
            <th style="padding:8px;border:1px solid #ddd">금액</th>
            <th style="padding:8px;border:1px solid #ddd">부가세</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
        <tfoot>
          <tr style="background:#f3f4f6;font-weight:bold">
            <td colspan="4" style="padding:8px;border:1px solid #ddd;text-align:center">합 계</td>
            <td style="padding:8px;border:1px solid #ddd;text-align:right">${fmt(params.supplyTotal)}</td>
            <td style="padding:8px;border:1px solid #ddd;text-align:right">${fmt(params.vatTotal)}</td>
          </tr>
        </tfoot>
      </table>
      <div style="text-align:right;margin-top:10px">
        <p style="font-size:18px;color:#1e40af">총 액 (부가세 포함): <strong>${fmt(params.grandTotal)}원</strong></p>
      </div>
      <hr style="margin:20px 0"/>
      <p style="color:#6b7280;font-size:12px">본 메일은 ${params.supplierName} 거래관리 시스템에서 자동 발송되었습니다.</p>
    </div>
  `;
}

export function buildOrderEmailHtml(params: {
  customerName: string;
  orderNumber: string;
  date: string;
  items: { product_name: string; spec: string; qty: number; unit_price: number; amount: number }[];
  grandTotal: number;
  notes: string;
}) {
  const fmt = (n: number) => new Intl.NumberFormat('ko-KR').format(n);
  const itemRows = params.items.map(i =>
    `<tr>
      <td style="padding:8px;border:1px solid #ddd">${i.product_name}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center">${i.spec}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:right">${i.qty}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:right">${fmt(i.unit_price)}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:right">${fmt(i.amount)}</td>
    </tr>`
  ).join('');

  return `
    <div style="font-family:'맑은 고딕',sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <h2 style="color:#059669">발주서 접수 알림</h2>
      <p><strong>발주번호:</strong> ${params.orderNumber}</p>
      <p><strong>발주처:</strong> ${params.customerName}</p>
      <p><strong>발주일자:</strong> ${params.date}</p>
      ${params.notes ? `<p><strong>비고:</strong> ${params.notes}</p>` : ''}
      <table style="width:100%;border-collapse:collapse;margin:20px 0">
        <thead>
          <tr style="background:#f3f4f6">
            <th style="padding:8px;border:1px solid #ddd">품목명</th>
            <th style="padding:8px;border:1px solid #ddd">규격</th>
            <th style="padding:8px;border:1px solid #ddd">수량</th>
            <th style="padding:8px;border:1px solid #ddd">단가</th>
            <th style="padding:8px;border:1px solid #ddd">금액</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <p style="font-size:18px;text-align:right;color:#059669">합계: <strong>${fmt(params.grandTotal)}원</strong></p>
      <hr style="margin:20px 0"/>
      <p style="color:#6b7280;font-size:12px">본 메일은 거래관리 시스템에서 자동 발송되었습니다.</p>
    </div>
  `;
}
