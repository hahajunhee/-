'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer, ArrowLeft, Download, Mail } from 'lucide-react';
import Link from 'next/link';
import { Settings } from '@/types';
import { formatKRW } from '@/lib/calculator';
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE = 15;

interface InvoiceItem {
  product_name: string;
  spec: string;
  unit: string;
  qty: number;
  unit_price: number;
  amount: number;
  vat_apply: boolean;
  vat_amount: number;
}

interface InvoiceData {
  date: string;
  txnIds: number[];
  customer_id: number;
  customer: {
    company_name: string;
    contact_name: string;
    address: string;
    tel: string;
    business_type: string;
    business_category: string;
    fax: string;
    reg_number: string;
    email?: string;
  };
  items: InvoiceItem[];
  supply_total: number;
  vat_total: number;
  grand_total: number;
  previous_balance: number;
}

// ===== 한 페이지 분량의 거래명세서 =====
function InvoicePageSheet({
  settings,
  customer,
  date,
  items,
  supplyTotal,
  vatTotal,
  grandTotal,
  previousBalance,
  totalQtyAll,
  pageNum,
  totalPages,
}: {
  settings: Settings;
  customer: InvoiceData['customer'];
  date: string;
  items: InvoiceItem[];
  supplyTotal: number;
  vatTotal: number;
  grandTotal: number;
  previousBalance: number;
  totalQtyAll: number;
  pageNum: number;
  totalPages: number;
}) {
  const emptyRows = Math.max(0, ITEMS_PER_PAGE - items.length);

  // Balance calculations
  const subtotal = supplyTotal + vatTotal; // 합계금액
  const totalAmount = previousBalance + subtotal; // 총액
  const todayPayment = 0; // 금일입금액
  const todayBalance = totalAmount - todayPayment; // 금일잔액

  const bd = '1px solid #555';
  const cp = '4px 8px'; // cell padding
  const hdrBg = '#f3f4f6';

  return (
    <div
      className="invoice-page"
      style={{
        background: 'white',
        width: '794px',
        minHeight: '1123px',
        margin: '0 auto',
        padding: '40px 45px 30px 45px',
        position: 'relative',
        boxSizing: 'border-box',
        fontFamily: "'맑은 고딕', 'Malgun Gothic', sans-serif",
        fontSize: '11px',
        color: '#000',
      }}
    >
      {/* 제목 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 'bold', letterSpacing: '0.3em', margin: 0 }}>거 래 명 세 서</h1>
        <span style={{ fontSize: '11px', color: '#888' }}>(공급받는자용)</span>
      </div>

      {/* 날짜 + 계좌 */}
      <div style={{ marginBottom: '12px', borderBottom: '1px solid #ccc', paddingBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>거래일자 : {date}</span>
          <span>출력담당자 : {settings.print_operator}</span>
        </div>
        <p style={{ color: '#666', margin: '4px 0 0 0' }}>{settings.bank_info}</p>
      </div>

      {/* 공급자 / 공급받는자 */}
      <div style={{ display: 'flex', marginBottom: '16px' }}>
        {/* 공급자 */}
        <table style={{ borderCollapse: 'collapse', width: '50%' }} cellPadding={0} cellSpacing={0}>
          <tbody>
            <tr>
              <td rowSpan={4} style={{ border: bd, padding: '2px', width: '22px', textAlign: 'center', fontWeight: 'bold', background: hdrBg, verticalAlign: 'middle', fontSize: '10px', lineHeight: '1.4' }}>
                공<br/>급<br/>자
              </td>
              <td style={{ border: bd, padding: cp, background: hdrBg, width: '55px' }}>등록번호</td>
              <td colSpan={3} style={{ border: bd, padding: cp }}>{settings.reg_number}</td>
            </tr>
            <tr>
              <td style={{ border: bd, padding: cp, background: hdrBg }}>상 호</td>
              <td style={{ border: bd, padding: cp }}>{settings.company_name}</td>
              <td style={{ border: bd, padding: cp, background: hdrBg, width: '40px' }}>성 명</td>
              <td style={{ border: bd, padding: cp, position: 'relative' }}>
                <span>{settings.rep_name}</span>
                {settings.seal_image ? (
                  <img src={settings.seal_image} alt="인" crossOrigin="anonymous"
                    style={{ display: 'inline-block', width: '32px', height: '32px', objectFit: 'contain', marginLeft: '6px', verticalAlign: 'middle' }} />
                ) : (
                  <span style={{ marginLeft: '4px' }}>(인)</span>
                )}
              </td>
            </tr>
            <tr>
              <td style={{ border: bd, padding: cp, background: hdrBg }}>주 소</td>
              <td colSpan={3} style={{ border: bd, padding: cp, fontSize: '10px' }}>{settings.address}</td>
            </tr>
            <tr>
              <td style={{ border: bd, padding: cp, background: hdrBg }}>업 태</td>
              <td style={{ border: bd, padding: cp }}>{settings.business_type}</td>
              <td style={{ border: bd, padding: cp, background: hdrBg }}>TEL</td>
              <td style={{ border: bd, padding: cp }}>{settings.tel}</td>
            </tr>
          </tbody>
        </table>

        {/* 공급받는자 */}
        <table style={{ borderCollapse: 'collapse', width: '50%', marginLeft: '-1px' }} cellPadding={0} cellSpacing={0}>
          <tbody>
            <tr>
              <td rowSpan={4} style={{ border: bd, padding: '2px', width: '22px', textAlign: 'center', fontWeight: 'bold', background: hdrBg, verticalAlign: 'middle', fontSize: '10px', lineHeight: '1.2' }}>
                공<br/>급<br/>받<br/>는<br/>자
              </td>
              <td style={{ border: bd, padding: cp, background: hdrBg, width: '55px' }}>등록번호</td>
              <td colSpan={3} style={{ border: bd, padding: cp }}>{customer.reg_number}</td>
            </tr>
            <tr>
              <td style={{ border: bd, padding: cp, background: hdrBg }}>상 호</td>
              <td style={{ border: bd, padding: cp }}>{customer.company_name}</td>
              <td style={{ border: bd, padding: cp, background: hdrBg, width: '40px' }}>성 명</td>
              <td style={{ border: bd, padding: cp }}>{customer.contact_name} 귀하</td>
            </tr>
            <tr>
              <td style={{ border: bd, padding: cp, background: hdrBg }}>주 소</td>
              <td colSpan={3} style={{ border: bd, padding: cp, fontSize: '10px' }}>{customer.address}</td>
            </tr>
            <tr>
              <td style={{ border: bd, padding: cp, background: hdrBg }}>업 태</td>
              <td style={{ border: bd, padding: cp }}>{customer.business_type}</td>
              <td style={{ border: bd, padding: cp, background: hdrBg }}>TEL</td>
              <td style={{ border: bd, padding: cp }}>{customer.tel}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 품목 테이블 */}
      <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '0' }} cellPadding={0} cellSpacing={0}>
        <thead>
          <tr style={{ background: hdrBg }}>
            <th style={{ border: bd, padding: '5px 8px', width: '5%', textAlign: 'center' }}>No</th>
            <th style={{ border: bd, padding: '5px 8px', width: '28%', textAlign: 'center' }}>품 목 명</th>
            <th style={{ border: bd, padding: '5px 8px', width: '13%', textAlign: 'center' }}>규 격</th>
            <th style={{ border: bd, padding: '5px 8px', width: '6%', textAlign: 'center' }}>단위</th>
            <th style={{ border: bd, padding: '5px 8px', width: '8%', textAlign: 'center' }}>수 량</th>
            <th style={{ border: bd, padding: '5px 8px', width: '13%', textAlign: 'center' }}>단 가</th>
            <th style={{ border: bd, padding: '5px 8px', width: '15%', textAlign: 'center' }}>금 액</th>
            <th style={{ border: bd, padding: '5px 8px', width: '12%', textAlign: 'center' }}>부가세</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx}>
              <td style={{ border: bd, padding: cp, textAlign: 'center' }}>{(pageNum - 1) * ITEMS_PER_PAGE + idx + 1}</td>
              <td style={{ border: bd, padding: cp }}>{item.product_name}</td>
              <td style={{ border: bd, padding: cp, textAlign: 'center' }}>{item.spec}</td>
              <td style={{ border: bd, padding: cp, textAlign: 'center' }}>{item.unit}</td>
              <td style={{ border: bd, padding: cp, textAlign: 'right' }}>{item.qty}</td>
              <td style={{ border: bd, padding: cp, textAlign: 'right' }}>{formatKRW(item.unit_price)}</td>
              <td style={{ border: bd, padding: cp, textAlign: 'right' }}>{formatKRW(item.amount)}</td>
              <td style={{ border: bd, padding: cp, textAlign: 'right' }}>{item.vat_apply ? formatKRW(item.vat_amount) : '-'}</td>
            </tr>
          ))}
          {Array.from({ length: emptyRows }).map((_, i) => (
            <tr key={`e-${i}`}>
              <td style={{ border: bd, padding: cp }}>&nbsp;</td>
              <td style={{ border: bd, padding: cp }}></td>
              <td style={{ border: bd, padding: cp }}></td>
              <td style={{ border: bd, padding: cp }}></td>
              <td style={{ border: bd, padding: cp }}></td>
              <td style={{ border: bd, padding: cp }}></td>
              <td style={{ border: bd, padding: cp }}></td>
              <td style={{ border: bd, padding: cp }}></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: hdrBg, fontWeight: 'bold' }}>
            <td colSpan={4} style={{ border: bd, padding: '5px 8px', textAlign: 'center' }}>총 합 계</td>
            <td style={{ border: bd, padding: '5px 8px', textAlign: 'right' }}>{totalQtyAll}</td>
            <td style={{ border: bd, padding: '5px 8px', textAlign: 'right' }}></td>
            <td style={{ border: bd, padding: '5px 8px', textAlign: 'right' }}>{formatKRW(supplyTotal)}</td>
            <td style={{ border: bd, padding: '5px 8px', textAlign: 'right' }}>{formatKRW(vatTotal)}</td>
          </tr>
        </tfoot>
      </table>

      {/* 하단 잔액 요약 (모든 페이지 동일) */}
      <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: '-1px' }} cellPadding={0} cellSpacing={0}>
        <thead>
          <tr style={{ background: hdrBg }}>
            <th style={{ border: bd, padding: '5px 4px', width: '14.28%', textAlign: 'center' }}>전일잔액</th>
            <th style={{ border: bd, padding: '5px 4px', width: '14.28%', textAlign: 'center' }}>공급가액</th>
            <th style={{ border: bd, padding: '5px 4px', width: '14.28%', textAlign: 'center' }}>부가세</th>
            <th style={{ border: bd, padding: '5px 4px', width: '14.28%', textAlign: 'center' }}>합계금액</th>
            <th style={{ border: bd, padding: '5px 4px', width: '14.28%', textAlign: 'center' }}>총 액</th>
            <th style={{ border: bd, padding: '5px 4px', width: '14.28%', textAlign: 'center' }}>금일입금액</th>
            <th style={{ border: bd, padding: '5px 4px', width: '14.28%', textAlign: 'center' }}>금일잔액</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ border: bd, padding: '6px 4px', textAlign: 'right', fontWeight: 'bold' }}>{formatKRW(previousBalance)}</td>
            <td style={{ border: bd, padding: '6px 4px', textAlign: 'right', fontWeight: 'bold' }}>{formatKRW(supplyTotal)}</td>
            <td style={{ border: bd, padding: '6px 4px', textAlign: 'right', fontWeight: 'bold' }}>{formatKRW(vatTotal)}</td>
            <td style={{ border: bd, padding: '6px 4px', textAlign: 'right', fontWeight: 'bold' }}>{formatKRW(subtotal)}</td>
            <td style={{ border: bd, padding: '6px 4px', textAlign: 'right', fontWeight: 'bold' }}>{formatKRW(totalAmount)}</td>
            <td style={{ border: bd, padding: '6px 4px', textAlign: 'right', fontWeight: 'bold' }}>{formatKRW(todayPayment)}</td>
            <td style={{ border: bd, padding: '6px 4px', textAlign: 'right', fontWeight: 'bold' }}>{formatKRW(todayBalance)}</td>
          </tr>
        </tbody>
      </table>

      {/* 하단 메모 (모든 페이지 동일) */}
      {settings.invoice_note && (
        <p style={{ marginTop: '8px', fontSize: '11px', color: '#059669', fontWeight: 'bold' }}>
          {settings.invoice_note}
        </p>
      )}

      {/* 페이지 번호 */}
      {totalPages > 1 && (
        <div style={{ position: 'absolute', bottom: '20px', left: 0, right: 0, textAlign: 'center', fontSize: '10px', color: '#999' }}>
          {pageNum} / {totalPages}
        </div>
      )}
    </div>
  );
}

// ===== 메인 거래명세서 컨텐츠 =====
function InvoiceContent() {
  const searchParams = useSearchParams();
  const singleId = searchParams.get('id');
  const multiIds = searchParams.get('ids');
  const emailMode = searchParams.get('email') === 'true';
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    const ids = multiIds ? multiIds.split(',').map(Number) : singleId ? [Number(singleId)] : [];
    if (ids.length === 0) return;

    try {
      const sRes = await fetch('/api/settings');
      setSettings(await sRes.json());

      const allItems: InvoiceItem[] = [];
      let customer: InvoiceData['customer'] | null = null;
      let customerId = 0;
      let dateMin = '', dateMax = '';

      for (const id of ids) {
        const res = await fetch(`/api/transactions/${id}`);
        if (!res.ok) continue;
        const txn = await res.json();
        if (!customer) {
          customer = txn.customer;
          customerId = txn.customer_id;
        }
        const txnDate = txn.date_formatted || txn.date?.split('T')[0] || '';
        if (!dateMin || txnDate < dateMin) dateMin = txnDate;
        if (!dateMax || txnDate > dateMax) dateMax = txnDate;
        if (txn.items) {
          for (const item of txn.items) {
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
      }

      // 전일잔액 조회
      let previousBalance = 0;
      if (customerId) {
        try {
          const balRes = await fetch(`/api/customers/${customerId}/balance?exclude_ids=${ids.join(',')}`);
          const balData = await balRes.json();
          previousBalance = Number(balData.balance) || 0;
        } catch {}
      }

      if (customer && allItems.length > 0) {
        const supplyTotal = allItems.reduce((s, i) => s + i.amount, 0);
        const vatTotal = allItems.reduce((s, i) => s + i.vat_amount, 0);
        setInvoiceData({
          date: dateMin === dateMax ? dateMin : `${dateMin} ~ ${dateMax}`,
          txnIds: ids,
          customer_id: customerId,
          customer,
          items: allItems,
          supply_total: supplyTotal,
          vat_total: vatTotal,
          grand_total: supplyTotal + vatTotal,
          previous_balance: previousBalance,
        });
      }
    } catch (err) {
      console.error('Invoice fetch error:', err);
    }
    setLoading(false);
  }, [singleId, multiIds]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // PDF 생성 (base64 반환)
  const generatePdfBase64 = async (): Promise<string | null> => {
    if (!invoiceRef.current) return null;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const pages = invoiceRef.current.querySelectorAll('.invoice-page');
      if (pages.length === 0) return null;

      const pdf = new jsPDF('p', 'mm', 'a4');

      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i] as HTMLElement, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: 794,
          windowWidth: 794,
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdfWidth = 210;
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      }

      return pdf.output('datauristring').split(',')[1]; // base64 only
    } catch (err) {
      console.error('PDF generation error:', err);
      return null;
    }
  };

  // PDF 다운로드
  const downloadPdf = async () => {
    if (!invoiceRef.current) return;
    setPdfLoading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const pages = invoiceRef.current.querySelectorAll('.invoice-page');
      if (pages.length === 0) { setPdfLoading(false); return; }

      const pdf = new jsPDF('p', 'mm', 'a4');

      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i] as HTMLElement, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: 794,
          windowWidth: 794,
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdfWidth = 210;
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      }

      const customerName = invoiceData?.customer.company_name || '거래처';
      const date = invoiceData?.date || '';
      pdf.save(`거래명세서_${customerName}_${date}.pdf`);
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('PDF 생성에 실패했습니다');
    }
    setPdfLoading(false);
  };

  // 이메일 발송 (PDF 첨부)
  const sendEmail = async () => {
    if (!invoiceData) return;
    setEmailSending(true);
    try {
      // PDF 생성
      toast('PDF 생성 중...', { icon: '📄' });
      const pdfBase64 = await generatePdfBase64();
      if (!pdfBase64) {
        toast.error('PDF 생성에 실패했습니다');
        setEmailSending(false);
        return;
      }

      // 이메일 발송
      toast('이메일 발송 중...', { icon: '📧' });
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_ids: invoiceData.txnIds,
          pdf_base64: pdfBase64,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || '이메일이 발송되었습니다');
      } else {
        toast.error(data.error || '이메일 발송 실패');
      }
    } catch (err) {
      console.error('Email send error:', err);
      toast.error('서버 연결 오류');
    }
    setEmailSending(false);
  };

  if (loading) return <div style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>불러오는 중...</div>;
  if (!invoiceData || !settings) return <div style={{ padding: '32px', textAlign: 'center', color: '#ef4444' }}>거래 데이터를 찾을 수 없습니다</div>;

  // 페이지별로 아이템 분할
  const pages: InvoiceItem[][] = [];
  for (let i = 0; i < invoiceData.items.length; i += ITEMS_PER_PAGE) {
    pages.push(invoiceData.items.slice(i, i + ITEMS_PER_PAGE));
  }
  if (pages.length === 0) pages.push([]);

  const totalQtyAll = invoiceData.items.reduce((s, i) => s + i.qty, 0);

  return (
    <>
      {/* 액션 바 */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <Link href="/transactions" className="btn-secondary">
          <ArrowLeft size={16} /> 목록으로
        </Link>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={downloadPdf} disabled={pdfLoading} className="btn-primary">
            <Download size={16} /> {pdfLoading ? 'PDF 생성 중...' : 'PDF 다운로드'}
          </button>
          <button onClick={() => window.print()} className="btn-secondary">
            <Printer size={16} /> 인쇄
          </button>
          <button onClick={sendEmail} disabled={emailSending} className="btn-success">
            <Mail size={16} /> {emailSending ? '발송 중...' : '이메일 발송 (PDF 첨부)'}
          </button>
        </div>
      </div>

      {/* 명세서 페이지들 */}
      <div ref={invoiceRef} id="invoice-pages">
        {pages.map((pageItems, idx) => (
          <div key={idx} style={{ marginBottom: idx < pages.length - 1 ? '24px' : '0' }}>
            <InvoicePageSheet
              settings={settings}
              customer={invoiceData.customer}
              date={invoiceData.date}
              items={pageItems}
              supplyTotal={invoiceData.supply_total}
              vatTotal={invoiceData.vat_total}
              grandTotal={invoiceData.grand_total}
              previousBalance={invoiceData.previous_balance}
              totalQtyAll={totalQtyAll}
              pageNum={idx + 1}
              totalPages={pages.length}
            />
          </div>
        ))}
      </div>
    </>
  );
}

export default function InvoicePage() {
  return (
    <Suspense fallback={<div style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>불러오는 중...</div>}>
      <InvoiceContent />
    </Suspense>
  );
}
