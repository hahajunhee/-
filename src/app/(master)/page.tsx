'use client';

import { useEffect, useState, useCallback, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Wallet, Calendar, Crown, Building2, Sigma, Receipt,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { formatKRW } from '@/lib/calculator';
import { CostGroup } from '@/types';

function getPreset(key: string) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  switch (key) {
    case '이번달': return { from: fmt(new Date(y, m, 1)), to: fmt(new Date(y, m + 1, 0)) };
    case '이번분기': { const qStart = Math.floor(m / 3) * 3;
      return { from: fmt(new Date(y, qStart, 1)), to: fmt(new Date(y, qStart + 3, 0)) }; }
    case '최근3개월': return { from: fmt(new Date(y, m - 2, 1)), to: fmt(new Date(y, m + 1, 0)) };
    case '최근6개월': return { from: fmt(new Date(y, m - 5, 1)), to: fmt(new Date(y, m + 1, 0)) };
    case '올해': return { from: `${y}-01-01`, to: `${y}-12-31` };
    case '작년': return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    default: return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
}

interface HqStats {
  period: { date_from: string; date_to: string };
  hq: {
    revenue: number; cost: number; profit: number;
    breakdown: { royalty_revenue: number; manual_revenue: number };
    cost_groups: CostGroup[];
  };
  main_stores: {
    revenue: number; cost: number; profit: number;
    stores: { id: number; name: string; brand: string; revenue: number; cost: number; profit: number }[];
    cost_groups: CostGroup[];
  };
  other_stores: {
    revenue: number; cost: number; profit: number;
    stores: { id: number; name: string; brand: string; operation_type: string; revenue: number; cost: number; profit: number }[];
    cost_groups: CostGroup[];
  };
  total: { revenue: number; cost: number; profit: number };
  monthly: {
    month: string;
    hq_revenue: number; hq_cost: number; hq_profit: number;
    main_revenue: number; main_cost: number; main_profit: number;
    other_revenue: number; other_cost: number; other_profit: number;
    total_revenue: number; total_cost: number; total_profit: number;
  }[];
  is_manager: boolean;
}

function ratioCls(r: number) {
  return r > 0.3 ? 'text-red-600 font-bold' : r > 0.15 ? 'text-orange-500' : 'text-gray-500';
}

// 비용 구분별 (재료원가 등 상위 그룹 + 하위 항목) 표
function CostGroupsTable({ groups, totalCost, revenue, title }: {
  groups: CostGroup[]; totalCost: number; revenue: number; title: string;
}) {
  if (groups.length === 0) return null;
  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-4 py-3 border-b bg-amber-50 font-semibold text-sm">
        {title}
        <span className="text-xs text-gray-500 font-normal ml-2">* 매출 대비 비율 — 비용 탭 수기 입력 기준</span>
      </div>
      <table className="data-table">
        <thead><tr><th>구분</th><th className="text-right">금액</th><th className="text-right">매출 대비</th></tr></thead>
        <tbody>
          {groups.map(g => (
            <Fragment key={g.name}>
              <tr className={g.is_group ? 'bg-amber-50/60' : ''}>
                <td className={g.is_group ? 'font-semibold text-amber-900' : ''}>{g.name}</td>
                <td className="text-right text-amber-700 font-medium">{formatKRW(g.amount)}원</td>
                <td className={`text-right ${ratioCls(g.ratio)}`}>{(g.ratio * 100).toFixed(1)}%</td>
              </tr>
              {g.is_group && g.children.map(ch => (
                <tr key={g.name + ch.category} className="text-gray-500">
                  <td className="pl-8 text-sm">└ {ch.category}</td>
                  <td className="text-right text-sm">{formatKRW(ch.amount)}</td>
                  <td className="text-right text-sm text-gray-400">{(ch.ratio * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </Fragment>
          ))}
          <tr className="bg-gray-50 font-semibold">
            <td>합계</td>
            <td className="text-right text-amber-800">{formatKRW(totalCost)}원</td>
            <td className="text-right text-gray-700">{revenue > 0 ? ((totalCost / revenue) * 100).toFixed(1) : '0'}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function HqStatsPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string>('master');
  useEffect(() => {
    fetch('/api/auth').then(r => r.json()).then(d => {
      if (d?.user?.role) setUserRole(d.user.role);
    }).catch(() => {});
  }, [router]);

  const initial = getPreset('올해');
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [stats, setStats] = useState<HqStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/hq-stats?date_from=${dateFrom}&date_to=${dateTo}`);
      if (res.ok) setStats(await res.json());
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const applyPreset = (key: string) => {
    const p = getPreset(key); setDateFrom(p.from); setDateTo(p.to);
  };

  const monthlyChart = stats?.monthly.map(m => ({
    name: m.month.substring(5) + '월',
    '본사 매출': m.hq_revenue,
    '본사 비용': m.hq_cost,
    '본점 매출': m.main_revenue,
    '본점 비용': m.main_cost,
    '직영/가맹 매출': m.other_revenue,
    '직영/가맹 비용': m.other_cost,
    '총 순익': m.total_profit,
  })) || [];

  if (loading) return <div className="p-8 text-center text-gray-400">불러오는 중...</div>;
  if (!stats) return <div className="p-8 text-center text-red-500">데이터를 불러올 수 없습니다</div>;

  const isManager = userRole === 'manager';

  return (
    <>
      <PageHeader
        title="통계 (본사)"
        description={
          <span className="flex items-center gap-2">
            {dateFrom} ~ {dateTo}
            {refreshing && (
              <span className="inline-flex items-center gap-1 text-xs text-blue-500">
                <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></span>
                갱신 중
              </span>
            )}
          </span>
        }
      />

      {/* 기간 필터 */}
      <div className="card mb-6">
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
                className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">{k}</button>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">* 매출/비용은 매출·비용 탭의 수기 입력 기준으로 집계됩니다. (발주 내역은 통계에 자동 반영되지 않음)</p>
      </div>

      {/* Section 1: 본사 */}
      <div className="mb-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-3">
          <Crown size={18} className="text-amber-600" /> 1. 본사 (SOYANG F&C)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
          <div className="card border-2 border-blue-200 bg-blue-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-blue-700">매출</span>
              <TrendingUp size={18} className="text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-blue-700">{formatKRW(stats.hq.revenue)}원</p>
            <div className="mt-3 space-y-1 text-xs text-gray-600">
              <div className="flex justify-between"><span>· 로열티 매출 (자동)</span><span className="font-medium text-amber-700">{formatKRW(stats.hq.breakdown.royalty_revenue)}</span></div>
              <div className="flex justify-between"><span>· 본사 수기 매출</span><span className="font-medium">{formatKRW(stats.hq.breakdown.manual_revenue)}</span></div>
            </div>
          </div>
          <div className="card border-2 border-amber-200 bg-amber-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-amber-700">비용</span>
              <Wallet size={18} className="text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-amber-700">{formatKRW(stats.hq.cost)}원</p>
            <p className="text-xs text-gray-500 mt-2">비용 탭(본사) 수기 입력 합계</p>
          </div>
          <div className={`card border-2 ${stats.hq.profit < 0 ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-semibold ${stats.hq.profit < 0 ? 'text-red-700' : 'text-emerald-700'}`}>손익</span>
              {stats.hq.profit < 0 ? <TrendingDown size={18} className="text-red-600" /> : <TrendingUp size={18} className="text-emerald-600" />}
            </div>
            <p className={`text-2xl font-bold ${stats.hq.profit < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
              {formatKRW(stats.hq.profit)}원
            </p>
            <p className="text-[10px] text-gray-400 mt-1">매출 − 비용</p>
            <p className="text-xs text-gray-500 mt-3">
              원가율 {stats.hq.revenue > 0 ? ((stats.hq.cost / stats.hq.revenue) * 100).toFixed(1) : '0'}%
            </p>
          </div>
        </div>

        <CostGroupsTable groups={stats.hq.cost_groups} totalCost={stats.hq.cost} revenue={stats.hq.revenue}
          title="본사 비용 구분별 (본사 매출 대비 비율)" />
      </div>

      {/* Section 2: 본점들 */}
      <div className="mb-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-3">
          <Building2 size={18} className="text-purple-600" /> 2. 본점 ({stats.main_stores.stores.length}개)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
          <div className="card border-2 border-blue-200 bg-blue-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-blue-700">매출</span>
              <TrendingUp size={18} className="text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-blue-700">{formatKRW(stats.main_stores.revenue)}원</p>
            <p className="text-xs text-gray-500 mt-2">매출 탭에서 본점들에 기입된 매출 합계</p>
          </div>
          <div className="card border-2 border-amber-200 bg-amber-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-amber-700">비용</span>
              <Wallet size={18} className="text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-amber-700">{formatKRW(stats.main_stores.cost)}원</p>
            <p className="text-xs text-gray-500 mt-2">비용 탭(본점) 수기 입력 합계</p>
          </div>
          <div className={`card border-2 ${stats.main_stores.profit < 0 ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-semibold ${stats.main_stores.profit < 0 ? 'text-red-700' : 'text-emerald-700'}`}>손익</span>
              {stats.main_stores.profit < 0 ? <TrendingDown size={18} className="text-red-600" /> : <TrendingUp size={18} className="text-emerald-600" />}
            </div>
            <p className={`text-2xl font-bold ${stats.main_stores.profit < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
              {formatKRW(stats.main_stores.profit)}원
            </p>
            <p className="text-[10px] text-gray-400 mt-1">매출 − 비용</p>
          </div>
        </div>

        {stats.main_stores.stores.length > 0 && (
          <div className="card p-0 overflow-hidden mb-3">
            <div className="px-4 py-3 border-b bg-slate-50 font-semibold text-sm">본점별 손익</div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>본점명</th>
                  <th>브랜드</th>
                  <th className="text-right">매출</th>
                  <th className="text-right">비용</th>
                  <th className="text-right">손익</th>
                </tr>
              </thead>
              <tbody>
                {stats.main_stores.stores.map(s => (
                  <tr key={s.id}>
                    <td className="font-medium">{s.name}</td>
                    <td>
                      {s.brand ? (
                        <span className="inline-block px-2 py-0.5 text-xs rounded bg-indigo-100 text-indigo-700 font-medium">{s.brand}</span>
                      ) : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="text-right text-blue-700">{formatKRW(s.revenue)}</td>
                    <td className="text-right text-amber-700">{formatKRW(s.cost)}</td>
                    <td className={`text-right font-bold ${s.profit < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatKRW(s.profit)}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <CostGroupsTable groups={stats.main_stores.cost_groups} totalCost={stats.main_stores.cost} revenue={stats.main_stores.revenue}
          title="본점 비용 구분별 (본점 매출 대비 비율)" />
      </div>

      {/* Section 3: 직영점 + 가맹점 */}
      <div className="mb-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-3">
          <Building2 size={18} className="text-blue-600" /> 3. 직영점 / 가맹점 ({stats.other_stores.stores.length}개)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
          <div className="card border-2 border-blue-200 bg-blue-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-blue-700">매출</span>
              <TrendingUp size={18} className="text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-blue-700">{formatKRW(stats.other_stores.revenue)}원</p>
            <p className="text-xs text-gray-500 mt-2">직영점/가맹점에 기입된 매출 합계</p>
          </div>
          <div className="card border-2 border-amber-200 bg-amber-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-amber-700">비용</span>
              <Wallet size={18} className="text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-amber-700">{formatKRW(stats.other_stores.cost)}원</p>
            <p className="text-xs text-gray-500 mt-2">비용 탭(직영점/가맹점) 수기 입력 합계</p>
          </div>
          <div className={`card border-2 ${stats.other_stores.profit < 0 ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-semibold ${stats.other_stores.profit < 0 ? 'text-red-700' : 'text-emerald-700'}`}>손익</span>
              {stats.other_stores.profit < 0 ? <TrendingDown size={18} className="text-red-600" /> : <TrendingUp size={18} className="text-emerald-600" />}
            </div>
            <p className={`text-2xl font-bold ${stats.other_stores.profit < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
              {formatKRW(stats.other_stores.profit)}원
            </p>
            <p className="text-[10px] text-gray-400 mt-1">매출 − 비용</p>
          </div>
        </div>

        {stats.other_stores.stores.length > 0 && (
          <div className="card p-0 overflow-hidden mb-3">
            <div className="px-4 py-3 border-b bg-slate-50 font-semibold text-sm">직영점/가맹점별 손익</div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>매장명</th>
                    <th>브랜드</th>
                    <th className="text-center">구분</th>
                    <th className="text-right">매출</th>
                    <th className="text-right">비용</th>
                    <th className="text-right">손익</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.other_stores.stores.map(s => (
                    <tr key={s.id}>
                      <td className="font-medium">{s.name}</td>
                      <td>
                        {s.brand ? (
                          <span className="inline-block px-2 py-0.5 text-xs rounded bg-indigo-100 text-indigo-700 font-medium">{s.brand}</span>
                        ) : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="text-center">
                        <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${s.operation_type === '직영점' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {s.operation_type}
                        </span>
                      </td>
                      <td className="text-right text-blue-700">{formatKRW(s.revenue)}</td>
                      <td className="text-right text-amber-700">{formatKRW(s.cost)}</td>
                      <td className={`text-right font-bold ${s.profit < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatKRW(s.profit)}원</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <CostGroupsTable groups={stats.other_stores.cost_groups} totalCost={stats.other_stores.cost} revenue={stats.other_stores.revenue}
          title="직영점/가맹점 비용 구분별 (매출 대비 비율)" />
      </div>

      {/* Section 4: 전체 사업 총합 */}
      {!isManager && (
        <div className="mb-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-3">
            <Sigma size={18} className="text-slate-700" /> 4. 전체 사업 총합 (1 + 2 + 3)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card border-2 border-blue-300 bg-blue-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-blue-800">총 매출</span>
                <TrendingUp size={18} className="text-blue-700" />
              </div>
              <p className="text-3xl font-bold text-blue-800">{formatKRW(stats.total.revenue)}원</p>
            </div>
            <div className="card border-2 border-amber-300 bg-amber-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-amber-800">총 비용</span>
                <Wallet size={18} className="text-amber-700" />
              </div>
              <p className="text-3xl font-bold text-amber-800">{formatKRW(stats.total.cost)}원</p>
            </div>
            <div className={`card border-2 ${stats.total.profit < 0 ? 'border-red-300 bg-red-100' : 'border-emerald-300 bg-emerald-100'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-semibold ${stats.total.profit < 0 ? 'text-red-800' : 'text-emerald-800'}`}>총 순익</span>
                {stats.total.profit < 0 ? <TrendingDown size={18} className="text-red-700" /> : <TrendingUp size={18} className="text-emerald-700" />}
              </div>
              <p className={`text-3xl font-bold ${stats.total.profit < 0 ? 'text-red-800' : 'text-emerald-800'}`}>
                {formatKRW(stats.total.profit)}원
              </p>
              <p className="text-xs text-gray-500 mt-1">
                원가율 {stats.total.revenue > 0 ? ((stats.total.cost / stats.total.revenue) * 100).toFixed(1) : '0'}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 월별 차트 */}
      <div className="card">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Receipt size={16} /> 월별 매출 / 비용 / 순익
        </h3>
        <div className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyChart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
              <Tooltip formatter={(v) => formatKRW(Number(v)) + '원'} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="본사 매출" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="본사 비용" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="본점 매출" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="본점 비용" fill="#ec4899" radius={[4, 4, 0, 0]} />
              <Bar dataKey="직영/가맹 매출" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              <Bar dataKey="직영/가맹 비용" fill="#a855f7" radius={[4, 4, 0, 0]} />
              {!isManager && <Bar dataKey="총 순익" fill="#10b981" radius={[4, 4, 0, 0]} />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
