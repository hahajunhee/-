'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { FileText, Trash2, CheckCircle, Clock, PlusCircle, Mail, X } from 'lucide-react';
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
  const [emailPreview, setEmailPreview] = useState<{ html: string; to: string; subject: string; txnIds: number[] } | null>(null);
  const [sending, setSending] = useState(false);

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

  // 선택된 거래 → 이메일 미리보기
  const openEmailPreview = async () => {
    if (selected.length === 0) { toast.error('거래를 선택하세요'); return; }
    try {
      const res = await fetch('/api/email/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_ids: selected }),
      });
      if (res.ok) {
        const data = await res.json();
        setEmailPreview(data);
      } else {
        const err = await res.json();
        toast.error(err.error || '미리보기 실패');
      }
    } catch {
      toast.error('서버 연결 오류');
    }
  };

  // 이메일 발송 확정
  const sendEmail = async () => {
    if (!emailPreview) return;
    setSending(true);
    try {
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_ids: emailPreview.txnIds }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || '발송 완료');
        setEmailPreview(null);
        setSelected([]);
      } else {
        toast.error(data.error || '발송 실패');
      }
    } catch {
      toast.error('서버 연결 오류');
    }
    setSending(false);
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
              <button onClick={openEmailPreview} className="btn-success text-xs py-1.5 px-3">
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
                  <th className="text-center">품목수</th>
                  <th className="text-center">입금</th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className={selected.includes(t.id) ? 'bg-blue-50' : ''}>
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
                    <td className="text-center">{t.items?.length || 0}건</td>
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
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-gray-400">
                      거래 내역이 없습니다
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 이메일 미리보기 모달 */}
      {emailPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEmailPreview(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h3 className="font-bold text-lg">이메일 미리보기</h3>
                <p className="text-sm text-gray-500">To: {emailPreview.to} | {emailPreview.subject}</p>
              </div>
              <button onClick={() => setEmailPreview(null)} className="p-2 rounded-lg hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="border rounded-lg p-4" dangerouslySetInnerHTML={{ __html: emailPreview.html }} />
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t">
              <button onClick={() => setEmailPreview(null)} className="btn-secondary">취소</button>
              <button onClick={sendEmail} disabled={sending} className="btn-success">
                <Mail size={16} /> {sending ? '발송 중...' : '발송 확정'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
