'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Settings } from '@/types';
import { formatKRW } from '@/lib/calculator';

interface InvoiceData {
  date: string;
  date_formatted?: string;
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
  items: {
    product_name: string;
    spec: string;
    unit: string;
    qty: number;
    unit_price: number;
    amount: number;
    vat_apply: boolean;
    vat_amount: number;
  }[];
  supply_total: number;
  vat_total: number;
  grand_total: number;
}

function InvoiceContent() {
  const searchParams = useSearchParams();
  const singleId = searchParams.get('id');
  const multiIds = searchParams.get('ids');
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const ids = multiIds ? multiIds.split(',') : singleId ? [singleId] : [];
    if (ids.length === 0) return;

    // 설정 조회
    const sRes = await fetch('/api/settings');
    setSettings(await sRes.json());

    // 거래 데이터 조회
    const allItems: InvoiceData['items'] = [];
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

  if (loading) {
    return <div className="p-8 text-center text-gray-400">불러오는 중...</div>;
  }

  if (!invoiceData || !settings) {
    return <div className="p-8 text-center text-red-500">거래 데이터를 찾을 수 없습니다</div>;
  }

  const { customer } = invoiceData;

  return (
    <>
      <div className="flex items-center justify-between mb-6 no-print">
        <Link href="/transactions" className="btn-secondary">
          <ArrowLeft size={16} /> 목록으로
        </Link>
        <button onClick={() => window.print()} className="btn-primary">
          <Printer size={16} /> 인쇄
        </button>
      </div>

      <div className="invoice-print bg-white mx-auto max-w-[800px] p-8 shadow-lg border">
        <div className="flex justify-between items-start mb-6">
          <h1 className="text-2xl font-bold tracking-widest">거 래 명 세 서</h1>
          <span className="text-sm text-gray-500">(공급받는자용)</span>
        </div>

        <div className="text-sm mb-4">
          <p>거래 기간 : {invoiceData.date} , 출력담당자 : {settings.print_operator}</p>
          <p className="text-gray-500">{settings.bank_info} {settings.company_name}</p>
        </div>

        <div className="grid grid-cols-2 gap-0 mb-6">
          <div className="border border-gray-400 p-0">
            <table className="w-full text-sm border-collapse">
              <tbody>
                <tr>
                  <td rowSpan={4} className="border border-gray-400 px-2 py-1 w-8 text-center font-semibold bg-gray-50 align-middle">공<br/>급<br/>자</td>
                  <td className="border border-gray-400 px-2 py-1 bg-gray-50 w-20">등록번호</td>
                  <td className="border border-gray-400 px-2 py-1" colSpan={3}>{settings.reg_number}</td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-2 py-1 bg-gray-50">상호</td>
                  <td className="border border-gray-400 px-2 py-1">{settings.company_name}</td>
                  <td className="border border-gray-400 px-2 py-1 bg-gray-50 w-12">성명</td>
                  <td className="border border-gray-400 px-2 py-1">{settings.rep_name}</td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-2 py-1 bg-gray-50">주소</td>
                  <td className="border border-gray-400 px-2 py-1" colSpan={3}>{settings.address}</td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-2 py-1 bg-gray-50">업태</td>
                  <td className="border border-gray-400 px-2 py-1">{settings.business_type}</td>
                  <td className="border border-gray-400 px-2 py-1 bg-gray-50">TEL</td>
                  <td className="border border-gray-400 px-2 py-1">{settings.tel}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="border border-gray-400 border-l-0 p-0">
            <table className="w-full text-sm border-collapse">
              <tbody>
                <tr>
                  <td rowSpan={4} className="border border-gray-400 px-2 py-1 w-8 text-center font-semibold bg-gray-50 align-middle">받<br/>는<br/>자</td>
                  <td className="border border-gray-400 px-2 py-1 bg-gray-50 w-20">등록번호</td>
                  <td className="border border-gray-400 px-2 py-1" colSpan={3}>{customer?.reg_number}</td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-2 py-1 bg-gray-50">상호</td>
                  <td className="border border-gray-400 px-2 py-1">{customer?.company_name}</td>
                  <td className="border border-gray-400 px-2 py-1 bg-gray-50 w-12">성명</td>
                  <td className="border border-gray-400 px-2 py-1">{customer?.contact_name}</td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-2 py-1 bg-gray-50">주소</td>
                  <td className="border border-gray-400 px-2 py-1" colSpan={3}>{customer?.address}</td>
                </tr>
                <tr>
                  <td className="border border-gray-400 px-2 py-1 bg-gray-50">업태</td>
                  <td className="border border-gray-400 px-2 py-1">{customer?.business_category}</td>
                  <td className="border border-gray-400 px-2 py-1 bg-gray-50">TEL</td>
                  <td className="border border-gray-400 px-2 py-1">{customer?.tel}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <table className="invoice-table mb-4">
          <thead>
            <tr>
              <th className="w-[30%]">품 목 명</th>
              <th className="w-[15%]">규 격</th>
              <th className="w-[8%]">단위</th>
              <th className="w-[8%]">수량</th>
              <th className="w-[13%]">단가</th>
              <th className="w-[16%]">금 액</th>
              <th className="w-[10%]">부가세</th>
            </tr>
          </thead>
          <tbody>
            {invoiceData.items.map((item, idx) => (
              <tr key={idx}>
                <td>{item.product_name}</td>
                <td className="text-center">{item.spec}</td>
                <td className="text-center">{item.unit}</td>
                <td className="text-right">{item.qty}</td>
                <td className="text-right">{formatKRW(item.unit_price)}</td>
                <td className="text-right">{formatKRW(item.amount)}</td>
                <td className="text-right">{item.vat_apply ? formatKRW(item.vat_amount) : '-'}</td>
              </tr>
            ))}
            {Array.from({ length: Math.max(0, 8 - invoiceData.items.length) }).map((_, i) => (
              <tr key={`empty-${i}`}>
                <td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold bg-gray-50">
              <td colSpan={4} className="text-center">총 합 계</td>
              <td className="text-right"></td>
              <td className="text-right">{formatKRW(invoiceData.supply_total)}</td>
              <td className="text-right">{formatKRW(invoiceData.vat_total)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="flex justify-end">
          <div className="border border-gray-400 px-4 py-2 text-sm">
            <span className="font-semibold mr-4">총 액 (부가세 포함)</span>
            <span className="text-lg font-bold">{formatKRW(invoiceData.grand_total)}원</span>
          </div>
        </div>
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
