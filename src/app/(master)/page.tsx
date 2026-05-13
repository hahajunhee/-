'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts';
import {
  TrendingUp, AlertCircle, Receipt, Wallet, TrendingDown,
  ArrowUp, ArrowDown, Minus, X, Calendar, Plus,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { formatKRW } from '@/lib/calculator';
import { OPERATION_TYPES, OperationType } from '@/types';

const OP_COLOR: Record<OperationType, string> = {
  '본사': 'bg-purple-100 text-purple-700 border-purple-300',
  '직영': 'bg-blue-100 text-blue-700 border-blue-300',
  '대리점': 'bg-emerald-100 text-emerald-700 border-emerald-300',
};
const OP_DOT: Record<OperationType, string> = {
  '본사': 'bg-purple-500', '직영': 'bg-blue-500', '대리점': 'bg-emerald-500',
};
const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

interface CustomerSummary {
  customer_id: number; customer_name: string; operation_type: OperationType;
  transaction_count: number; supply_total: number; grand_total: number;
  unpaid_count: number; unpaid_total: number;
  sales_vat: number; purchase_vat: number; net_vat: number;
  total_margin: number; total_net_profit: number;
  total_cost: number; cost_ratio: number; final_profit: number;
}

interface Benchmark {
  count: number; grand_total: number; total_cost: number; cost_ratio: number;
  final_profit: number; sales_vat: number; purchase_vat: number; net_vat: number;
  unpaid_total: number;
}

interface MonthlyData {
  month: string; grand_total: number; total_cost: number; final_profit: number; total_net_profit: number;
}

interface CustomerOpt { id: number; company_name: string; operation_type?: OperationType; }

// 날짜 프리셋
function getPreset(key: string) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  switch (key) {
    case '이번달':
      return { from: fmt(new Date(y, m, 1)), to: fmt(new Date(y, m + 1, 0)) };
    case '이번분기': {
      const qStart = Math.floor(m / 3) * 3;
      return { from: fmt(new Date(y, qStart, 1)), to: fmt(new Date(y, qStart + 3, 0)) };
    }
    case '올해':
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case '작년':
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    case '최근3개월':
      return { from: fmt(new Date(y, m - 2, 1)), to: fmt(new Date(y, m + 1, 0)) };
    case '최근6개월':
      return { from: fmt(new Date(y, m - 5, 1)), to: fmt(new Date(y, m + 1, 0)) };
    default:
      return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
}

export default function DashboardPage() {
  const router = useRouter();
  useEffect(() => {
    fetch('/api/auth').then((r) => r.json()).then((data) => {
      if (data?.user?.role === 'manager') router.replace('/transactions');
    }).catch(() => {});
  }, [router]);

  const initial = getPreset('올해');
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [opFilter, setOpFilter] = useState<'' | OperationType>('');
  const [selectedCustIds, setSelectedCustIds] = useState<number[]>([]);

  const [monthly, setMonthly] = useState<MonthlyData[]>([]);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [benchmarks, setBenchmarks] = useState<Record<string, Benchmark>>({});
  const [customerOpts, setCustomerOpts] = useState<CustomerOpt[]>([]);
  const [grandSum, setGrandSum] = useState({ grand_total: 0, total_cost: 0, final_profit: 0 });
  const [vatSum, setVatSum] = useState({ sales_vat: 0, purchase_vat: 0, net_vat: 0 });
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('date_from', dateFrom);
    params.set('date_to', dateTo);
    if (opFilter) params.set('operation_type', opFilter);
    if (selectedCustIds.length > 0) params.set('customer_ids', selectedCustIds.join(','));

    const [dashRes, custRes] = await Promise.all([
      fetch(`/api/dashboard?${params}`),
      fetch('/api/customers'),
    ]);
    const dash = await dashRes.json();
    setMonthly(dash.monthly || []);
    setCustomers(dash.customers || []);
    setBenchmarks(dash.benchmarks || {});
    setGrandSum(dash.grand_summary || { grand_total: 0, total_cost: 0, final_profit: 0 });
    setVatSum(dash.vat_summary || { sales_vat: 0, purchase_vat: 0, net_vat: 0 });
    setCustomerOpts(await custRes.json());
    setLoading(false);
  }, [dateFrom, dateTo, opFilter, selectedCustIds]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  // 비교 분석에 사용할 거래처 (선택된 것이 있으면 그 거래처, 없으면 운영구분 필터 결과)
  const compareCustomers = useMemo(() => {
    if (selectedCustIds.length > 0) {
      return customers.filter(c => selectedCustIds.includes(c.customer_id));
    }
    return [];
  }, [customers, selectedCustIds]);

  const filteredCustomerOpts = opFilter
    ? customerOpts.filter(c => (c.operation_type || '대리점') === opFilter)
    : customerOpts;

  const toggleCustomer = (id: number) => {
    setSelectedCustIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const applyPreset = (key: string) => {
    const p = getPreset(key);
    setDateFrom(p.from); setDateTo(p.to);
  };

  // 월별 차트 (선택된 거래처 비교 시 거래처별 라인)
  const monthlyChart = monthly.map(m => ({
    name: m.month.substring(5) + '월',
    매출: m.grand_total,
    비용: m.total_cost,
    순익: m.final_profit,
  }));

  // 평균 대비 비교 헬퍼
  const diffPct = (val: number, avg: number) => {
    if (avg === 0) return null;
    return ((val - avg) / avg) * 100;
  };
  const DiffBadge = ({ val, avg, inverse = false }: { val: number; avg: number; inverse?: boolean }) => {
    const pct = diffPct(val, avg);
    if (pct === null || Math.abs(pct) < 0.1) {
      return <span className="inline-flex items-center text-[10px] text-gray-400 gap-0.5"><Minus size={10}/>0%</span>;
    }
    const isGood = inverse ? pct < 0 : pct > 0;
    const color = Math.abs(pct) < 5 ? 'text-gray-500' : isGood ? 'text-emerald-600' : 'text-red-600';
    return (
      <span className={`inline-flex items-center text-[10px] font-medium gap-0.5 ${color}`}>
        {pct > 0 ? <ArrowUp size={10}/> : <ArrowDown size={10}/>}
        {Math.abs(pct).toFixed(1)}%
      </span>
    );
  };

  if (loading) return <div className="p-8 text-center text-gray-400">대시보드를 불러오는 중...</div>;

  return (
    <>
      <PageHeader
        title="대시보드"
        description={`${dateFrom} ~ ${dateTo}`}
      />

      {/* 필터 바 */}
      <div className="card mb-4 space-y-3">
        {/* 기간 */}
        <div className="flex flex-wrap items-center gap-2">
          <Calendar size={16} className="text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">기간:</span>
          <input type="date" className="form-input w-auto text-sm py-1" value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)} />
          <span className="text-gray-400">~</span>
          <input type="date" className="form-input w-auto text-sm py-1" value={dateTo}
            onChange={(e) => setDateTo(e.target.value)} />
          <div className="flex gap-1 ml-2">
            {['이번달','이번분기','최근3개월','최근6개월','올해','작년'].map(k => (
              <button key={k} onClick={() => applyPreset(k)}
                className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">
                {k}
              </button>
            ))}
          </div>
        </div>

        {/* 운영구분 */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">운영구분:</span>
          <button onClick={() => setOpFilter('')}
            className={`px-3 py-1 rounded text-xs font-medium border-2 transition ${
              !opFilter ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-gray-600 border-gray-200'
            }`}>전체</button>
          {OPERATION_TYPES.map(op => (
            <button key={op} onClick={() => setOpFilter(op)}
              className={`px-3 py-1 rounded text-xs font-medium border-2 transition ${
                opFilter === op
                  ? op === '본사' ? 'bg-purple-600 text-white border-purple-600'
                    : op === '직영' ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}>{op}</button>
          ))}
        </div>

        {/* 거래처 다중 선택 */}
        <div className="flex flex-wrap items-start gap-2">
          <span className="text-sm font-semibold text-gray-700 pt-1.5">비교 거래처:</span>
          <div className="flex-1 min-w-[300px]">
            <select className="form-select text-sm" value=""
              onChange={(e) => {
                const id = Number(e.target.value);
                if (id && !selectedCustIds.includes(id)) toggleCustomer(id);
              }}>
              <option value="">거래처 추가 (여러 개 선택 가능)</option>
              {filteredCustomerOpts
                .filter(c => !selectedCustIds.includes(c.id))
                .map(c => (
                  <option key={c.id} value={c.id}>
                    {c.company_name} ({c.operation_type || '대리점'})
                  </option>
                ))}
            </select>
            {selectedCustIds.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {selectedCustIds.map(id => {
                  const c = customerOpts.find(x => x.id === id);
                  if (!c) return null;
                  const op = (c.operation_type || '대리점') as OperationType;
                  return (
                    <span key={id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs ${OP_COLOR[op]}`}>
                      <span className={`w-2 h-2 rounded-full ${OP_DOT[op]}`}></span>
                      {c.company_name}
                      <button onClick={() => toggleCustomer(id)} className="ml-1 hover:bg-white/50 rounded-full">
                        <X size={12} />
                      </button>
                    </span>
                  );
                })}
                <button onClick={() => setSelectedCustIds([])}
                  className="text-xs text-gray-500 px-2 hover:underline">전체 해제</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="card flex items-center gap-3">
          <div className="p-3 bg-blue-100 rounded-lg"><TrendingUp size={22} className="text-blue-600" /></div>
          <div>
            <p className="text-xs text-gray-500">총 매출</p>
            <p className="text-lg font-bold">{formatKRW(grandSum.grand_total)}원</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="p-3 bg-amber-100 rounded-lg"><Wallet size={22} className="text-amber-600" /></div>
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
          <div className="p-3 bg-red-100 rounded-lg"><AlertCircle size={22} className="text-red-500" /></div>
          <div>
            <p className="text-xs text-gray-500">미입금</p>
            <p className="text-lg font-bold text-red-500">{formatKRW(customers.reduce((s,c)=>s+c.unpaid_total,0))}원</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="p-3 bg-amber-100 rounded-lg"><Receipt size={22} className="text-amber-600" /></div>
          <div>
            <p className="text-xs text-gray-500">납부예정 부가세</p>
            <p className="text-lg font-bold text-amber-600">{formatKRW(vatSum.net_vat)}원</p>
          </div>
        </div>
      </div>

      {/* 벤치마크 카드 */}
      <div className="card mb-6">
        <h3 className="font-semibold text-sm mb-3 text-gray-700">📊 기간 내 평균 지표 (벤치마크)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(['본사','직영','대리점','전체'] as const).map(op => {
            const b = benchmarks[op];
            if (!b) return null;
            const colors = op === '본사' ? 'bg-purple-50 border-purple-200'
              : op === '직영' ? 'bg-blue-50 border-blue-200'
              : op === '대리점' ? 'bg-emerald-50 border-emerald-200'
              : 'bg-gray-50 border-gray-200';
            return (
              <div key={op} className={`p-3 rounded-lg border-2 ${colors}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold">{op} 평균</span>
                  <span className="text-[10px] text-gray-500">({b.count}개 거래처)</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[11px]">
                  <div><span className="text-gray-500">매출:</span> <span className="font-medium">{formatKRW(b.grand_total)}</span></div>
                  <div><span className="text-gray-500">비용:</span> <span className="font-medium text-amber-700">{formatKRW(b.total_cost)}</span></div>
                  <div><span className="text-gray-500">원가율:</span> <span className="font-medium">{(b.cost_ratio*100).toFixed(1)}%</span></div>
                  <div><span className="text-gray-500">순익:</span> <span className={`font-medium ${b.final_profit<0?'text-red-600':'text-emerald-600'}`}>{formatKRW(b.final_profit)}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 비교 분석 (거래처 선택 시) */}
      {compareCustomers.length > 0 && (
        <div className="card p-0 overflow-hidden mb-6 border-2 border-blue-400">
          <div className="px-4 py-3 border-b bg-blue-50 font-semibold text-sm flex items-center gap-2">
            <Plus size={16} className="text-blue-600" />
            거래처 비교 분석 ({compareCustomers.length}개 거래처 vs 벤치마크 평균)
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="text-left sticky left-0 bg-white z-10">지표</th>
                  {compareCustomers.map(c => (
                    <th key={c.customer_id} className="text-right min-w-[140px]">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="font-bold">{c.customer_name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${OP_COLOR[c.operation_type]}`}>{c.operation_type}</span>
                      </div>
                    </th>
                  ))}
                  <th className="text-right min-w-[110px] bg-purple-50">본사평균</th>
                  <th className="text-right min-w-[110px] bg-blue-50">직영평균</th>
                  <th className="text-right min-w-[110px] bg-emerald-50">대리점평균</th>
                  <th className="text-right min-w-[110px] bg-gray-50">전체평균</th>
                </tr>
              </thead>
              <tbody>
                {/* 매출 */}
                <tr>
                  <td className="font-bold sticky left-0 bg-white">매출</td>
                  {compareCustomers.map(c => {
                    const bench = benchmarks[c.operation_type];
                    return (
                      <td key={c.customer_id} className="text-right">
                        <div className="font-bold">{formatKRW(c.grand_total)}</div>
                        {bench && <DiffBadge val={c.grand_total} avg={bench.grand_total} />}
                      </td>
                    );
                  })}
                  <td className="text-right bg-purple-50 text-purple-700">{formatKRW(benchmarks.본사?.grand_total || 0)}</td>
                  <td className="text-right bg-blue-50 text-blue-700">{formatKRW(benchmarks.직영?.grand_total || 0)}</td>
                  <td className="text-right bg-emerald-50 text-emerald-700">{formatKRW(benchmarks.대리점?.grand_total || 0)}</td>
                  <td className="text-right bg-gray-50">{formatKRW(benchmarks.전체?.grand_total || 0)}</td>
                </tr>
                {/* 비용 */}
                <tr>
                  <td className="font-bold sticky left-0 bg-white">비용</td>
                  {compareCustomers.map(c => {
                    const bench = benchmarks[c.operation_type];
                    return (
                      <td key={c.customer_id} className="text-right">
                        <div className="font-bold text-amber-700">{formatKRW(c.total_cost)}</div>
                        {bench && <DiffBadge val={c.total_cost} avg={bench.total_cost} inverse />}
                      </td>
                    );
                  })}
                  <td className="text-right bg-purple-50 text-amber-700">{formatKRW(benchmarks.본사?.total_cost || 0)}</td>
                  <td className="text-right bg-blue-50 text-amber-700">{formatKRW(benchmarks.직영?.total_cost || 0)}</td>
                  <td className="text-right bg-emerald-50 text-amber-700">{formatKRW(benchmarks.대리점?.total_cost || 0)}</td>
                  <td className="text-right bg-gray-50 text-amber-700">{formatKRW(benchmarks.전체?.total_cost || 0)}</td>
                </tr>
                {/* 원가율 */}
                <tr>
                  <td className="font-bold sticky left-0 bg-white">원가율</td>
                  {compareCustomers.map(c => {
                    const bench = benchmarks[c.operation_type];
                    return (
                      <td key={c.customer_id} className="text-right">
                        <div className={`font-bold ${c.cost_ratio > 0.7 ? 'text-red-600' : c.cost_ratio > 0.5 ? 'text-orange-500' : ''}`}>
                          {(c.cost_ratio * 100).toFixed(1)}%
                        </div>
                        {bench && <DiffBadge val={c.cost_ratio} avg={bench.cost_ratio} inverse />}
                      </td>
                    );
                  })}
                  <td className="text-right bg-purple-50">{((benchmarks.본사?.cost_ratio || 0) * 100).toFixed(1)}%</td>
                  <td className="text-right bg-blue-50">{((benchmarks.직영?.cost_ratio || 0) * 100).toFixed(1)}%</td>
                  <td className="text-right bg-emerald-50">{((benchmarks.대리점?.cost_ratio || 0) * 100).toFixed(1)}%</td>
                  <td className="text-right bg-gray-50">{((benchmarks.전체?.cost_ratio || 0) * 100).toFixed(1)}%</td>
                </tr>
                {/* 최종 순익 */}
                <tr className="bg-yellow-50">
                  <td className="font-bold sticky left-0 bg-yellow-50">최종 순익</td>
                  {compareCustomers.map(c => {
                    const bench = benchmarks[c.operation_type];
                    return (
                      <td key={c.customer_id} className="text-right">
                        <div className={`font-bold text-base ${c.final_profit < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {formatKRW(c.final_profit)}
                        </div>
                        {bench && <DiffBadge val={c.final_profit} avg={bench.final_profit} />}
                      </td>
                    );
                  })}
                  <td className="text-right bg-purple-100">{formatKRW(benchmarks.본사?.final_profit || 0)}</td>
                  <td className="text-right bg-blue-100">{formatKRW(benchmarks.직영?.final_profit || 0)}</td>
                  <td className="text-right bg-emerald-100">{formatKRW(benchmarks.대리점?.final_profit || 0)}</td>
                  <td className="text-right bg-gray-100">{formatKRW(benchmarks.전체?.final_profit || 0)}</td>
                </tr>
                {/* 미입금 */}
                <tr>
                  <td className="font-bold sticky left-0 bg-white">미입금</td>
                  {compareCustomers.map(c => (
                    <td key={c.customer_id} className="text-right">
                      <div className="text-red-500 font-medium">{formatKRW(c.unpaid_total)}</div>
                    </td>
                  ))}
                  <td className="text-right bg-purple-50 text-red-500">{formatKRW(benchmarks.본사?.unpaid_total || 0)}</td>
                  <td className="text-right bg-blue-50 text-red-500">{formatKRW(benchmarks.직영?.unpaid_total || 0)}</td>
                  <td className="text-right bg-emerald-50 text-red-500">{formatKRW(benchmarks.대리점?.unpaid_total || 0)}</td>
                  <td className="text-right bg-gray-50 text-red-500">{formatKRW(benchmarks.전체?.unpaid_total || 0)}</td>
                </tr>
                {/* 매출VAT */}
                <tr>
                  <td className="font-bold sticky left-0 bg-white text-xs">매출VAT</td>
                  {compareCustomers.map(c => (
                    <td key={c.customer_id} className="text-right text-blue-600">{formatKRW(c.sales_vat)}</td>
                  ))}
                  <td className="text-right bg-purple-50 text-blue-600">{formatKRW(benchmarks.본사?.sales_vat || 0)}</td>
                  <td className="text-right bg-blue-50 text-blue-600">{formatKRW(benchmarks.직영?.sales_vat || 0)}</td>
                  <td className="text-right bg-emerald-50 text-blue-600">{formatKRW(benchmarks.대리점?.sales_vat || 0)}</td>
                  <td className="text-right bg-gray-50 text-blue-600">{formatKRW(benchmarks.전체?.sales_vat || 0)}</td>
                </tr>
                {/* 납부VAT */}
                <tr>
                  <td className="font-bold sticky left-0 bg-white text-xs">납부VAT</td>
                  {compareCustomers.map(c => (
                    <td key={c.customer_id} className="text-right text-amber-600 font-medium">{formatKRW(c.net_vat)}</td>
                  ))}
                  <td className="text-right bg-purple-50 text-amber-600">{formatKRW(benchmarks.본사?.net_vat || 0)}</td>
                  <td className="text-right bg-blue-50 text-amber-600">{formatKRW(benchmarks.직영?.net_vat || 0)}</td>
                  <td className="text-right bg-emerald-50 text-amber-600">{formatKRW(benchmarks.대리점?.net_vat || 0)}</td>
                  <td className="text-right bg-gray-50 text-amber-600">{formatKRW(benchmarks.전체?.net_vat || 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                <Legend />
                <Bar dataKey="매출" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="비용" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="순익" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 선택 거래처 매출 추이 라인 차트 */}
        <div className="card">
          <h3 className="font-semibold mb-4">
            {compareCustomers.length > 0 ? '선택 거래처 월별 순익 비교' : '월별 누적 순익 추이'}
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                <Tooltip formatter={(v) => formatKRW(Number(v)) + '원'} />
                <Legend />
                <Line type="monotone" dataKey="순익" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="매출" stroke="#3b82f6" strokeWidth={1} strokeDasharray="3 3" />
                <Line type="monotone" dataKey="비용" stroke="#f59e0b" strokeWidth={1} strokeDasharray="3 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 거래처 전체 손익 표 */}
      <div className="card p-0 overflow-hidden mb-6">
        <div className="px-4 py-3 border-b bg-slate-50 font-semibold text-sm">
          거래처별 손익 현황 {opFilter && `(${opFilter}만)`}
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
                <th className="text-center">평균 대비</th>
                <th className="w-20"></th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const bench = benchmarks[c.operation_type];
                return (
                  <tr key={c.customer_id} className={selectedCustIds.includes(c.customer_id) ? 'bg-blue-50' : ''}>
                    <td className="font-medium">{c.customer_name}</td>
                    <td className="text-center">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded-full border ${OP_COLOR[c.operation_type]}`}>
                        {c.operation_type}
                      </span>
                    </td>
                    <td className="text-right font-medium">{formatKRW(c.grand_total)}</td>
                    <td className="text-right text-amber-700">{formatKRW(c.total_cost)}</td>
                    <td className="text-right">
                      <span className={c.cost_ratio > 0.7 ? 'text-red-600 font-bold' : c.cost_ratio > 0.5 ? 'text-orange-500' : ''}>
                        {(c.cost_ratio * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className={`text-right font-bold ${c.final_profit < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {formatKRW(c.final_profit)}원
                    </td>
                    <td className="text-center">
                      {bench && <DiffBadge val={c.final_profit} avg={bench.final_profit} />}
                    </td>
                    <td>
                      <button onClick={() => toggleCustomer(c.customer_id)}
                        className={`text-xs px-2 py-1 rounded ${
                          selectedCustIds.includes(c.customer_id)
                            ? 'bg-blue-600 text-white'
                            : 'border border-gray-300 hover:bg-gray-100'
                        }`}>
                        {selectedCustIds.includes(c.customer_id) ? '비교 중' : '비교'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {customers.length === 0 && (
                <tr><td colSpan={8} className="text-center py-6 text-gray-400">데이터 없음</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
