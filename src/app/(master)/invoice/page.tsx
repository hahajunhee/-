'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer, ArrowLeft, Download } from 'lucide-react';
import Link from 'next/link';
import { Settings } from '@/types';
import { formatKRW } from '@/lib/calculator';

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
  customer: {
    company_name: string;
    contact_name: string;
    address: string;
    tel: string;
    business_type: string;
    business_category: string;
    fax: string;
    reg_number: string;
  };
  items: InvoiceItem[];
  supply_total: number;
  vat_total: number;
  grand_total: number;
}

// 한 페이지 분량의 거래명세서 렌더링
function InvoicePageSheet({
  settings,
  customer,
  date,
  items,
  supplyTotal,
  vatTotal,
  grandTotal,
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
  pageNum: number;
  totalPages: number;
}) {
  // 빈 행으로 15줄 채우기
  const emptyRows = Math.max(0, ITEMS_PER_PAGE - items.length);

  return (
    <div className="invoice-page bg-white w-[210mm] min-h-[297mm] mx-auto p-[15mm] pb-[10mm] border shadow-lg relative"
      style={{ pageBreakAfter: 'always', boxSizing: 'border-box' }}>

      {/* 제목 */}
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-[22px] font-bold tracking-[0.3em]">거 래 명 세 서</h1>
        <span className="text-[11px] text-gray-500">(공급받는자용)</span>
      </div>

      {/* 날짜 + 계좌 */}
      <div className="text-[11px] mb-3 border-b pb-2">
        <div className="flex justify-between">
          <span>거래일자 : {date}</span>
          <span>출력담당자 : {settings.print_operator}</span>
        </div>
        <p className="text-gray-600 mt-0.5">{settings.bank_info}</p>
      </div>

      {/* 공급자 / 공급받는자 */}
      <div className="grid grid-cols-2 gap-0 mb-4 text-[11px]">
        {/* 공급자 */}
        <table className="border-collapse w-full" style={{ borderSpacing: 0 }}>
          <tbody>
            <tr>
              <td rowSpan={4} className="border border-gray-500 px-1 py-0.5 w-[22px] text-center font-bold bg-gray-100 align-middle text-[10px]">
                공<br/>급<br/>자
              </td>
              <td className="border border-gray-500 px-2 py-[3px] bg-gray-100 w-[60px]">등록번호</td>
              <td className="border border-gray-500 px-2 py-[3px]" colSpan={3}>{settings.reg_number}</td>
            </tr>
            <tr>
              <td className="border border-gray-500 px-2 py-[3px] bg-gray-100">상 호</td>
              <td className="border border-gray-500 px-2 py-[3px]">{settings.company_name}</td>
              <td className="border border-gray-500 px-2 py-[3px] bg-gray-100 w-[40px]">성 명</td>
              <td className="border border-gray-500 px-2 py-[3px]">{settings.rep_name} (인)</td>
            </tr>
            <tr>
              <td className="border border-gray-500 px-2 py-[3px] bg-gray-100">주 소</td>
              <td className="border border-gray-500 px-2 py-[3px] text-[10px]" colSpan={3}>{settings.address}</td>
            </tr>
            <tr>
              <td className="border border-gray-500 px-2 py-[3px] bg-gray-100">업 태</td>
              <td className="border border-gray-500 px-2 py-[3px]">{settings.business_type}</td>
              <td className="border border-gray-500 px-2 py-[3px] bg-gray-100">TEL</td>
              <td className="border border-gray-500 px-2 py-[3px]">{settings.tel}</td>
            </tr>
          </tbody>
        </table>

        {/* 공급받는자 */}
        <table className="border-collapse w-full -ml-px" style={{ borderSpacing: 0 }}>
          <tbody>
            <tr>
              <td rowSpan={4} className="border border-gray-500 px-1 py-0.5 w-[22px] text-center font-bold bg-gray-100 align-middle text-[10px]">
                공<br/>급<br/>받<br/>는<br/>자
              </td>
              <td className="border border-gray-500 px-2 py-[3px] bg-gray-100 w-[60px]">등록번호</td>
              <td className="border border-gray-500 px-2 py-[3px]" colSpan={3}>{customer.reg_number}</td>
            </tr>
            <tr>
              <td className="border border-gray-500 px-2 py-[3px] bg-gray-100">상 호</td>
              <td className="border border-gray-500 px-2 py-[3px]">{customer.company_name}</td>
              <td className="border border-gray-500 px-2 py-[3px] bg-gray-100 w-[40px]">성 명</td>
              <td className="border border-gray-500 px-2 py-[3px]">{customer.contact_name} 귀하</td>
            </tr>
            <tr>
              <td className="border border-gray-500 px-2 py-[3px] bg-gray-100">주 소</td>
              <td className="border border-gray-500 px-2 py-[3px] text-[10px]" colSpan={3}>{customer.address}</td>
            </tr>
            <tr>
              <td className="border border-gray-500 px-2 py-[3px] bg-gray-100">업 태</td>
              <td className="border border-gray-500 px-2 py-[3px]">{customer.business_type}</td>
              <td className="border border-gray-500 px-2 py-[3px] bg-gray-100">TEL</td>
              <td className="border border-gray-500 px-2 py-[3px]">{customer.tel}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 품목 테이블 */}
      <table className="border-collapse w-full text-[11px] mb-3" style={{ borderSpacing: 0 }}>
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-500 px-2 py-[5px] w-[5%]">No</th>
            <th className="border border-gray-500 px-2 py-[5px] w-[28%]">품 목 명</th>
            <th className="border border-gray-500 px-2 py-[5px] w-[13%]">규 격</th>
            <th className="border border-gray-500 px-2 py-[5px] w-[6%]">단위</th>
            <th className="border border-gray-500 px-2 py-[5px] w-[8%]">수 량</th>
            <th className="border border-gray-500 px-2 py-[5px] w-[13%]">단 가</th>
            <th className="border border-gray-500 px-2 py-[5px] w-[15%]">금 액</th>
            <th className="border border-gray-500 px-2 py-[5px] w-[12%]">부가세</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx}>
              <td className="border border-gray-500 px-2 py-[4px] text-center">{(pageNum - 1) * ITEMS_PER_PAGE + idx + 1}</td>
              <td className="border border-gray-500 px-2 py-[4px]">{item.product_name}</td>
              <td className="border border-gray-500 px-2 py-[4px] text-center">{item.spec}</td>
              <td className="border border-gray-500 px-2 py-[4px] text-center">{item.unit}</td>
              <td className="border border-gray-500 px-2 py-[4px] text-right">{item.qty}</td>
              <td className="border border-gray-500 px-2 py-[4px] text-right">{formatKRW(item.unit_price)}</td>
              <td className="border border-gray-500 px-2 py-[4px] text-right">{formatKRW(item.amount)}</td>
              <td className="border border-gray-500 px-2 py-[4px] text-right">{item.vat_apply ? formatKRW(item.vat_amount) : '-'}</td>
            </tr>
          ))}
          {/* 빈 행 */}
          {Array.from({ length: emptyRows }).map((_, i) => (
            <tr key={`e-${i}`}>
              <td className="border border-gray-500 px-2 py-[4px]">&nbsp;</td>
              <td className="border border-gray-500 px-2 py-[4px]"></td>
              <td className="border border-gray-500 px-2 py-[4px]"></td>
              <td className="border border-gray-500 px-2 py-[4px]"></td>
              <td className="border border-gray-500 px-2 py-[4px]"></td>
              <td className="border border-gray-500 px-2 py-[4px]"></td>
              <td className="border border-gray-500 px-2 py-[4px]"></td>
              <td className="border border-gray-500 px-2 py-[4px]"></td>
            </tr>
          ))}
        </tbody>
        {/* 합계 행 (마지막 페이지만) */}
        <tfoot>
          <tr className="font-bold bg-gray-100">
            <td colSpan={5} className="border border-gray-500 px-2 py-[5px] text-center">합 계</td>
            <td className="border border-gray-500 px-2 py-[5px] text-right"></td>
            <td className="border border-gray-500 px-2 py-[5px] text-right">{formatKRW(supplyTotal)}</td>
            <td className="border border-gray-500 px-2 py-[5px] text-right">{formatKRW(vatTotal)}</td>
          </tr>
        </tfoot>
      </table>

      {/* 총액 */}
      <div className="flex justify-end mb-4">
        <table className="border-collapse text-[12px]" style={{ borderSpacing: 0 }}>
          <tbody>
            <tr>
              <td className="border border-gray-500 px-4 py-[5px] bg-gray-100 font-bold">총 액 (부가세 포함)</td>
              <td className="border border-gray-500 px-4 py-[5px] text-right font-bold text-[14px] min-w-[150px]">
                {formatKRW(grandTotal)}원
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 페이지 번호 */}
      {totalPages > 1 && (
        <div className="absolute bottom-[8mm] left-0 right-0 text-center text-[10px] text-gray-400">
          {pageNum} / {totalPages}
        </div>
      )}
    </div>
  );
}

function InvoiceContent() {
  const searchParams = useSearchParams();
  const singleId = searchParams.get('id');
  const multiIds = searchParams.get('ids');
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    const ids = multiIds ? multiIds.split(',') : singleId ? [singleId] : [];
    if (ids.length === 0) return;

    const sRes = await fetch('/api/settings');
    setSettings(await sRes.json());

    const allItems: InvoiceItem[] = [];
    let customer: InvoiceData['customer'] | null = null;
    let dateMin = '', dateMax = '';

    for (const id of ids) {
      const res = await fetch(`/api/transactions/${id}`);
      if (!res.ok) continue;
      const txn = await res.json();
      if (!customer) customer = txn.customer;
      const txnDate = txn.date_formatted || txn.date?.split('T')[0] || '';
      if (!dateMin || txnDate < dateMin) dateMin = txnDate;
      if (!dateMax || txnDate > dateMax) dateMax = txnDate;
      if (txn.items) {
        for (const item of txn.items) {
          allItems.push({
            product_name: item.product_name,
            spec: item.spec,
            unit: item.unit,
            qty: Number(item.qty),
            unit_price: Number(item.unit_price),
            amount: Number(item.amount),
            vat_apply: item.vat_apply,
            vat_amount: Number(item.vat_amount),
          });
        }
      }
    }

    if (customer && allItems.length > 0) {
      const supplyTotal = allItems.reduce((s, i) => s + i.amount, 0);
      const vatTotal = allItems.reduce((s, i) => s + i.vat_amount, 0);
      setInvoiceData({
        date: dateMin === dateMax ? dateMin : `${dateMin} ~ ${dateMax}`,
        customer,
        items: allItems,
        supply_total: supplyTotal,
        vat_total: vatTotal,
        grand_total: supplyTotal + vatTotal,
      });
    }
    setLoading(false);
  }, [singleId, multiIds]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // PDF 다운로드
  const downloadPdf = async () => {
    if (!invoiceRef.current) return;
    setPdfLoading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const pages = invoiceRef.current.querySelectorAll('.invoice-page');
      const pdf = new jsPDF('p', 'mm', 'a4');

      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i] as HTMLElement, {
          scale: 2,
          useCORS: true,
          logging: false,
        });
        const imgData = canvas.toDataURL('image/png');
        const pdfWidth = 210;
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      }

      const customerName = invoiceData?.customer.company_name || '거래처';
      const date = invoiceData?.date || '';
      pdf.save(`거래명세서_${customerName}_${date}.pdf`);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('PDF 생성에 실패했습니다');
    }
    setPdfLoading(false);
  };

  if (loading) return <div className="p-8 text-center text-gray-400">불러오는 중...</div>;
  if (!invoiceData || !settings) return <div className="p-8 text-center text-red-500">거래 데이터를 찾을 수 없습니다</div>;

  // 페이지별로 아이템 분할
  const pages: InvoiceItem[][] = [];
  for (let i = 0; i < invoiceData.items.length; i += ITEMS_PER_PAGE) {
    pages.push(invoiceData.items.slice(i, i + ITEMS_PER_PAGE));
  }
  if (pages.length === 0) pages.push([]);

  return (
    <>
      {/* 액션 바 */}
      <div className="flex items-center justify-between mb-6 no-print">
        <Link href="/transactions" className="btn-secondary">
          <ArrowLeft size={16} /> 목록으로
        </Link>
        <div className="flex gap-2">
          <button onClick={downloadPdf} disabled={pdfLoading} className="btn-success">
            <Download size={16} /> {pdfLoading ? 'PDF 생성 중...' : 'PDF 다운로드'}
          </button>
          <button onClick={() => window.print()} className="btn-primary">
            <Printer size={16} /> 인쇄
          </button>
        </div>
      </div>

      {/* 명세서 페이지들 */}
      <div ref={invoiceRef} className="space-y-6 print:space-y-0">
        {pages.map((pageItems, idx) => (
          <InvoicePageSheet
            key={idx}
            settings={settings}
            customer={invoiceData.customer}
            date={invoiceData.date}
            items={pageItems}
            supplyTotal={invoiceData.supply_total}
            vatTotal={invoiceData.vat_total}
            grandTotal={invoiceData.grand_total}
            pageNum={idx + 1}
            totalPages={pages.length}
          />
        ))}
      </div>
    </>
  );
}

export default function InvoicePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">불러오는 중...</div>}>
      <InvoiceContent />
    </Suspense>
  );
}
