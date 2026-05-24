'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Wallet, Calendar, Crown, Building2, Sigma, Receipt,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { formatKRW } from '@/lib/calculator';

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

interface CostCat {
  category: string;
  amount: number;
  ratio: number;
  material_part?: number;
  purchase_part?: number;
  cost_tab_part: number;
}

interface HqStats {
  period: { date_from: string; date_to: string };
  hq: {
    revenue: number; cost: number; profit: number;
    breakdown: {
      order_revenue: number; royalty_revenue: number; manual_revenue: number;
      material_cost: number; other_cost: number;
    };
    cost_by_category: CostCat[];
  };
  main_stores: {
    revenue: number; cost: number; profit: number;
    cost_purchase: number; cost_other: number;
    stores: { id: number; name: string; brand: string; revenue: number; cost: number; profit: number; cost_purchase: number; cost_other: number }[];
    cost_by_category: CostCat[];
  };
  total: { revenue: number; cost: number; profit: number };
  monthly: {
    month: string;
    hq_revenue: number; hq_cost: number; hq_profit: number;
    main_revenue: number; main_cost: number; main_profit: number;
    total_revenue: number; total_cost: number; total_profit: number;
  }[];
  is_manager: boolean;
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
              <div className="flex justify-between"><span>· 발주 매출</span><span className="font-medium">{formatKRW(stats.hq.breakdown.order_revenue)}</span></div>
              <div className="flex justify-between"><span>· 로열티 매출 (자동)</span><span className="font-medium text-amber-700">{formatKRW(stats.hq.breakdown.royalty_revenue)}</span></div>
              <div className="flex justify-between"><span>· 본사 기타 매출 (수기)</span><span className="font-medium">{formatKRW(stats.hq.breakdown.manual_revenue)}</span></div>
            </div>
          </div>
          <div className="card border-2 border-amber-200 bg-amber-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-amber-700">비용</span>
              <Wallet size={18} className="text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-amber-700">{formatKRW(stats.hq.cost)}원</p>
            <div className="mt-3 space-y-1 text-xs text-gray-600">
              <div className="flex justify-between"><span>· 발주 재료원가</span><span className="font-medium">{formatKRW(stats.hq.breakdown.material_cost)}</span></div>
              <div className="flex justify-between"><span>· 본사 운영비 (인건비/임차료 등)</span><span className="font-medium">{formatKRW(stats.hq.breakdown.other_cost)}</span></div>
            </div>
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

        {/* 본사 비용 카테고리별 (매출 대비) */}
        {stats.hq.cost_by_category.length > 0 && (
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b bg-amber-50 font-semibold text-sm">
              본사 비용 구분별 (본사 매출 대비 비율)
              <span className="text-xs text-gray-500 font-normal ml-2">* 식재료비 = 발주재료원가 + 비용탭 직접 기입</span>
            </div>
            <table className="data-table">
              <thead><tr><th>구분</th><th className="text-right">금액</th><th className="text-right">비율</th></tr></thead>
              <tbody>
                {stats.hq.cost_by_category.map(c => {
                  const isFood = c.category === '식재료비';
                  const ratioColor = c.ratio > 0.3 ? 'text-red-600 font-bold' : c.ratio > 0.15 ? 'text-orange-500' : 'text-gray-500';
                  return (
                    <tr key={c.category}>
                      <td>
                        <div>{c.category}</div>
                        {isFood && c.amount > 0 && (
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            발주재료원가 {formatKRW(c.material_part || 0)} + 직접 기입 {formatKRW(c.cost_tab_part)}
                          </div>
                        )}
                      </td>
                      <td className="text-right text-amber-700 font-medium align-top">{formatKRW(c.amount)}원</td>
                      <td className={`text-right ${ratioColor} align-top`}>{(c.ratio * 100).toFixed(1)}%</td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-50 font-semibold">
                  <td>합계</td>
                  <td className="text-right text-amber-800">{formatKRW(stats.hq.cost)}원</td>
                  <td className="text-right text-gray-700">
                    {stats.hq.revenue > 0 ? ((stats.hq.cost / stats.hq.revenue) * 100).toFixed(1) : '0'}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
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
            <div className="mt-3 space-y-1 text-xs text-gray-600">
              <div className="flex justify-between"><span>· 본사로부터 매입 (발주)</span><span className="font-medium">{formatKRW(stats.main_stores.cost_purchase)}</span></div>
              <div className="flex justify-between"><span>· 기타 운영비 (비용 탭)</span><span className="font-medium">{formatKRW(stats.main_stores.cost_other)}</span></div>
            </div>
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

        {/* 본점별 상세 */}
        {stats.main_stores.stores.length > 0 && (
          <div className="card p-0 overflow-hidden mb-3">
            <div className="px-4 py-3 border-b bg-slate-50 font-semibold text-sm">본점별 손익</div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>본점명</th>
                  <th>브랜드</th>
                  <th className="text-right">매출</th>
                  <th className="text-right">매입(발주)</th>
                  <th className="text-right">기타비용</th>
                  <th className="text-right">총 비용</th>
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
                    <td className="text-right text-red-600">{formatKRW(s.cost_purchase)}</td>
                    <td className="text-right text-amber-700">{formatKRW(s.cost_other)}</td>
                    <td className="text-right font-medium">{formatKRW(s.cost)}</td>
                    <td className={`text-right font-bold ${s.profit < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatKRW(s.profit)}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 본점 비용 카테고리별 */}
        {stats.main_stores.cost_by_category.length > 0 && (
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b bg-amber-50 font-semibold text-sm">
              본점 비용 구분별 (본점 매출 대비 비율)
              <span className="text-xs text-gray-500 font-normal ml-2">* 식재료비 = 본사로부터 매입(발주) + 비용탭 직접 기입</span>
            </div>
            <table className="data-table">
              <thead><tr><th>구분</th><th className="text-right">금액</th><th className="text-right">비율</th></tr></thead>
              <tbody>
                {stats.main_stores.cost_by_category.map(c => {
                  const isFood = c.category === '식재료비';
                  const ratioColor = c.ratio > 0.3 ? 'text-red-600 font-bold' : c.ratio > 0.15 ? 'text-orange-500' : 'text-gray-500';
                  return (
                    <tr key={c.category}>
                      <td>
                        <div>{c.category}</div>
                        {isFood && c.amount > 0 && (
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            발주매입 {formatKRW(c.purchase_part || 0)} + 직접 기입 {formatKRW(c.cost_tab_part)}
                          </div>
                        )}
                      </td>
                      <td className="text-right text-amber-700 font-medium align-top">{formatKRW(c.amount)}원</td>
                      <td className={`text-right ${ratioColor} align-top`}>{(c.ratio * 100).toFixed(1)}%</td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-50 font-semibold">
                  <td>합계</td>
                  <td className="text-right text-amber-800">{formatKRW(stats.main_stores.cost)}원</td>
                  <td className="text-right text-gray-700">
                    {stats.main_stores.revenue > 0 ? ((stats.main_stores.cost / stats.main_stores.revenue) * 100).toFixed(1) : '0'}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 3: 합계 */}
      {!isManager && (
        <div className="mb-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-3">
            <Sigma size={18} className="text-slate-700" /> 3. 본사 총합 (1 + 2)
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
              {!isManager && <Bar dataKey="총 순익" fill="#10b981" radius={[4, 4, 0, 0]} />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
