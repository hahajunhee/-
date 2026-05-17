'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Pencil, Save, X, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';
import { Customer, Cost, CostCategory, OPERATION_TYPES, OperationType } from '@/types';
import { formatKRW } from '@/lib/calculator';

const OP_BADGE: Record<OperationType, string> = {
  '본점': 'bg-purple-100 text-purple-700',
  '직영점': 'bg-blue-100 text-blue-700',
  '가맹점': 'bg-emerald-100 text-emerald-700',
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

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Cost | null>(null);
  const [form, setForm] = useState({
    customer_id: '',
    category: '',
    settlement_month: defaultMonth,
    amount: 0,
    notes: '',
  });

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (monthFilter) params.set('month', monthFilter);
    if (customerFilter) params.set('customer_id', customerFilter);
    if (opFilter) params.set('operation_type', opFilter);
    const [cRes, cuRes, catRes] = await Promise.all([
      fetch(`/api/costs?${params}`),
      fetch('/api/customers'),
      fetch('/api/cost-categories'),
    ]);
    setCosts(await cRes.json());
    setCustomers(await cuRes.json());
    setCategories(await catRes.json());
    setLoading(false);
  }, [monthFilter, customerFilter, opFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openAdd = () => {
    setEditing(null);
    setForm({
      customer_id: '',
      category: categories[0]?.name || '',
      settlement_month: defaultMonth,
      amount: 0,
      notes: '',
    });
    setModalOpen(true);
  };

  const openEdit = (cost: Cost) => {
    setEditing(cost);
    setForm({
      customer_id: String(cost.customer_id),
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
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
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
      body: JSON.stringify({ name: newCatName.trim() }),
    });
    if (res.ok) {
      toast.success('추가되었습니다');
      setNewCatName('');
      fetchAll();
    } else {
      const data = await res.json();
      toast.error(data.error || '실패');
    }
  };

  const deleteCategory = async (id: number) => {
    if (!confirm('이 비용 구분을 삭제하시겠습니까?')) return;
    const res = await fetch(`/api/cost-categories/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('삭제되었습니다'); fetchAll(); }
  };

  const totalAmount = costs.reduce((s, c) => s + Number(c.amount), 0);

  // 카테고리별 합계
  const byCategory: Record<string, number> = {};
  for (const c of costs) {
    byCategory[c.category] = (byCategory[c.category] || 0) + Number(c.amount);
  }

  return (
    <>
      <PageHeader
        title="비용 입력"
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
      <div className="card mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="form-label">정산 년-월</label>
            <input type="month" className="form-input" value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)} />
          </div>
          <div>
            <label className="form-label">거래처</label>
            <select className="form-select" value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}>
              <option value="">전체</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.company_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">운영구분</label>
            <select className="form-select" value={opFilter}
              onChange={(e) => setOpFilter(e.target.value)}>
              <option value="">전체</option>
              {OPERATION_TYPES.map(op => <option key={op} value={op}>{op}</option>)}
            </select>
          </div>
          {(monthFilter || customerFilter || opFilter) && (
            <button onClick={() => { setMonthFilter(''); setCustomerFilter(''); setOpFilter(''); }}
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
              {costs.map((c) => (
                <tr key={c.id}>
                  <td className="font-mono">{c.settlement_month}</td>
                  <td className="font-medium">{c.customer_name}</td>
                  <td className="text-center">
                    <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${OP_BADGE[(c.operation_type || '가맹점') as OperationType]}`}>
                      {c.operation_type || '가맹점'}
                    </span>
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
              ))}
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
          <div>
            <label className="form-label">거래처 *</label>
            <select className="form-select" value={form.customer_id}
              onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
              <option value="">거래처를 선택하세요</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.company_name} ({c.operation_type || '가맹점'})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">비용 구분 *</label>
              <select className="form-select" value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">선택</option>
                {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
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
        title="비용 구분 관리" width="max-w-md">
        <div className="space-y-4">
          <div className="flex gap-2">
            <input type="text" className="form-input flex-1" placeholder="새 비용 구분 이름"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addCategory(); }} />
            <button onClick={addCategory} className="btn-primary">
              <Plus size={16} /> 추가
            </button>
          </div>
          <div className="border rounded-lg overflow-hidden">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between p-2 border-b last:border-b-0 hover:bg-gray-50">
                <span className="text-sm">{cat.name}</span>
                <button onClick={() => deleteCategory(cat.id)} className="p-1 rounded hover:bg-red-50">
                  <X size={14} className="text-red-400" />
                </button>
              </div>
            ))}
            {categories.length === 0 && (
              <div className="p-3 text-center text-gray-400 text-sm">카테고리가 없습니다</div>
            )}
          </div>
          <p className="text-xs text-gray-500">
            기본 7개: 식재료비 / 인건비 / 임차료 / 공과금 / 소모품 및 운영비 / 마케팅비 / 기타 경비
          </p>
        </div>
      </Modal>
    </>
  );
}
