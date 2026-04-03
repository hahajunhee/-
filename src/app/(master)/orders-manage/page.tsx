'use client';

import { useEffect, useState, useCallback } from 'react';
import { CheckCircle, XCircle, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';
import { formatKRW } from '@/lib/calculator';

interface Order {
  id: number;
  order_number: string;
  customer_name: string;
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
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const res = await fetch(`/api/orders${params}`);
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      setOrders([]);
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

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

      <div className="card mb-4">
        <select className="form-select w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">전체 상태</option>
          <option value="pending">대기</option>
          <option value="confirmed">확인</option>
          <option value="completed">완료</option>
          <option value="rejected">거절</option>
        </select>
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
                <div>
                  <span className="font-bold">{order.order_number}</span>
                  <span className="text-gray-500 ml-2">{order.customer_name}</span>
                  <span className="text-gray-400 ml-2 text-sm">({order.user_name || '-'})</span>
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
