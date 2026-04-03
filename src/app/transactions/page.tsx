'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Search, FileText, Trash2, CheckCircle, Clock, PlusCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';
import { Transaction, Customer } from '@/types';
import { formatKRW } from '@/lib/calculator';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

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
    setTransactions(await res.json());
    setLoading(false);
  }, [dateFrom, dateTo, customerId, statusFilter]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);
  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const toggleStatus = async (txn: Transaction) => {
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

      {/* 테이블 */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">불러오는 중...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>거래일자</th>
                  <th>거래처</th>
                  <th className="text-right">공급가액</th>
                  <th className="text-right">부가세</th>
                  <th className="text-right">합계</th>
                  <th className="text-center">품목수</th>
                  <th className="text-center">입금</th>
                  <th className="w-28"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="font-mono">{t.date}</td>
                    <td className="font-medium">
                      {(t.customer as unknown as { company_name: string })?.company_name || '-'}
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
                      <div className="flex gap-1">
                        <Link
                          href={`/invoice?id=${t.id}`}
                          className="p-1.5 rounded hover:bg-blue-50"
                          title="명세서 보기"
                        >
                          <FileText size={14} className="text-blue-500" />
                        </Link>
                        <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded hover:bg-red-50">
                          <Trash2 size={14} className="text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-400">
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
