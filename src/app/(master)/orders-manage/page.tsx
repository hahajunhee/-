'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { CheckCircle, XCircle, Package, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';
import { formatKRW } from '@/lib/calculator';
import { Customer, OPERATION_TYPES, OperationType } from '@/types';

const OP_BADGE: Record<OperationType, string> = {
  '본점': 'bg-purple-100 text-purple-700',
  '직영점': 'bg-blue-100 text-blue-700',
  '가맹점': 'bg-emerald-100 text-emerald-700',
};

interface Order {
  id: number;
  order_number: string;
  customer_name: string;
  customer_brand?: string;
  customer_operation_type?: OperationType;
  user_name: string;
  date: string;
  date_formatted: string;
  order_status: string;
  notes: string;
  supply_total: number;
  vat_total: number;
  grand_total: number;
  email_sent: boolean;
  items: any[];
}

export default function OrdersManagePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [brandOptions, setBrandOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [opFilter, setOpFilter] = useState<'' | OperationType>('');
  const [customerId, setCustomerId] = useState('');
  const [custDropdownOpen, setCustDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (brandFilter) params.set('brand', brandFilter);
      if (opFilter) params.set('operation_type', opFilter);
      if (customerId) params.set('customer_id', customerId);
      const res = await fetch(`/api/orders?${params}`);
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      setOrders([]);
    }
    setLoading(false);
  }, [statusFilter, brandFilter, opFilter, customerId]);

  const fetchMeta = useCallback(async () => {
    try {
      const [cRes, sRes] = await Promise.all([
        fetch('/api/customers'),
        fetch('/api/settings'),
      ]);
      setCustomers(await cRes.json());
      const s = await sRes.json();
      setBrandOptions(Array.isArray(s?.brands) ? s.brands : []);
    } catch {}
  }, []);

  useEffect(() => { fetchMeta(); }, [fetchMeta]);
  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setCustDropdownOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const filteredCustomerOpts = customers.filter(c => {
    if (brandFilter && (c.brand || '') !== brandFilter) return false;
    if (opFilter && (c.operation_type || '가맹점') !== opFilter) return false;
    return true;
  });

  const updateStatus = async (id: number, status: string) => {
    const res = await fetch(`/api/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast.success(`${status === 'confirmed' ? '확인' : status === 'completed' ? '완료' : '거절'} 처리됨`);
      fetchOrders();
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '대기' },
      confirmed: { bg: 'bg-blue-100', text: 'text-blue-700', label: '확인' },
      completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: '완료' },
      rejected: { bg: 'bg-red-100', text: 'text-red-600', label: '거절' },
    };
    const s = map[status] || map.pending;
    return <span className={`text-xs px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>;
  };

  return (
    <>
      <PageHeader title="발주 관리" description={`총 ${orders.length}건`} />

      <div className="card mb-4 space-y-3">
        {/* 1차/2차/3차 (위) */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="form-label">1차: 브랜드</label>
            <select className="form-select" value={brandFilter}
              onChange={(e) => { setBrandFilter(e.target.value); setCustomerId(''); }}>
              <option value="">전체 브랜드</option>
              {brandOptions.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">2차: 운영구분</label>
            <select className="form-select" value={opFilter}
              onChange={(e) => { setOpFilter(e.target.value as OperationType | ''); setCustomerId(''); }}>
              <option value="">전체 운영구분</option>
              {OPERATION_TYPES.map(op => <option key={op} value={op}>{op}</option>)}
            </select>
          </div>
          <div className="relative" ref={dropdownRef}>
            <label className="form-label">3차: 거래처 ({filteredCustomerOpts.length}곳)</label>
            <button type="button"
              onClick={() => setCustDropdownOpen(!custDropdownOpen)}
              className="form-select flex items-center justify-between w-full text-left">
              {(() => {
                const sel = customers.find(c => String(c.id) === customerId);
                if (!sel) return <span className="text-gray-400">전체</span>;
                const op = (sel.operation_type || '가맹점') as OperationType;
                return (
                  <span className="flex items-center gap-2 truncate">
                    <span className="font-medium truncate">{sel.company_name}</span>
                    {sel.brand && (
                      <span className="inline-block px-1.5 py-0.5 text-[10px] rounded bg-indigo-100 text-indigo-700">{sel.brand}</span>
                    )}
                    <span className={`inline-block px-1.5 py-0.5 text-[10px] rounded-full ${OP_BADGE[op]}`}>{op}</span>
                  </span>
                );
              })()}
              <ChevronDown size={14} className="text-gray-400 shrink-0" />
            </button>
            {custDropdownOpen && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-[300px] overflow-y-auto">
                <button type="button"
                  onClick={() => { setCustomerId(''); setCustDropdownOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 border-b">
                  전체
                </button>
                {filteredCustomerOpts.length === 0 && (
                  <div className="px-3 py-4 text-sm text-gray-400 text-center">조건에 맞는 거래처가 없습니다</div>
                )}
                {filteredCustomerOpts.map(c => {
                  const op = (c.operation_type || '가맹점') as OperationType;
                  const isSelected = String(c.id) === customerId;
                  return (
                    <button type="button" key={c.id}
                      onClick={() => { setCustomerId(String(c.id)); setCustDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 transition ${
                        isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{c.company_name}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {c.brand && (
                            <span className="inline-block px-1.5 py-0.5 text-[10px] rounded bg-indigo-100 text-indigo-700">{c.brand}</span>
                          )}
                          <span className={`inline-block px-1.5 py-0.5 text-[10px] rounded-full ${OP_BADGE[op]}`}>{op}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 상태 필터 (아래) */}
        <div className="pt-2 border-t border-gray-100">
          <label className="form-label">상태</label>
          <select className="form-select w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">전체 상태</option>
            <option value="pending">대기</option>
            <option value="confirmed">확인</option>
            <option value="completed">완료</option>
            <option value="rejected">거절</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="card text-center text-gray-400">불러오는 중...</div>
        ) : orders.length === 0 ? (
          <div className="card text-center text-gray-400">발주 내역이 없습니다</div>
        ) : orders.map(order => (
          <div key={order.id} className="card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Package size={20} className="text-blue-500" />
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold">{order.order_number}</span>
                  <span className="text-gray-500">{order.customer_name}</span>
                  {order.customer_brand && (
                    <span className="inline-block px-1.5 py-0.5 text-[10px] rounded bg-indigo-100 text-indigo-700">{order.customer_brand}</span>
                  )}
                  {order.customer_operation_type && (
                    <span className={`inline-block px-1.5 py-0.5 text-[10px] rounded-full ${OP_BADGE[order.customer_operation_type]}`}>
                      {order.customer_operation_type}
                    </span>
                  )}
                  <span className="text-gray-400 text-sm">({order.user_name || '-'})</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {statusBadge(order.order_status)}
                <span className="text-lg font-bold text-blue-600">{formatKRW(Number(order.grand_total))}원</span>
              </div>
            </div>

            <div className="overflow-x-auto mb-3">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>품목</th>
                    <th>규격</th>
                    <th className="text-right">수량</th>
                    <th className="text-right">단가</th>
                    <th className="text-right">금액</th>
                    <th className="text-right">마진</th>
                    <th className="text-right">부가세</th>
                    <th className="text-right">순익</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items?.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td>{item.product_name}</td>
                      <td className="text-gray-500">{item.spec}</td>
                      <td className="text-right">{Number(item.qty)}</td>
                      <td className="text-right">{formatKRW(Number(item.unit_price))}</td>
                      <td className="text-right font-medium">{formatKRW(Number(item.amount))}</td>
                      <td className="text-right text-blue-600">{formatKRW(Number(item.margin))}</td>
                      <td className="text-right text-gray-500">{formatKRW(Number(item.vat_amount))}</td>
                      <td className="text-right text-emerald-600">{formatKRW(Number(item.net_profit))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {order.notes && <p className="text-sm text-gray-500 mb-3">비고: {order.notes}</p>}

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">
                {order.date_formatted || order.date?.split('T')[0]} | {order.email_sent ? '이메일 발송됨' : '이메일 미발송'}
              </span>
              {order.order_status === 'pending' && (
                <div className="flex gap-2">
                  <button onClick={() => updateStatus(order.id, 'confirmed')}
                    className="btn-primary text-xs py-1 px-3"><CheckCircle size={14}/> 확인</button>
                  <button onClick={() => updateStatus(order.id, 'rejected')}
                    className="btn-danger text-xs py-1 px-3"><XCircle size={14}/> 거절</button>
                </div>
              )}
              {order.order_status === 'confirmed' && (
                <button onClick={() => updateStatus(order.id, 'completed')}
                  className="btn-success text-xs py-1 px-3"><CheckCircle size={14}/> 완료 처리</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
