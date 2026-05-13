'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, FileText, AlertCircle, Receipt, Wallet, TrendingDown, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { formatKRW } from '@/lib/calculator';
import { OPERATION_TYPES, OperationType } from '@/types';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const OP_COLOR: Record<OperationType, string> = {
  '본사': 'bg-purple-100 text-purple-700 border-purple-300',
  '직영': 'bg-blue-100 text-blue-700 border-blue-300',
  '대리점': 'bg-emerald-100 text-emerald-700 border-emerald-300',
};

interface CustomerSummary {
  customer_id: number;
  customer_name: string;
  operation_type: OperationType;
  transaction_count: number;
  supply_total: number;
  grand_total: number;
  unpaid_count: number;
  unpaid_total: number;
  sales_vat: number;
  purchase_vat: number;
  net_vat: number;
  total_margin: number;
  total_net_profit: number;
  total_cost: number;
  cost_ratio: number;
  final_profit: number;
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

interface MonthlyData {
  month: string;
  grand_total: number;
  total_net_profit: number;
  total_cost: number;
  final_profit: number;
}

interface VatSummary { sales_vat: number; purchase_vat: number; net_vat: number; }
interface CostSummary { total_cost: number; by_category: { category: string; total: number }[]; }
interface GrandSummary { grand_total: number; total_cost: number; final_profit: number; }
interface AgencyAvg { grand_total: number; total_cost: number; cost_ratio: number; final_profit: number; }

interface CustomerOpt { id: number; company_name: string; operation_type?: OperationType; }

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth')
      .then((r) => r.json())
      .then((data) => {
        if (data?.user?.role === 'manager') router.replace('/transactions');
      })
      .catch(() => {});
  }, [router]);

  const [year, setYear] = useState(new Date().getFullYear());
  const [opFilter, setOpFilter] = useState<'' | OperationType>('');
  const [customerFilter, setCustomerFilter] = useState<string>('');

  const [monthly, setMonthly] = useState<MonthlyData[]>([]);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [products, setProducts] = useState<ProductVatSummary[]>([]);
  const [vatSum, setVatSum] = useState<VatSummary>({ sales_vat: 0, purchase_vat: 0, net_vat: 0 });
  const [costSum, setCostSum] = useState<CostSummary>({ total_cost: 0, by_category: [] });
  const [grandSum, setGrandSum] = useState<GrandSummary>({ grand_total: 0, total_cost: 0, final_profit: 0 });
  const [agencyAvg, setAgencyAvg] = useState<AgencyAvg>({ grand_total: 0, total_cost: 0, cost_ratio: 0, final_profit: 0 });
  const [customerOpts, setCustomerOpts] = useState<CustomerOpt[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('year', String(year));
    if (opFilter) params.set('operation_type', opFilter);
    if (customerFilter) params.set('customer_id', customerFilter);

    const [dashRes, custRes] = await Promise.all([
      fetch(`/api/dashboard?${params}`),
      fetch('/api/customers'),
    ]);
    const dash = await dashRes.json();
    setMonthly(dash.monthly || []);
    setCustomers(dash.customers || []);
    setProducts(dash.products || []);
    setVatSum(dash.vat_summary || { sales_vat: 0, purchase_vat: 0, net_vat: 0 });
    setCostSum(dash.cost_summary || { total_cost: 0, by_category: [] });
    setGrandSum(dash.grand_summary || { grand_total: 0, total_cost: 0, final_profit: 0 });
    setAgencyAvg(dash.agency_avg || { grand_total: 0, total_cost: 0, cost_ratio: 0, final_profit: 0 });
    setCustomerOpts(await custRes.json());
    setLoading(false);
  }, [year, opFilter, customerFilter]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const totalUnpaid = customers.reduce((s, c) => s + c.unpaid_total, 0);
  const monthlyChart = monthly.map((m) => ({
    name: m.month.substring(5) + '월',
    매출: m.grand_total,
    비용: m.total_cost,
    순익: m.final_profit,
  }));
  const pieData = customers.filter(c => c.grand_total > 0).map(c => ({
    name: c.customer_name,
    value: c.grand_total,
  }));

  const filteredCustomerOpts = opFilter
    ? customerOpts.filter(c => (c.operation_type || '대리점') === opFilter)
    : customerOpts;

  // 평균 대비 비교 (대리점)
  const compareWithAvg = (val: number, avg: number) => {
    if (avg === 0) return { diff: 0, pct: 0, dir: 'flat' as const };
    const diff = val - avg;
    const pct = (diff / avg) * 100;
    return { diff, pct, dir: diff > avg * 0.05 ? 'up' as const : diff < -avg * 0.05 ? 'down' as const : 'flat' as const };
  };

  if (loading) return <div className="p-8 text-center text-gray-400">대시보드를 불러오는 중...</div>;

  return (
    <>
      <PageHeader
        title="대시보드"
        description={`${year}년 ${opFilter ? `(${opFilter})` : '전체'} 현황`}
        action={
          <div className="flex gap-2">
            <select className="form-select w-auto" value={year}
              onChange={(e) => setYear(Number(e.target.value))}>
              {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}년</option>)}
            </select>
          </div>
        }
      />

      {/* 필터 바 */}
      <div className="card mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-gray-700">보기:</span>
          <button
            onClick={() => { setOpFilter(''); setCustomerFilter(''); }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium border-2 transition ${
              !opFilter && !customerFilter
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >전체</button>
          {OPERATION_TYPES.map(op => (
            <button key={op}
              onClick={() => { setOpFilter(op); setCustomerFilter(''); }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium border-2 transition ${
                opFilter === op && !customerFilter
                  ? OP_COLOR[op].replace('100', '600').replace('700', 'white').replace('300', '700')
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >{op}</button>
          ))}
          <div className="h-6 w-px bg-gray-300 mx-1"></div>
          <select className="form-select w-auto text-sm" value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}>
            <option value="">거래처 한 곳 선택</option>
            {filteredCustomerOpts.map(c => (
              <option key={c.id} value={c.id}>{c.company_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="card flex items-center gap-3">
          <div className="p-3 bg-blue-100 rounded-lg">
            <TrendingUp size={22} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">총 매출</p>
            <p className="text-lg font-bold">{formatKRW(grandSum.grand_total)}원</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="p-3 bg-amber-100 rounded-lg">
            <Wallet size={22} className="text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">총 비용</p>
            <p className="text-lg font-bold text-amber-700">{formatKRW(grandSum.total_cost)}원</p>
          </div>
        </div>
        <div className={`card flex items-center gap-3 ${grandSum.final_profit < 0 ? 'border-red-300 bg-red-50' : ''}`}>
          <div className={`p-3 rounded-lg ${grandSum.final_profit < 0 ? 'bg-red-100' : 'bg-emerald-100'}`}>
            {grandSum.final_profit < 0 ? <TrendingDown size={22} className="text-red-600" /> : <TrendingUp size={22} className="text-emerald-600" />}
          </div>
          <div>
            <p className="text-xs text-gray-500">최종 순익</p>
            <p className={`text-lg font-bold ${grandSum.final_profit < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {formatKRW(grandSum.final_profit)}원
            </p>
            <p className="text-[10px] text-gray-400">매출 − 비용</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="p-3 bg-red-100 rounded-lg">
            <AlertCircle size={22} className="text-red-500" />
          </div>
          <div>
            <p className="text-xs text-gray-500">미입금</p>
            <p className="text-lg font-bold text-red-500">{formatKRW(totalUnpaid)}원</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="p-3 bg-amber-100 rounded-lg">
            <Receipt size={22} className="text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">납부예정 부가세</p>
            <p className="text-lg font-bold text-amber-600">{formatKRW(vatSum.net_vat)}원</p>
            <p className="text-[10px] text-gray-400">매출 {formatKRW(vatSum.sales_vat)} − 매입 {formatKRW(vatSum.purchase_vat)}</p>
          </div>
        </div>
      </div>

      {/* 차트 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <h3 className="font-semibold mb-4">월별 매출 / 비용 / 순익</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                <Tooltip formatter={(v) => formatKRW(Number(v)) + '원'} />
                <Bar dataKey="매출" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="비용" fill="#f59e0b" radius={[4, 4, 0, 0]} />
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
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false} fontSize={11}>
                    {pieData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatKRW(Number(v)) + '원'} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">거래 데이터가 없습니다</div>
            )}
          </div>
        </div>
      </div>

      {/* 거래처 손익 비교표 (대리점 평균 대비) */}
      <div className="card p-0 overflow-hidden mb-6">
        <div className="px-4 py-3 border-b bg-slate-50 font-semibold text-sm flex items-center justify-between">
          <span>거래처별 손익 현황 {opFilter && `(${opFilter}만)`}</span>
          {!opFilter && !customerFilter && (
            <span className="text-xs text-gray-500 font-normal">
              대리점 평균: 매출 {formatKRW(agencyAvg.grand_total)} / 비용 {formatKRW(agencyAvg.total_cost)} / 순익 {formatKRW(agencyAvg.final_profit)}
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>거래처</th>
                <th className="text-center">구분</th>
                <th className="text-right">매출</th>
                <th className="text-right">비용</th>
                <th className="text-right">원가율</th>
                <th className="text-right">최종 순익</th>
                <th className="text-center">대리점평균 대비</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const cmp = c.operation_type === '대리점' ? compareWithAvg(c.final_profit, agencyAvg.final_profit) : null;
                return (
                  <tr key={c.customer_id}>
                    <td className="font-medium">{c.customer_name}</td>
                    <td className="text-center">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded-full border ${OP_COLOR[c.operation_type]}`}>
                        {c.operation_type}
                      </span>
                    </td>
                    <td className="text-right font-medium">{formatKRW(c.grand_total)}원</td>
                    <td className="text-right text-amber-700">{formatKRW(c.total_cost)}원</td>
                    <td className="text-right">
                      <span className={c.cost_ratio > 0.7 ? 'text-red-600 font-bold' : c.cost_ratio > 0.5 ? 'text-orange-500' : 'text-gray-600'}>
                        {(c.cost_ratio * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className={`text-right font-bold ${c.final_profit < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {formatKRW(c.final_profit)}원
                    </td>
                    <td className="text-center">
                      {cmp ? (
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                          cmp.dir === 'up' ? 'text-emerald-600' : cmp.dir === 'down' ? 'text-red-600' : 'text-gray-400'
                        }`}>
                          {cmp.dir === 'up' && <ArrowUp size={12} />}
                          {cmp.dir === 'down' && <ArrowDown size={12} />}
                          {cmp.dir === 'flat' && <Minus size={12} />}
                          {Math.abs(cmp.pct).toFixed(1)}%
                        </span>
                      ) : <span className="text-gray-300">-</span>}
                    </td>
                  </tr>
                );
              })}
              {customers.length === 0 && (
                <tr><td colSpan={7} className="text-center py-6 text-gray-400">데이터 없음</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 비용 카테고리 + 부가세 (거래처/품목) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b bg-amber-50 font-semibold text-sm">
            비용 구분별 합계
          </div>
          <table className="data-table">
            <thead><tr><th>구분</th><th className="text-right">금액</th><th className="text-right">비율</th></tr></thead>
            <tbody>
              {costSum.by_category.map((c) => (
                <tr key={c.category}>
                  <td className="font-medium">{c.category}</td>
                  <td className="text-right text-amber-700">{formatKRW(c.total)}원</td>
                  <td className="text-right text-gray-500">
                    {costSum.total_cost > 0 ? ((c.total / costSum.total_cost) * 100).toFixed(1) : '0'}%
                  </td>
                </tr>
              ))}
              {costSum.by_category.length === 0 && (
                <tr><td colSpan={3} className="text-center py-4 text-gray-400">비용 데이터 없음</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b bg-amber-50 font-semibold text-sm">
            품목별 납부예정 부가세
          </div>
          <div className="overflow-x-auto max-h-[300px]">
            <table className="data-table">
              <thead className="sticky top-0 bg-white">
                <tr>
                  <th>품목명</th>
                  <th className="text-right">매출VAT</th>
                  <th className="text-right">매입VAT</th>
                  <th className="text-right">납부</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.product_id}>
                    <td className="font-medium">{p.product_name}<span className="ml-1 text-xs text-gray-400">({p.category})</span></td>
                    <td className="text-right text-blue-600">{formatKRW(p.sales_vat)}</td>
                    <td className="text-right text-gray-500">−{formatKRW(p.purchase_vat)}</td>
                    <td className="text-right font-bold text-amber-600">{formatKRW(p.net_vat)}원</td>
                  </tr>
                ))}
                {products.length === 0 && <tr><td colSpan={4} className="text-center py-4 text-gray-400">데이터 없음</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
