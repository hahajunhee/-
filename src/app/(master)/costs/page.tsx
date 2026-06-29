'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Trash2, Pencil, Save, X, Settings, ChevronDown, Crown } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';
import { Customer, Cost, CostCategory, OPERATION_TYPES, OperationType } from '@/types';
import { formatKRW } from '@/lib/calculator';

const OP_BADGE: Record<OperationType, string> = {
  '본점': 'bg-purple-100 text-purple-700',
  '직영점': 'bg-blue-100 text-blue-700',
  '가맹점': 'bg-emerald-100 text-emerald-700',
  '초도물품': 'bg-amber-100 text-amber-700',
};

export default function CostsPage() {
  const [costs, setCosts] = useState<Cost[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [categories, setCategories] = useState<CostCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const [monthFilter, setMonthFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [opFilter, setOpFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [brandOptions, setBrandOptions] = useState<string[]>([]);
  const [custDropdownOpen, setCustDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Cost | null>(null);
  const [form, setForm] = useState({
    customer_id: '',
    category: '',
    settlement_month: defaultMonth,
    amount: 0,
    notes: '',
  });
  // 모달 내 1·2·3차 필터
  const [modalBrand, setModalBrand] = useState('');
  const [modalOp, setModalOp] = useState<'' | OperationType>('');
  const [modalCustOpen, setModalCustOpen] = useState(false);
  const modalDropdownRef = useRef<HTMLDivElement>(null);

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatGroup, setNewCatGroup] = useState('');   // 새 카테고리의 상위 그룹 ('' = 단독)

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (monthFilter) params.set('month', monthFilter);
    if (customerFilter) params.set('customer_id', customerFilter);
    if (opFilter) params.set('operation_type', opFilter);
    if (brandFilter) params.set('brand', brandFilter);
    const [cRes, cuRes, catRes, sRes] = await Promise.all([
      fetch(`/api/costs?${params}`),
      fetch('/api/customers'),
      fetch('/api/cost-categories'),
      fetch('/api/settings'),
    ]);
    setCosts(await cRes.json());
    setCustomers(await cuRes.json());
    setCategories(await catRes.json());
    try {
      const s = await sRes.json();
      setBrandOptions(Array.isArray(s?.brands) ? s.brands : []);
    } catch {}
    setLoading(false);
  }, [monthFilter, customerFilter, opFilter, brandFilter]);

  // 외부 클릭 시 드롭다운 닫기 (필터/모달 둘 다)
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setCustDropdownOpen(false);
      if (modalDropdownRef.current && !modalDropdownRef.current.contains(e.target as Node)) setModalCustOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // 모달용 거래처 옵션 (브랜드 + 운영구분으로 필터링)
  const modalCustomerOpts = customers.filter(c => {
    if (modalBrand && (c.brand || '') !== modalBrand) return false;
    if (modalOp && (c.operation_type || '가맹점') !== modalOp) return false;
    return true;
  });

  // 1차/2차 필터 적용된 거래처 옵션
  const filteredCustomerOpts = customers.filter(c => {
    if (brandFilter && (c.brand || '') !== brandFilter) return false;
    if (opFilter && (c.operation_type || '가맹점') !== opFilter) return false;
    return true;
  });

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openAdd = () => {
    setEditing(null);
    // 현재 페이지 필터 값을 모달 기본값으로
    setModalBrand(brandFilter);
    setModalOp((opFilter || '') as '' | OperationType);
    setForm({
      customer_id: customerFilter,
      category: categories[0]?.name || '',
      settlement_month: defaultMonth,
      amount: 0,
      notes: '',
    });
    setModalOpen(true);
  };

  const openEdit = (cost: Cost) => {
    setEditing(cost);
    // 편집 대상 거래처의 브랜드/운영구분을 모달 필터에 자동 세팅
    const cust = customers.find(c => c.id === cost.customer_id);
    setModalBrand(cust?.brand || '');
    setModalOp((cust?.operation_type as OperationType) || '');
    setForm({
      customer_id: cost.customer_id == null ? '__hq__' : String(cost.customer_id),
      category: cost.category,
      settlement_month: cost.settlement_month,
      amount: Number(cost.amount),
      notes: cost.notes || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.customer_id || !form.category || !form.settlement_month) {
      toast.error('거래처/비용구분/정산월은 필수입니다');
      return;
    }
    const url = editing ? `/api/costs/${editing.id}` : '/api/costs';
    const method = editing ? 'PUT' : 'POST';
    // __hq__는 본사 비용 → customer_id null로 전송
    const payload = { ...form, customer_id: form.customer_id === '__hq__' ? null : form.customer_id };
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      toast.success(editing ? '수정되었습니다' : '추가되었습니다');
      setModalOpen(false);
      fetchAll();
    } else {
      toast.error('저장 실패');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    const res = await fetch(`/api/costs/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('삭제되었습니다'); fetchAll(); }
  };

  const addCategory = async () => {
    if (!newCatName.trim()) { toast.error('이름을 입력하세요'); return; }
    const res = await fetch('/api/cost-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCatName.trim(), parent_group: newCatGroup || null }),
    });
    if (res.ok) {
      toast.success('추가되었습니다');
      setNewCatName('');
      setNewCatGroup('');
      fetchAll();
    } else {
      const data = await res.json();
      toast.error(data.error || '실패');
    }
  };

  // 카테고리의 상위 그룹 변경 (재료원가 등). '' = 단독
  const setCategoryGroup = async (id: number, group: string) => {
    const res = await fetch(`/api/cost-categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent_group: group || null }),
    });
    if (res.ok) { fetchAll(); } else { toast.error('그룹 변경 실패'); }
  };

  const deleteCategory = async (id: number) => {
    if (!confirm('이 비용 구분을 삭제하시겠습니까?')) return;
    const res = await fetch(`/api/cost-categories/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('삭제되었습니다'); fetchAll(); }
  };

  // 존재하는 그룹명 목록 (재료원가 기본 포함)
  const groupOptions = Array.from(
    new Set(['재료원가', ...categories.map(c => c.parent_group).filter((g): g is string => !!g)])
  );

  const totalAmount = costs.reduce((s, c) => s + Number(c.amount), 0);

  // 카테고리별 합계
  const byCategory: Record<string, number> = {};
  for (const c of costs) {
    byCategory[c.category] = (byCategory[c.category] || 0) + Number(c.amount);
  }

  return (
    <>
      <PageHeader
        title="비용"
        description={`총 ${costs.length}건 / ${formatKRW(totalAmount)}원`}
        action={
          <div className="flex gap-2">
            <button onClick={() => setCatModalOpen(true)} className="btn-secondary">
              <Settings size={16} /> 비용 구분 관리
            </button>
            <button onClick={openAdd} className="btn-primary">
              <Plus size={16} /> 비용 입력
            </button>
          </div>
        }
      />

      {/* 필터 */}
      <div className="card mb-4 space-y-3">
        {/* 1차/2차/3차 (위) */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="form-label">1차: 브랜드</label>
            <select className="form-select" value={brandFilter}
              onChange={(e) => { setBrandFilter(e.target.value); setCustomerFilter(''); }}>
              <option value="">전체 브랜드</option>
              {brandOptions.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">2차: 운영구분</label>
            <select className="form-select" value={opFilter}
              onChange={(e) => { setOpFilter(e.target.value); setCustomerFilter(''); }}>
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
                const sel = customers.find(c => String(c.id) === customerFilter);
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
                  onClick={() => { setCustomerFilter(''); setCustDropdownOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 border-b">
                  전체
                </button>
                {filteredCustomerOpts.length === 0 && (
                  <div className="px-3 py-4 text-sm text-gray-400 text-center">조건에 맞는 거래처가 없습니다</div>
                )}
                {filteredCustomerOpts.map(c => {
                  const op = (c.operation_type || '가맹점') as OperationType;
                  const isSelected = String(c.id) === customerFilter;
                  return (
                    <button type="button" key={c.id}
                      onClick={() => { setCustomerFilter(String(c.id)); setCustDropdownOpen(false); }}
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

        {/* 기존 필터 (아래): 정산 년-월 */}
        <div className="flex flex-wrap gap-3 items-end pt-2 border-t border-gray-100">
          <div>
            <label className="form-label">정산 년-월</label>
            <input type="month" className="form-input" value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)} />
          </div>
          {(monthFilter || customerFilter || opFilter || brandFilter) && (
            <button onClick={() => { setMonthFilter(''); setCustomerFilter(''); setOpFilter(''); setBrandFilter(''); }}
              className="btn-secondary">
              필터 해제
            </button>
          )}
        </div>
      </div>

      {/* 카테고리별 요약 */}
      {Object.keys(byCategory).length > 0 && (
        <div className="card mb-4">
          <h3 className="font-semibold mb-3 text-sm text-gray-700">비용 구분별 합계</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {Object.entries(byCategory).map(([cat, amt]) => (
              <div key={cat} className="text-center p-2 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 truncate" title={cat}>{cat}</p>
                <p className="text-sm font-bold text-amber-700">{formatKRW(amt)}원</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 테이블 */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">불러오는 중...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>정산월</th>
                <th>거래처</th>
                <th className="text-center">운영구분</th>
                <th>비용구분</th>
                <th className="text-right">총금액</th>
                <th>비고</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {costs.map((c) => {
                const isHq = c.customer_id == null;
                return (
                <tr key={c.id}>
                  <td className="font-mono">{c.settlement_month}</td>
                  <td className="font-medium">
                    {isHq ? (
                      <span className="inline-flex items-center gap-1 text-amber-700 font-bold">
                        <Crown size={12} /> 본사 (SOYANG F&C)
                      </span>
                    ) : c.customer_name}
                  </td>
                  <td className="text-center">
                    {isHq ? <span className="text-gray-300">-</span> : (
                      <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${OP_BADGE[(c.operation_type || '가맹점') as OperationType]}`}>
                        {c.operation_type || '가맹점'}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
                      {c.category}
                    </span>
                  </td>
                  <td className="text-right font-medium text-amber-700">{formatKRW(c.amount)}원</td>
                  <td className="text-gray-500 max-w-[300px] truncate" title={c.notes}>{c.notes || '-'}</td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-gray-100">
                        <Pencil size={14} className="text-gray-500" />
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded hover:bg-red-50">
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
              {costs.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">비용 내역이 없습니다</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* 비용 입력 모달 */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? '비용 수정' : '비용 입력'} width="max-w-xl">
        <div className="space-y-4">
          {/* 1차/2차 (모달 내) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">1차: 브랜드</label>
              <select className="form-select" value={modalBrand}
                onChange={(e) => { setModalBrand(e.target.value); setForm({ ...form, customer_id: '' }); }}>
                <option value="">전체 브랜드</option>
                {brandOptions.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">2차: 운영구분</label>
              <select className="form-select" value={modalOp}
                onChange={(e) => { setModalOp(e.target.value as OperationType | ''); setForm({ ...form, customer_id: '' }); }}>
                <option value="">전체 운영구분</option>
                {OPERATION_TYPES.map(op => <option key={op} value={op}>{op}</option>)}
              </select>
            </div>
          </div>

          {/* 3차: 거래처 (색상 배지 드롭다운) — '본사' 선택 시 본사 비용으로 처리 */}
          <div className="relative" ref={modalDropdownRef}>
            <label className="form-label">3차: 거래처 ({modalCustomerOpts.length}곳)</label>
            <button type="button"
              onClick={() => setModalCustOpen(!modalCustOpen)}
              className="form-select flex items-center justify-between w-full text-left">
              {(() => {
                if (form.customer_id === '__hq__') return <span className="flex items-center gap-1 text-amber-700 font-medium"><Crown size={12}/> 본사 (SOYANG F&C)</span>;
                const sel = customers.find(c => String(c.id) === form.customer_id);
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
            {modalCustOpen && (
              <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-[260px] overflow-y-auto">
                <button type="button"
                  onClick={() => { setForm({ ...form, customer_id: '__hq__' }); setModalCustOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 border-b flex items-center gap-1">
                  <Crown size={12} /> 본사 (SOYANG F&C)
                </button>
                {modalCustomerOpts.length === 0 && (
                  <div className="px-3 py-4 text-sm text-gray-400 text-center">조건에 맞는 거래처가 없습니다</div>
                )}
                {modalCustomerOpts.map(c => {
                  const op = (c.operation_type || '가맹점') as OperationType;
                  const isSelected = String(c.id) === form.customer_id;
                  return (
                    <button type="button" key={c.id}
                      onClick={() => { setForm({ ...form, customer_id: String(c.id) }); setModalCustOpen(false); }}
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">비용 구분 *</label>
              <select className="form-select" value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">선택</option>
                {groupOptions.map(g => {
                  const inGroup = categories.filter(c => c.parent_group === g);
                  if (inGroup.length === 0) return null;
                  return (
                    <optgroup key={g} label={g}>
                      {inGroup.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                    </optgroup>
                  );
                })}
                {categories.filter(c => !c.parent_group).map(cat => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">정산 년-월 *</label>
              <input type="month" className="form-input" value={form.settlement_month}
                onChange={(e) => setForm({ ...form, settlement_month: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="form-label">총 금액 (원)</label>
            <input type="number" className="form-input" placeholder="예: 1500000"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
          </div>
          <div>
            <label className="form-label">비고</label>
            <textarea className="form-input" rows={2} value={form.notes}
              placeholder="비용 설명 (선택사항)"
              onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">취소</button>
            <button onClick={handleSave} className="btn-primary">
              <Save size={16} /> {editing ? '수정' : '추가'}
            </button>
          </div>
        </div>
      </Modal>

      {/* 비용 구분 관리 모달 */}
      <Modal open={catModalOpen} onClose={() => setCatModalOpen(false)}
        title="비용 구분 관리" width="max-w-lg">
        <div className="space-y-4">
          <div className="flex gap-2">
            <input type="text" className="form-input flex-1" placeholder="새 비용 구분 이름"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addCategory(); }} />
            <select className="form-select w-32" value={newCatGroup}
              onChange={(e) => setNewCatGroup(e.target.value)}>
              <option value="">그룹 없음</option>
              {groupOptions.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <button onClick={addCategory} className="btn-primary">
              <Plus size={16} /> 추가
            </button>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 border-b text-[11px] text-gray-500 font-medium">
              <span>비용 구분</span>
              <span>상위 그룹</span>
            </div>
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between p-2 border-b last:border-b-0 hover:bg-gray-50 gap-2">
                <span className="text-sm flex-1 truncate">{cat.name}</span>
                <select className="form-select w-32 text-xs py-1" value={cat.parent_group || ''}
                  onChange={(e) => setCategoryGroup(cat.id, e.target.value)}>
                  <option value="">그룹 없음</option>
                  {groupOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <button onClick={() => deleteCategory(cat.id)} className="p-1 rounded hover:bg-red-50 shrink-0">
                  <X size={14} className="text-red-400" />
                </button>
              </div>
            ))}
            {categories.length === 0 && (
              <div className="p-3 text-center text-gray-400 text-sm">카테고리가 없습니다</div>
            )}
          </div>
          <p className="text-xs text-gray-500">
            상위 그룹(예: <span className="font-medium">재료원가</span>)으로 묶으면 통계에서 그룹 합계와 매출 대비 비율이 함께 표시됩니다.
          </p>
        </div>
      </Modal>
    </>
  );
}
