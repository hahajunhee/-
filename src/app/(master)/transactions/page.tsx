'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { FileText, Trash2, CheckCircle, Clock, PlusCircle, Mail, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';
import { Customer } from '@/types';
import { formatKRW } from '@/lib/calculator';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchCustomers = useCallback(async () => {
    const res = await fetch('/api/customers');
    setCustomers(await res.json());
  }, []);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    if (customerId) params.set('customer_id', customerId);
    if (statusFilter) params.set('status', statusFilter);

    const res = await fetch(`/api/transactions?${params}`);
    const data = await res.json();
    setTransactions(Array.isArray(data) ? data : []);
    setSelected([]);
    setLoading(false);
  }, [dateFrom, dateTo, customerId, statusFilter]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);
  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const toggleStatus = async (txn: any) => {
    const newStatus = txn.payment_status === 'paid' ? 'unpaid' : 'paid';
    const res = await fetch(`/api/transactions/${txn.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_status: newStatus }),
    });
    if (res.ok) {
      toast.success(newStatus === 'paid' ? '입금 처리됨' : '미입금으로 변경');
      fetchTransactions();
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('삭제되었습니다');
      fetchTransactions();
    }
  };

  const toggleSelect = (id: number) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selected.length === transactions.length) {
      setSelected([]);
    } else {
      setSelected(transactions.map(t => t.id));
    }
  };

  // 선택된 거래 → 일괄 거래명세서 보기
  const openInvoice = () => {
    if (selected.length === 0) { toast.error('거래를 선택하세요'); return; }
    const ids = selected.join(',');
    window.open(`/invoice?ids=${ids}`, '_blank');
  };

  // 선택된 거래 → 거래명세서+이메일 발송 페이지 열기
  const openEmailInvoice = () => {
    if (selected.length === 0) { toast.error('거래를 선택하세요'); return; }
    const ids = selected.join(',');
    window.open(`/invoice?ids=${ids}&email=true`, '_blank');
  };

  // 품목 요약 텍스트 생성: "돈삼겹살 외 2건"
  const getItemSummary = (items: any[]) => {
    if (!items || items.length === 0) return '-';
    const first = items[0]?.product_name || '';
    if (items.length === 1) return first;
    return `${first} 외 ${items.length - 1}건`;
  };

  const totalSupply = transactions.reduce((s, t) => s + Number(t.supply_total), 0);
  const totalGrand = transactions.reduce((s, t) => s + Number(t.grand_total), 0);
  const unpaidTotal = transactions
    .filter((t) => t.payment_status === 'unpaid')
    .reduce((s, t) => s + Number(t.grand_total), 0);

  return (
    <>
      <PageHeader
        title="거래 내역"
        description={`총 ${transactions.length}건`}
        action={
          <Link href="/transactions/new" className="btn-primary">
            <PlusCircle size={16} /> 거래 입력
          </Link>
        }
      />

      {/* 필터 */}
      <div className="card mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="form-label">시작일</label>
            <input type="date" className="form-input" value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="form-label">종료일</label>
            <input type="date" className="form-input" value={dateTo}
              onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div>
            <label className="form-label">거래처</label>
            <select className="form-select" value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">전체</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.company_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">입금 상태</label>
            <select className="form-select" value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">전체</option>
              <option value="paid">입금</option>
              <option value="unpaid">미입금</option>
            </select>
          </div>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="card text-center">
          <p className="text-xs text-gray-500">공급가액 합계</p>
          <p className="text-xl font-bold">{formatKRW(totalSupply)}원</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500">총액 합계</p>
          <p className="text-xl font-bold text-blue-600">{formatKRW(totalGrand)}원</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500">미입금 합계</p>
          <p className="text-xl font-bold text-red-500">{formatKRW(unpaidTotal)}원</p>
        </div>
      </div>

      {/* 선택 액션 바 */}
      {selected.length > 0 && (
        <div className="card mb-4 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-700">{selected.length}건 선택됨</span>
            <div className="flex gap-2">
              <button onClick={openInvoice} className="btn-primary text-xs py-1.5 px-3">
                <FileText size={14} /> 거래명세서 보기
              </button>
              <button onClick={openEmailInvoice} className="btn-success text-xs py-1.5 px-3">
                <Mail size={14} /> 이메일 발송
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 테이블 */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">불러오는 중...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-10">
                    <input type="checkbox" className="w-4 h-4"
                      checked={selected.length === transactions.length && transactions.length > 0}
                      onChange={toggleSelectAll} />
                  </th>
                  <th>거래일자</th>
                  <th>거래처</th>
                  <th className="text-center">구분</th>
                  <th className="text-right">공급가액</th>
                  <th className="text-right">부가세</th>
                  <th className="text-right">합계</th>
                  <th>품목</th>
                  <th className="text-center">상세</th>
                  <th className="text-center">입금</th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <React.Fragment key={t.id}>
                  <tr className={selected.includes(t.id) ? 'bg-blue-50' : ''}>
                    <td>
                      <input type="checkbox" className="w-4 h-4"
                        checked={selected.includes(t.id)}
                        onChange={() => toggleSelect(t.id)} />
                    </td>
                    <td className="font-mono">{t.date_formatted || t.date?.split('T')[0]}</td>
                    <td className="font-medium">
                      {t.customer?.company_name || t.customer_name || '-'}
                    </td>
                    <td className="text-center">
                      {t.source === 'order' ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">발주</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">수기</span>
                      )}
                    </td>
                    <td className="text-right">{formatKRW(Number(t.supply_total))}</td>
                    <td className="text-right text-gray-500">{formatKRW(Number(t.vat_total))}</td>
                    <td className="text-right font-medium">{formatKRW(Number(t.grand_total))}</td>
                    <td className="text-sm text-gray-700 max-w-[160px] truncate" title={t.items?.map((i: any) => i.product_name).join(', ')}>
                      {getItemSummary(t.items)}
                    </td>
                    <td className="text-center">
                      <button
                        onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg hover:bg-gray-100 text-blue-600"
                      >
                        {expandedId === t.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {expandedId === t.id ? '접기' : '보기'}
                      </button>
                    </td>
                    <td className="text-center">
                      <button onClick={() => toggleStatus(t)} className="inline-flex items-center gap-1">
                        {t.payment_status === 'paid' ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            <CheckCircle size={12} /> 입금
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                            <Clock size={12} /> 미입금
                          </span>
                        )}
                      </button>
                    </td>
                    <td>
                      <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded hover:bg-red-50">
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    </td>
                  </tr>
                  {/* 펼침 상세 행 */}
                  {expandedId === t.id && t.items && t.items.length > 0 && (
                    <tr className="bg-gray-50">
                      <td colSpan={12} className="p-0">
                        <div className="px-6 py-3">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="text-gray-500">
                                <th className="text-left py-1.5 px-2 font-medium border-b border-gray-200">품목명</th>
                                <th className="text-left py-1.5 px-2 font-medium border-b border-gray-200">규격</th>
                                <th className="text-center py-1.5 px-2 font-medium border-b border-gray-200">단위</th>
                                <th className="text-right py-1.5 px-2 font-medium border-b border-gray-200">수량</th>
                                <th className="text-right py-1.5 px-2 font-medium border-b border-gray-200">단가</th>
                                <th className="text-right py-1.5 px-2 font-medium border-b border-gray-200">금액</th>
                                <th className="text-center py-1.5 px-2 font-medium border-b border-gray-200">부가세여부</th>
                                <th className="text-right py-1.5 px-2 font-medium border-b border-gray-200">부가세</th>
                              </tr>
                            </thead>
                            <tbody>
                              {t.items.map((item: any, idx: number) => (
                                <tr key={idx} className="hover:bg-gray-100">
                                  <td className="py-1.5 px-2 border-b border-gray-100 font-medium">
                                    {item.product_name}
                                    {item.invoice_hidden && (
                                      <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-purple-100 text-purple-700">대시보드 전용</span>
                                    )}
                                  </td>
                                  <td className="py-1.5 px-2 border-b border-gray-100 text-gray-500">{item.spec}</td>
                                  <td className="py-1.5 px-2 border-b border-gray-100 text-center text-gray-500">{item.unit}</td>
                                  <td className="py-1.5 px-2 border-b border-gray-100 text-right">{Number(item.qty)}</td>
                                  <td className="py-1.5 px-2 border-b border-gray-100 text-right">{formatKRW(Number(item.unit_price))}</td>
                                  <td className="py-1.5 px-2 border-b border-gray-100 text-right font-medium">{formatKRW(Number(item.amount))}</td>
                                  <td className="py-1.5 px-2 border-b border-gray-100 text-center">{item.vat_apply ? 'Y' : 'N'}</td>
                                  <td className="py-1.5 px-2 border-b border-gray-100 text-right text-gray-500">{formatKRW(Number(item.vat_amount))}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={12} className="text-center py-8 text-gray-400">
                      거래 내역이 없습니다
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </>
  );
}
