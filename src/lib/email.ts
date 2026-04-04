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
  supplier: {
    company_name: string;
    rep_name: string;
    reg_number: string;
    address: string;
    business_type: string;
    tel: string;
    fax: string;
    bank_info: string;
    print_operator: string;
  };
  customer: {
    company_name: string;
    contact_name: string;
    reg_number: string;
    address: string;
    business_type: string;
    business_category: string;
    tel: string;
    fax: string;
  };
  date: string;
  items: { product_name: string; spec: string; unit: string; qty: number; unit_price: number; amount: number; vat_apply: boolean; vat_amount: number }[];
  supplyTotal: number;
  vatTotal: number;
  grandTotal: number;
}) {
  const fmt = (n: number) => new Intl.NumberFormat('ko-KR').format(n);
  const ITEMS_PER_PAGE = 15;
  const { supplier, customer, items } = params;

  // 페이지별로 아이템 분할
  const pages: typeof items[] = [];
  for (let i = 0; i < items.length; i += ITEMS_PER_PAGE) {
    pages.push(items.slice(i, i + ITEMS_PER_PAGE));
  }
  if (pages.length === 0) pages.push([]);
  const totalPages = pages.length;

  const cellStyle = 'padding:4px 8px;border:1px solid #666;font-size:11px;';
  const headerCellStyle = `${cellStyle}background:#f3f4f6;`;

  const renderPage = (pageItems: typeof items, pageNum: number) => {
    const emptyRows = Math.max(0, ITEMS_PER_PAGE - pageItems.length);

    const itemRows = pageItems.map((item, idx) =>
      `<tr>
        <td style="${cellStyle}text-align:center">${(pageNum - 1) * ITEMS_PER_PAGE + idx + 1}</td>
        <td style="${cellStyle}">${item.product_name}</td>
        <td style="${cellStyle}text-align:center">${item.spec}</td>
        <td style="${cellStyle}text-align:center">${item.unit}</td>
        <td style="${cellStyle}text-align:right">${item.qty}</td>
        <td style="${cellStyle}text-align:right">${fmt(item.unit_price)}</td>
        <td style="${cellStyle}text-align:right">${fmt(item.amount)}</td>
        <td style="${cellStyle}text-align:right">${item.vat_apply ? fmt(item.vat_amount) : '-'}</td>
      </tr>`
    ).join('');

    const emptyRowsHtml = Array.from({ length: emptyRows }).map(() =>
      `<tr>
        <td style="${cellStyle}">&nbsp;</td>
        <td style="${cellStyle}"></td>
        <td style="${cellStyle}"></td>
        <td style="${cellStyle}"></td>
        <td style="${cellStyle}"></td>
        <td style="${cellStyle}"></td>
        <td style="${cellStyle}"></td>
        <td style="${cellStyle}"></td>
      </tr>`
    ).join('');

    return `
    <div style="font-family:'맑은 고딕','Malgun Gothic',sans-serif;max-width:700px;margin:0 auto;padding:20px;${pageNum > 1 ? 'page-break-before:always;margin-top:30px;' : ''}">
      <!-- 제목 -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <h1 style="font-size:22px;font-weight:bold;letter-spacing:0.3em;margin:0">거 래 명 세 서</h1>
        <span style="font-size:11px;color:#888">(공급받는자용)</span>
      </div>

      <!-- 날짜 + 계좌 -->
      <div style="font-size:11px;margin-bottom:12px;border-bottom:1px solid #ccc;padding-bottom:8px">
        <div style="display:flex;justify-content:space-between">
          <span>거래일자 : ${params.date}</span>
          <span>출력담당자 : ${supplier.print_operator || ''}</span>
        </div>
        <p style="color:#666;margin:4px 0 0 0">${supplier.bank_info || ''}</p>
      </div>

      <!-- 공급자 / 공급받는자 -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px" cellpadding="0" cellspacing="0">
        <tr>
          <!-- 공급자 -->
          <td style="vertical-align:top;width:50%">
            <table style="width:100%;border-collapse:collapse" cellpadding="0" cellspacing="0">
              <tr>
                <td rowspan="4" style="${headerCellStyle}width:22px;text-align:center;font-weight:bold;vertical-align:middle;font-size:10px;line-height:1.4">공<br/>급<br/>자</td>
                <td style="${headerCellStyle}width:55px">등록번호</td>
                <td colspan="3" style="${cellStyle}">${supplier.reg_number}</td>
              </tr>
              <tr>
                <td style="${headerCellStyle}">상 호</td>
                <td style="${cellStyle}">${supplier.company_name}</td>
                <td style="${headerCellStyle}width:40px">성 명</td>
                <td style="${cellStyle}">${supplier.rep_name} (인)</td>
              </tr>
              <tr>
                <td style="${headerCellStyle}">주 소</td>
                <td colspan="3" style="${cellStyle}font-size:10px">${supplier.address}</td>
              </tr>
              <tr>
                <td style="${headerCellStyle}">업 태</td>
                <td style="${cellStyle}">${supplier.business_type}</td>
                <td style="${headerCellStyle}">TEL</td>
                <td style="${cellStyle}">${supplier.tel}</td>
              </tr>
            </table>
          </td>
          <!-- 공급받는자 -->
          <td style="vertical-align:top;width:50%">
            <table style="width:100%;border-collapse:collapse" cellpadding="0" cellspacing="0">
              <tr>
                <td rowspan="4" style="${headerCellStyle}width:22px;text-align:center;font-weight:bold;vertical-align:middle;font-size:10px;line-height:1.2">공<br/>급<br/>받<br/>는<br/>자</td>
                <td style="${headerCellStyle}width:55px">등록번호</td>
                <td colspan="3" style="${cellStyle}">${customer.reg_number || ''}</td>
              </tr>
              <tr>
                <td style="${headerCellStyle}">상 호</td>
                <td style="${cellStyle}">${customer.company_name}</td>
                <td style="${headerCellStyle}width:40px">성 명</td>
                <td style="${cellStyle}">${customer.contact_name || ''} 귀하</td>
              </tr>
              <tr>
                <td style="${headerCellStyle}">주 소</td>
                <td colspan="3" style="${cellStyle}font-size:10px">${customer.address || ''}</td>
              </tr>
              <tr>
                <td style="${headerCellStyle}">업 태</td>
                <td style="${cellStyle}">${customer.business_type || ''}</td>
                <td style="${headerCellStyle}">TEL</td>
                <td style="${cellStyle}">${customer.tel || ''}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- 품목 테이블 -->
      <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:12px" cellpadding="0" cellspacing="0">
        <thead>
          <tr style="background:#f3f4f6">
            <th style="${cellStyle}width:5%;text-align:center">No</th>
            <th style="${cellStyle}width:28%;text-align:center">품 목 명</th>
            <th style="${cellStyle}width:13%;text-align:center">규 격</th>
            <th style="${cellStyle}width:6%;text-align:center">단위</th>
            <th style="${cellStyle}width:8%;text-align:center">수 량</th>
            <th style="${cellStyle}width:13%;text-align:center">단 가</th>
            <th style="${cellStyle}width:15%;text-align:center">금 액</th>
            <th style="${cellStyle}width:12%;text-align:center">부가세</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
          ${emptyRowsHtml}
        </tbody>
        <tfoot>
          <tr style="background:#f3f4f6;font-weight:bold">
            <td colspan="5" style="${cellStyle}text-align:center">합 계</td>
            <td style="${cellStyle}text-align:right"></td>
            <td style="${cellStyle}text-align:right">${fmt(params.supplyTotal)}</td>
            <td style="${cellStyle}text-align:right">${fmt(params.vatTotal)}</td>
          </tr>
        </tfoot>
      </table>

      <!-- 총액 -->
      <table style="margin-left:auto;border-collapse:collapse;font-size:12px" cellpadding="0" cellspacing="0">
        <tr>
          <td style="border:1px solid #666;padding:5px 16px;background:#f3f4f6;font-weight:bold">총 액 (부가세 포함)</td>
          <td style="border:1px solid #666;padding:5px 16px;text-align:right;font-weight:bold;font-size:14px;min-width:150px">${fmt(params.grandTotal)}원</td>
        </tr>
      </table>

      ${totalPages > 1 ? `<p style="text-align:center;font-size:10px;color:#999;margin-top:16px">${pageNum} / ${totalPages}</p>` : ''}
    </div>`;
  };

  const pagesHtml = pages.map((pageItems, idx) => renderPage(pageItems, idx + 1)).join('');

  return `
    <div style="background:#fff">
      ${pagesHtml}
      <hr style="margin:20px auto;max-width:700px;border:none;border-top:1px solid #ddd"/>
      <p style="color:#6b7280;font-size:12px;text-align:center;max-width:700px;margin:0 auto">본 메일은 ${supplier.company_name} 거래관리 시스템에서 자동 발송되었습니다.</p>
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
