'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Fragment } from 'react';
import { TrendingUp, TrendingDown, Wallet, Receipt, Calendar, ChevronDown } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { formatKRW } from '@/lib/calculator';
import { Customer, OPERATION_TYPES, OperationType, CostGroup } from '@/types';

function ratioCls(r: number) {
  return r > 0.3 ? 'text-red-600 font-bold' : r > 0.15 ? 'text-orange-500' : 'text-gray-500';
}

const OP_BADGE: Record<OperationType, string> = {
  '본점': 'bg-purple-100 text-purple-700',
  '직영점': 'bg-blue-100 text-blue-700',
  '가맹점': 'bg-emerald-100 text-emerald-700',
  '초도물품': 'bg-amber-100 text-amber-700',
};

function getPreset(key: string) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  switch (key) {
    case '이번달': return { from: fmt(new Date(y, m, 1)), to: fmt(new Date(y, m + 1, 0)) };
    case '최근3개월': return { from: fmt(new Date(y, m - 2, 1)), to: fmt(new Date(y, m + 1, 0)) };
    case '최근6개월': return { from: fmt(new Date(y, m - 5, 1)), to: fmt(new Date(y, m + 1, 0)) };
    case '올해': return { from: `${y}-01-01`, to: `${y}-12-31` };
    case '작년': return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    default: return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
}

interface Stats {
  customer: { id: number; company_name: string; brand: string; operation_type: OperationType; contact_name: string; };
  period: { date_from: string; date_to: string };
  summary: { total_revenue: number; total_cost_other: number; total_cost_purchase: number; total_cost: number; total_profit: number; cost_ratio: number; total_purchase_ref: number };
  monthly: { month: string; revenue: number; cost_other: number; cost_purchase: number; total_cost: number; profit: number }[];
  revenue_by_category: { category: string; total: number; ratio: number }[];
  cost_groups: CostGroup[];
  revenues: { id: number; settlement_month: string; category: string; amount: number; notes: string; source: string }[];
  costs: { id: number; settlement_month: string; category: string; amount: number; notes: string }[];
  purchases: { id: number; date: string; supply_total: number; vat_total: number; grand_total: number; payment_status: string; source: string; order_number: string }[];
}

export default function CustomerStatsPage() {
  const initial = getPreset('올해');
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [brandFilter, setBrandFilter] = useState('');
  const [opFilter, setOpFilter] = useState<'' | OperationType>('');
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [brandOptions, setBrandOptions] = useState<string[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [custDropdownOpen, setCustDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 거래처/브랜드 로드
  useEffect(() => {
    (async () => {
      const [cRes, sRes] = await Promise.all([
        fetch('/api/customers'),
        fetch('/api/settings'),
      ]);
      setCustomers(await cRes.json());
      try {
        const s = await sRes.json();
        setBrandOptions(Array.isArray(s?.brands) ? s.brands : []);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setCustDropdownOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const fetchStats = useCallback(async () => {
    if (!customerId) { setStats(null); return; }
    setLoading(true);
    const params = new URLSearchParams();
    params.set('customer_id', String(customerId));
    params.set('date_from', dateFrom);
    params.set('date_to', dateTo);
    try {
      const res = await fetch(`/api/customer-stats?${params}`);
      if (res.ok) setStats(await res.json());
      else setStats(null);
    } catch { setStats(null); }
    setLoading(false);
  }, [customerId, dateFrom, dateTo]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const applyPreset = (key: string) => {
    const p = getPreset(key);
    setDateFrom(p.from); setDateTo(p.to);
  };

  const filteredCustomerOpts = customers.filter(c => {
    if (brandFilter && (c.brand || '') !== brandFilter) return false;
    if (opFilter && (c.operation_type || '가맹점') !== opFilter) return false;
    return true;
  });

  const monthlyChart = stats?.monthly.map(m => ({
    name: m.month.substring(5) + '월',
    매출: m.revenue,
    비용: m.cost_other,
    순익: m.profit,
  })) || [];

  return (
    <>
      <PageHeader
        title="통계 (거래처)"
        description="한 거래처의 매출/매입/비용/순익 상세 조회"
      />

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
            {['이번달','최근3개월','최근6개월','올해','작년'].map(k => (
              <button key={k} onClick={() => applyPreset(k)}
                className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">{k}</button>
            ))}
          </div>
        </div>

        {/* 1차/2차/3차 */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="form-label">1차: 브랜드</label>
            <select className="form-select" value={brandFilter}
              onChange={(e) => { setBrandFilter(e.target.value); setCustomerId(null); }}>
              <option value="">전체 브랜드</option>
              {brandOptions.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">2차: 운영구분</label>
            <select className="form-select" value={opFilter}
              onChange={(e) => { setOpFilter(e.target.value as OperationType | ''); setCustomerId(null); }}>
              <option value="">전체 운영구분</option>
              {OPERATION_TYPES.map(op => <option key={op} value={op}>{op}</option>)}
            </select>
          </div>
          <div className="relative" ref={dropdownRef}>
            <label className="form-label">3차: 거래처 선택 * ({filteredCustomerOpts.length}곳)</label>
            <button type="button"
              onClick={() => setCustDropdownOpen(!custDropdownOpen)}
              className="form-select flex items-center justify-between w-full text-left">
              {(() => {
                const sel = customers.find(c => c.id === customerId);
                if (!sel) return <span className="text-gray-400">거래처를 선택하세요</span>;
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
                {filteredCustomerOpts.length === 0 && (
                  <div className="px-3 py-4 text-sm text-gray-400 text-center">조건에 맞는 거래처가 없습니다</div>
                )}
                {filteredCustomerOpts.map(c => {
                  const op = (c.operation_type || '가맹점') as OperationType;
                  return (
                    <button type="button" key={c.id}
                      onClick={() => { setCustomerId(c.id); setCustDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 transition ${
                        c.id === customerId ? 'bg-blue-50' : 'hover:bg-gray-50'
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
      </div>

      {!customerId && (
        <div className="card text-center py-12 text-gray-400">
          상단에서 거래처를 선택하면 상세 통계가 표시됩니다.
        </div>
      )}

      {customerId && loading && (
        <div className="card text-center py-8 text-gray-400">불러오는 중...</div>
      )}

      {customerId && stats && !loading && (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="card flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg"><TrendingUp size={22} className="text-blue-600" /></div>
              <div>
                <p className="text-xs text-gray-500">총 매출</p>
                <p className="text-lg font-bold text-blue-700">{formatKRW(stats.summary.total_revenue)}원</p>
              </div>
            </div>
            <div className="card flex items-center gap-3">
              <div className="p-3 bg-amber-100 rounded-lg"><Wallet size={22} className="text-amber-600" /></div>
              <div>
                <p className="text-xs text-gray-500">총 비용</p>
                <p className="text-lg font-bold text-amber-700">{formatKRW(stats.summary.total_cost)}원</p>
                <p className="text-[10px] text-gray-400">비용 탭 수기 입력 기준</p>
              </div>
            </div>
            <div className={`card flex items-center gap-3 ${stats.summary.total_profit < 0 ? 'border-red-300 bg-red-50' : ''}`}>
              <div className={`p-3 rounded-lg ${stats.summary.total_profit < 0 ? 'bg-red-100' : 'bg-emerald-100'}`}>
                {stats.summary.total_profit < 0 ? <TrendingDown size={22} className="text-red-600" /> : <TrendingUp size={22} className="text-emerald-600" />}
              </div>
              <div>
                <p className="text-xs text-gray-500">순익</p>
                <p className={`text-lg font-bold ${stats.summary.total_profit < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {formatKRW(stats.summary.total_profit)}원
                </p>
                <p className="text-[10px] text-gray-400">매출 − 비용</p>
              </div>
            </div>
            <div className="card flex items-center gap-3">
              <div className="p-3 bg-orange-100 rounded-lg"><Receipt size={22} className="text-orange-600" /></div>
              <div>
                <p className="text-xs text-gray-500">원가율</p>
                <p className={`text-lg font-bold ${stats.summary.cost_ratio > 0.7 ? 'text-red-600' : stats.summary.cost_ratio > 0.5 ? 'text-orange-600' : 'text-gray-700'}`}>
                  {(stats.summary.cost_ratio * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          {/* 월별 차트 */}
          <div className="card mb-6">
            <h3 className="font-semibold mb-3">월별 매출 / 비용 / 순익</h3>
            <div className="h-[320px]">
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

          {/* 카테고리별 + 월별 표 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="card p-0 overflow-hidden">
              <div className="px-4 py-3 border-b bg-blue-50 font-semibold text-sm">매출 구분별 (매출 대비 비율)</div>
              <table className="data-table">
                <thead><tr><th>구분</th><th className="text-right">금액</th><th className="text-right">비율</th></tr></thead>
                <tbody>
                  {stats.revenue_by_category.map(r => (
                    <tr key={r.category}>
                      <td>{r.category}</td>
                      <td className="text-right text-blue-700 font-medium">{formatKRW(r.total)}원</td>
                      <td className="text-right text-gray-500">{(r.ratio * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                  {stats.revenue_by_category.length === 0 && (
                    <tr><td colSpan={3} className="text-center py-4 text-gray-400">매출 없음</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="card p-0 overflow-hidden">
              <div className="px-4 py-3 border-b bg-amber-50 font-semibold text-sm">
                비용 구분별 (매출 대비 비율)
                <span className="text-xs text-gray-500 font-normal ml-2">* 비용 탭 수기 입력 기준</span>
              </div>
              <table className="data-table">
                <thead><tr><th>구분</th><th className="text-right">금액</th><th className="text-right">비율</th></tr></thead>
                <tbody>
                  {stats.cost_groups.map(g => (
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
                  {stats.cost_groups.length === 0 && (
                    <tr><td colSpan={3} className="text-center py-4 text-gray-400">비용 없음</td></tr>
                  )}
                  {stats.cost_groups.length > 0 && (
                    <tr className="bg-gray-50 font-semibold">
                      <td>합계</td>
                      <td className="text-right text-amber-800">{formatKRW(stats.summary.total_cost)}원</td>
                      <td className="text-right text-gray-700">{(stats.summary.cost_ratio * 100).toFixed(1)}%</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 월별 상세 */}
          <div className="card p-0 overflow-hidden mb-6">
            <div className="px-4 py-3 border-b bg-slate-50 font-semibold text-sm">월별 손익 상세</div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>월</th>
                  <th className="text-right">매출</th>
                  <th className="text-right">비용</th>
                  <th className="text-right">순익</th>
                </tr>
              </thead>
              <tbody>
                {stats.monthly.map(m => (
                  <tr key={m.month}>
                    <td className="font-mono">{m.month}</td>
                    <td className="text-right text-blue-700">{formatKRW(m.revenue)}</td>
                    <td className="text-right text-amber-700">{formatKRW(m.total_cost)}</td>
                    <td className={`text-right font-bold ${m.profit < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatKRW(m.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 매출 내역 */}
          <div className="card p-0 overflow-hidden mb-6">
            <div className="px-4 py-3 border-b bg-blue-50 font-semibold text-sm">매출 내역 ({stats.revenues.length}건)</div>
            <table className="data-table">
              <thead>
                <tr><th>정산월</th><th>구분</th><th className="text-right">금액</th><th>비고</th></tr>
              </thead>
              <tbody>
                {stats.revenues.map(r => (
                  <tr key={r.id}>
                    <td className="font-mono">{r.settlement_month}</td>
                    <td><span className="inline-block px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">{r.category}</span></td>
                    <td className="text-right text-blue-700 font-medium">{formatKRW(r.amount)}원</td>
                    <td className="text-gray-500">{r.notes || '-'}</td>
                  </tr>
                ))}
                {stats.revenues.length === 0 && <tr><td colSpan={4} className="text-center py-4 text-gray-400">매출 내역 없음</td></tr>}
              </tbody>
            </table>
          </div>

          {/* 발주 내역 (참고 — 손익 미반영) */}
          <div className="card p-0 overflow-hidden mb-6">
            <div className="px-4 py-3 border-b bg-red-50 font-semibold text-sm">
              발주 내역 ({stats.purchases.length}건)
              <span className="text-xs text-gray-500 font-normal ml-2">* 참고용 — 손익/통계에 반영되지 않음</span>
            </div>
            <table className="data-table">
              <thead>
                <tr><th>일자</th><th>구분</th><th className="text-right">공급가액</th><th className="text-right">부가세</th><th className="text-right">합계</th><th>입금</th></tr>
              </thead>
              <tbody>
                {stats.purchases.map(p => (
                  <tr key={p.id}>
                    <td className="font-mono">{p.date}</td>
                    <td>
                      {p.source === 'order' ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">발주</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">수기</span>
                      )}
                    </td>
                    <td className="text-right">{formatKRW(p.supply_total)}</td>
                    <td className="text-right text-gray-500">{formatKRW(p.vat_total)}</td>
                    <td className="text-right text-red-600 font-medium">{formatKRW(p.grand_total)}원</td>
                    <td>
                      {p.payment_status === 'paid' ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">입금</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">미입금</span>
                      )}
                    </td>
                  </tr>
                ))}
                {stats.purchases.length === 0 && <tr><td colSpan={6} className="text-center py-4 text-gray-400">매입 내역 없음</td></tr>}
              </tbody>
            </table>
          </div>

          {/* 기타 비용 내역 */}
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b bg-amber-50 font-semibold text-sm">비용 내역 ({stats.costs.length}건)</div>
            <table className="data-table">
              <thead>
                <tr><th>정산월</th><th>구분</th><th className="text-right">금액</th><th>비고</th></tr>
              </thead>
              <tbody>
                {stats.costs.map(c => (
                  <tr key={c.id}>
                    <td className="font-mono">{c.settlement_month}</td>
                    <td><span className="inline-block px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">{c.category}</span></td>
                    <td className="text-right text-amber-700 font-medium">{formatKRW(c.amount)}원</td>
                    <td className="text-gray-500">{c.notes || '-'}</td>
                  </tr>
                ))}
                {stats.costs.length === 0 && <tr><td colSpan={4} className="text-center py-4 text-gray-400">비용 내역 없음</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
