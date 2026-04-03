'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { PlusCircle, Package, Clock, CheckCircle, XCircle } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { formatKRW } from '@/lib/calculator';

interface Order {
  id: number;
  order_number: string;
  date: string;
  date_formatted: string;
  order_status: string;
  notes: string;
  grand_total: number;
  email_sent: boolean;
  items: any[];
}

export default function PartnerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/orders');
    setOrders(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const statusBadge = (status: string) => {
    const map: Record<string, { icon: any; bg: string; text: string; label: string }> = {
      pending: { icon: Clock, bg: 'bg-yellow-100', text: 'text-yellow-700', label: '대기 중' },
      confirmed: { icon: CheckCircle, bg: 'bg-blue-100', text: 'text-blue-700', label: '확인됨' },
      completed: { icon: CheckCircle, bg: 'bg-emerald-100', text: 'text-emerald-700', label: '완료' },
      rejected: { icon: XCircle, bg: 'bg-red-100', text: 'text-red-600', label: '거절' },
    };
    const s = map[status] || map.pending;
    const Icon = s.icon;
    return <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}><Icon size={12}/> {s.label}</span>;
  };

  return (
    <>
      <PageHeader
        title="발주 내역"
        description="내 발주서 목록"
        action={
          <Link href="/partner/orders/new" className="btn-success">
            <PlusCircle size={16} /> 발주서 작성
          </Link>
        }
      />

      <div className="space-y-4">
        {loading ? (
          <div className="card text-center text-gray-400">불러오는 중...</div>
        ) : orders.length === 0 ? (
          <div className="card text-center text-gray-400 py-12">
            <Package size={48} className="mx-auto mb-4 text-gray-300" />
            <p>아직 발주 내역이 없습니다</p>
            <Link href="/partner/orders/new" className="btn-success mt-4 inline-flex">
              <PlusCircle size={16} /> 첫 발주서 작성하기
            </Link>
          </div>
        ) : orders.map(order => (
          <div key={order.id} className="card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Package size={20} className="text-emerald-500" />
                <span className="font-bold">{order.order_number}</span>
                <span className="text-gray-400 text-sm">{order.date_formatted || order.date?.split('T')[0]}</span>
              </div>
              <div className="flex items-center gap-3">
                {statusBadge(order.order_status)}
                <span className="text-lg font-bold">{formatKRW(Number(order.grand_total))}원</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>품목</th>
                    <th>규격</th>
                    <th className="text-right">수량</th>
                    <th className="text-right">단가</th>
                    <th className="text-right">금액</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items?.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td>{item.product_name}</td>
                      <td className="text-gray-500">{item.spec}</td>
                      <td className="text-right">{item.qty}</td>
                      <td className="text-right">{formatKRW(Number(item.unit_price))}</td>
                      <td className="text-right font-medium">{formatKRW(Number(item.amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {order.notes && <p className="mt-2 text-sm text-gray-500">비고: {order.notes}</p>}
          </div>
        ))}
      </div>
    </>
  );
}
