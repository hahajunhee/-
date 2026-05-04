'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, Package, Building2, FileText, AlertCircle, Receipt } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { formatKRW } from '@/lib/calculator';
import { DashboardSummary, CustomerSummary } from '@/types';

interface CustomerVatSummary extends CustomerSummary {
  sales_vat: number;
  purchase_vat: number;
  net_vat: number;
}

interface ProductVatSummary {
  product_id: number;
  product_name: string;
  category: string;
  total_qty: number;
  total_amount: number;
  sales_vat: number;
  purchase_vat: number;
  net_vat: number;
  total_net_profit: number;
}

interface VatSummary {
  sales_vat: number;
  purchase_vat: number;
  net_vat: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function DashboardPage() {
  const [monthly, setMonthly] = useState<DashboardSummary[]>([]);
  const [customerSummary, setCustomerSummary] = useState<CustomerVatSummary[]>([]);
  const [productSummary, setProductSummary] = useState<ProductVatSummary[]>([]);
  const [vatSummary, setVatSummary] = useState<VatSummary>({ sales_vat: 0, purchase_vat: 0, net_vat: 0 });
  const [year, setYear] = useState(new Date().getFullYear());
  const [productCount, setProductCount] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    const [dashRes, prodRes, custRes] = await Promise.all([
      fetch(`/api/dashboard?year=${year}`),
      fetch('/api/products'),
      fetch('/api/customers'),
    ]);
    const dash = await dashRes.json();
    setMonthly(dash.monthly || []);
    setCustomerSummary(dash.customers || []);
    setProductSummary(dash.products || []);
    setVatSummary(dash.vat_summary || { sales_vat: 0, purchase_vat: 0, net_vat: 0 });
    const prods = await prodRes.json();
    const custs = await custRes.json();
    setProductCount(prods.length);
    setCustomerCount(custs.length);
    setLoading(false);
  }, [year]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const totalSales = monthly.reduce((s, m) => s + m.grand_total, 0);
  const totalProfit = monthly.reduce((s, m) => s + m.total_net_profit, 0);
  const totalTxns = monthly.reduce((s, m) => s + m.transaction_count, 0);
  const totalUnpaid = customerSummary.reduce((s, c) => s + c.unpaid_total, 0);

  const monthlyChart = monthly.map((m) => ({
    name: m.month.substring(5) + '월',
    매출: m.grand_total,
    순익: m.total_net_profit,
  }));

  const pieData = customerSummary
    .filter((c) => c.grand_total > 0)
    .map((c) => ({
      name: c.customer_name,
      value: c.grand_total,
    }));

  if (loading) {
    return <div className="p-8 text-center text-gray-400">대시보드를 불러오는 중...</div>;
  }

  return (
    <>
      <PageHeader
        title="대시보드"
        description={`${year}년 거래 현황`}
        action={
          <select
            className="form-select w-auto"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
        }
      />

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <TrendingUp size={24} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">총 매출</p>
            <p className="text-lg font-bold">{formatKRW(totalSales)}원</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-emerald-100 rounded-lg">
            <TrendingUp size={24} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">총 순익</p>
            <p className="text-lg font-bold text-emerald-600">{formatKRW(totalProfit)}원</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-violet-100 rounded-lg">
            <FileText size={24} className="text-violet-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">총 거래건수</p>
            <p className="text-lg font-bold">{totalTxns}건</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-red-100 rounded-lg">
            <AlertCircle size={24} className="text-red-500" />
          </div>
          <div>
            <p className="text-xs text-gray-500">미입금 합계</p>
            <p className="text-lg font-bold text-red-500">{formatKRW(totalUnpaid)}원</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-amber-100 rounded-lg">
            <Receipt size={24} className="text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500" title="매출부가세 - 매입부가세">납부예정 부가세</p>
            <p className="text-lg font-bold text-amber-600">{formatKRW(vatSummary.net_vat)}원</p>
            <p className="text-[10px] text-gray-400">매출 {formatKRW(vatSummary.sales_vat)} − 매입 {formatKRW(vatSummary.purchase_vat)}</p>
          </div>
        </div>
      </div>

      {/* 차트 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <h3 className="font-semibold mb-4">월별 매출 / 순익</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                <Tooltip formatter={(v) => formatKRW(Number(v)) + '원'} />
                <Bar dataKey="매출" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="순익" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold mb-4">거래처별 매출 비중</h3>
          <div className="h-[300px]">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                    fontSize={11}
                  >
                    {pieData.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatKRW(Number(v)) + '원'} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                거래 데이터가 없습니다
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 거래처별/품목별 납부예정 부가세 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b bg-amber-50 font-semibold text-sm flex items-center gap-2">
            <Receipt size={16} className="text-amber-600" />
            거래처별 납부예정 부가세
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>거래처</th>
                  <th className="text-right">매출부가세</th>
                  <th className="text-right">매입부가세</th>
                  <th className="text-right">납부예정</th>
                </tr>
              </thead>
              <tbody>
                {customerSummary.map((c) => (
                  <tr key={c.customer_id}>
                    <td className="font-medium">{c.customer_name}</td>
                    <td className="text-right text-blue-600">{formatKRW(c.sales_vat)}</td>
                    <td className="text-right text-gray-500">−{formatKRW(c.purchase_vat)}</td>
                    <td className="text-right font-bold text-amber-600">{formatKRW(c.net_vat)}원</td>
                  </tr>
                ))}
                {customerSummary.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-4 text-gray-400">데이터 없음</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b bg-amber-50 font-semibold text-sm flex items-center gap-2">
            <Receipt size={16} className="text-amber-600" />
            품목별 납부예정 부가세
          </div>
          <div className="overflow-x-auto max-h-[400px]">
            <table className="data-table">
              <thead className="sticky top-0 bg-white">
                <tr>
                  <th>품목명</th>
                  <th className="text-right">매출부가세</th>
                  <th className="text-right">매입부가세</th>
                  <th className="text-right">납부예정</th>
                </tr>
              </thead>
              <tbody>
                {productSummary.map((p) => (
                  <tr key={p.product_id}>
                    <td className="font-medium">
                      {p.product_name}
                      <span className="ml-1 text-xs text-gray-400">({p.category})</span>
                    </td>
                    <td className="text-right text-blue-600">{formatKRW(p.sales_vat)}</td>
                    <td className="text-right text-gray-500">−{formatKRW(p.purchase_vat)}</td>
                    <td className="text-right font-bold text-amber-600">{formatKRW(p.net_vat)}원</td>
                  </tr>
                ))}
                {productSummary.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-4 text-gray-400">데이터 없음</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 하단 정보 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 font-semibold text-sm">
            거래처별 집계
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>거래처</th>
                <th className="text-right">거래건수</th>
                <th className="text-right">매출합계</th>
                <th className="text-right">미입금</th>
              </tr>
            </thead>
            <tbody>
              {customerSummary.map((c) => (
                <tr key={c.customer_id}>
                  <td className="font-medium">{c.customer_name}</td>
                  <td className="text-right">{c.transaction_count}건</td>
                  <td className="text-right">{formatKRW(c.grand_total)}원</td>
                  <td className="text-right">
                    {c.unpaid_total > 0 ? (
                      <span className="text-red-500">{formatKRW(c.unpaid_total)}원</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {customerSummary.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-4 text-gray-400">데이터 없음</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3 className="font-semibold mb-4">시스템 현황</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Package size={20} className="text-blue-500" />
                <span>등록된 품목</span>
              </div>
              <span className="font-bold">{productCount}개</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Building2 size={20} className="text-emerald-500" />
                <span>등록된 거래처</span>
              </div>
              <span className="font-bold">{customerCount}개</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <FileText size={20} className="text-violet-500" />
                <span>올해 거래건수</span>
              </div>
              <span className="font-bold">{totalTxns}건</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
