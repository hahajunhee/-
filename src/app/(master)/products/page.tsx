'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, GripVertical } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';
import { Product, PRODUCT_OPERATION_TYPES, OperationType } from '@/types';
import { computeProductFields, formatKRW, formatPercent } from '@/lib/calculator';

const CATEGORIES = ['고기', '야채', '소스', '가공', '음료'];
const INITIAL_CATEGORIES = ['주방용품', '식기', '인테리어', '테이블'];

const emptyProduct = {
  name: '',
  brand: '',
  category: '고기',
  spec: '',
  unit: 'kg',
  material_cost: 0,
  other_cost: 0,
  selling_price: 0,
  vat_apply: true,
  apply_material_cost: false,
  incentive: 0,
  invoice_hidden: false,
  operation_type: '가맹점' as OperationType,
};

const OP_TAB_COLOR: Record<OperationType, string> = {
  '본점': 'bg-purple-600 text-white',
  '직영점': 'bg-blue-600 text-white',
  '가맹점': 'bg-emerald-600 text-white',
  '초도물품': 'bg-amber-600 text-white',
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [operationTab, setOperationTab] = useState<OperationType>('가맹점');
  const [brandTab, setBrandTab] = useState<string>('');  // 빈 문자열 = 브랜드 미지정
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyProduct);
  const [loading, setLoading] = useState(true);

  const [brandOptions, setBrandOptions] = useState<string[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const [pRes, sRes] = await Promise.all([
      fetch('/api/products'),
      fetch('/api/settings'),
    ]);
    const data = await pRes.json();
    setProducts(data);
    try {
      const s = await sRes.json();
      setBrandOptions(Array.isArray(s?.brands) ? s.brands : []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // 브랜드 목록 (전체 품목에서 추출)
  const brands = Array.from(new Set(products.map(p => p.brand || ''))).sort();

  useEffect(() => {
    let filtered = products.filter((p) => (p.operation_type || '가맹점') === operationTab);
    filtered = filtered.filter((p) => (p.brand || '') === brandTab);
    if (categoryFilter) {
      filtered = filtered.filter((p) => p.category === categoryFilter);
    }
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter((p) =>
        p.name.toLowerCase().includes(s) || p.spec.toLowerCase().includes(s)
      );
    }
    setFilteredProducts(filtered);
  }, [products, categoryFilter, search, operationTab, brandTab]);

  // 모달에서 사용할 카테고리 (초도물품 vs 일반)
  const modalCategories = form.operation_type === '초도물품' ? INITIAL_CATEGORIES : CATEGORIES;

  const openAdd = () => {
    setEditing(null);
    // 현재 선택된 (운영구분 + 브랜드)로 기본 설정
    const isInitial = operationTab === '초도물품';
    setForm({
      ...emptyProduct,
      operation_type: operationTab,
      brand: brandTab,
      category: isInitial ? INITIAL_CATEGORIES[0] : CATEGORIES[0],
    });
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      brand: p.brand || '',
      category: p.category,
      spec: p.spec,
      unit: p.unit,
      material_cost: p.material_cost,
      other_cost: p.other_cost,
      selling_price: p.selling_price,
      vat_apply: p.vat_apply,
      apply_material_cost: !!p.apply_material_cost,
      incentive: Number(p.incentive) || 0,
      invoice_hidden: !!p.invoice_hidden,
      operation_type: (p.operation_type || '가맹점') as OperationType,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('품목명을 입력하세요');
      return;
    }
    if (editing) {
      const res = await fetch(`/api/products/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success('수정되었습니다');
        setModalOpen(false);
        fetchProducts();
      } else {
        toast.error('수정 실패');
      }
    } else {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success('추가되었습니다');
        setModalOpen(false);
        fetchProducts();
      } else {
        toast.error('추가 실패');
      }
    }
  };

  // 드래그 정렬
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = async (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) { setDragIdx(null); return; }
    // filteredProducts 기준으로 재배열한 결과를 products의 해당 영역에 반영
    const visible = [...filteredProducts];
    const [moved] = visible.splice(dragIdx, 1);
    visible.splice(targetIdx, 0, moved);
    setDragIdx(null);
    setFilteredProducts(visible);

    // products 전체에서 보이는 부분만 새 순서로 교체
    const visibleIds = new Set(visible.map(p => p.id));
    const newOrderForVisible = visible.map(p => p.id);
    const reordered: typeof products = [];
    let i = 0;
    for (const p of products) {
      if (visibleIds.has(p.id)) {
        const nextId = newOrderForVisible[i++];
        const nextItem = products.find(x => x.id === nextId);
        if (nextItem) reordered.push(nextItem);
      } else {
        reordered.push(p);
      }
    }
    setProducts(reordered);

    // 서버에 저장
    try {
      await fetch('/api/products/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: reordered.map(p => p.id) }),
      });
    } catch {}
  };

  const handleDelete = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('삭제되었습니다');
      fetchProducts();
    } else {
      toast.error('삭제 실패 (거래 내역이 있는 품목은 삭제할 수 없습니다)');
    }
  };

  const computed = computeProductFields({
    selling_price: Number(form.selling_price) || 0,
    material_cost: Number(form.material_cost) || 0,
    other_cost: Number(form.other_cost) || 0,
    vat_apply: form.vat_apply,
  });

  return (
    <>
      <PageHeader
        title="품목 관리"
        description={`${brandTab || '(브랜드 미지정)'} - ${operationTab} ${filteredProducts.length}개 / 전체 ${products.length}개`}
        action={
          <button onClick={openAdd} className="btn-primary">
            <Plus size={16} /> 품목 추가
          </button>
        }
      />

      {/* 브랜드 탭 */}
      <div className="flex flex-wrap gap-1 mb-2 items-center">
        <span className="text-xs font-semibold text-gray-500 mr-2">브랜드:</span>
        {brands.map(b => {
          const count = products.filter(p => (p.brand || '') === b).length;
          const isActive = brandTab === b;
          return (
            <button key={b || '__none__'}
              onClick={() => setBrandTab(b)}
              className={`px-3 py-1 rounded text-xs font-medium border transition ${
                isActive ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
              }`}
            >
              {b || '(미지정)'} <span className="ml-1 opacity-75">{count}</span>
            </button>
          );
        })}
      </div>

      {/* 운영구분 탭 */}
      <div className="flex gap-2 mb-4 border-b pb-1">
        {PRODUCT_OPERATION_TYPES.map(op => {
          const count = products.filter(p =>
            (p.operation_type || '가맹점') === op && (p.brand || '') === brandTab
          ).length;
          const isActive = operationTab === op;
          return (
            <button key={op}
              onClick={() => setOperationTab(op)}
              className={`px-5 py-2 rounded-t-lg text-sm font-semibold transition ${
                isActive ? OP_TAB_COLOR[op] : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {op} <span className="ml-1 opacity-75">({count})</span>
            </button>
          );
        })}
      </div>

      {/* 필터 바 */}
      <div className="card mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="품목명, 규격 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input pl-9"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="form-select w-auto"
          >
            <option value="">전체 분류</option>
            {(operationTab === '초도물품' ? INITIAL_CATEGORIES : CATEGORIES).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 테이블 */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">불러오는 중...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-6"></th>
                  <th>품목명</th>
                  <th>분류</th>
                  <th>규격</th>
                  <th>단위</th>
                  <th className="text-right">재료원가</th>
                  <th className="text-right">기타원가</th>
                  <th className="text-right">단가(납품가)</th>
                  <th className="text-center">부가세여부</th>
                  <th className="text-center">재료원가적용</th>
                  <th className="text-right">장려금</th>
                  <th className="text-right">마진</th>
                  <th className="text-right" title="매출부가세 - 매입부가세 = 실제 납부할 부가세">납부부가세</th>
                  <th className="text-right">최종순익</th>
                  <th className="text-right">마진율</th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p, idx) => {
                  const c = computeProductFields(p);
                  const isDrag = dragIdx === idx;
                  return (
                    <tr key={p.id}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(idx)}
                      onDragEnd={() => setDragIdx(null)}
                      className={isDrag ? 'opacity-40' : ''}>
                      <td className="cursor-move text-gray-300 hover:text-gray-500 align-middle">
                        <GripVertical size={14} />
                      </td>
                      <td className="font-medium">
                        {p.name}
                        {p.invoice_hidden && (
                          <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700" title="거래명세서에 표시되지 않음">대시보드 전용</span>
                        )}
                      </td>
                      <td>
                        <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                          {p.category}
                        </span>
                      </td>
                      <td className="text-gray-500">{p.spec}</td>
                      <td className="text-gray-500">{p.unit}</td>
                      <td className="text-right">{formatKRW(p.material_cost)}</td>
                      <td className="text-right">{formatKRW(p.other_cost)}</td>
                      <td className="text-right font-medium">{formatKRW(p.selling_price)}</td>
                      <td className="text-center">
                        <span className={p.vat_apply ? 'text-emerald-600 font-semibold' : 'text-gray-400'}>
                          {p.vat_apply ? 'Y' : 'N'}
                        </span>
                      </td>
                      <td className="text-center">
                        <span className={p.apply_material_cost ? 'text-amber-600 font-semibold' : 'text-gray-400'}>
                          {p.apply_material_cost ? 'Y' : 'N'}
                        </span>
                      </td>
                      <td className="text-right">
                        {Number(p.incentive) > 0 ? (
                          <span className="text-purple-600 font-medium">{formatKRW(p.incentive)}</span>
                        ) : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="text-right text-blue-600">{formatKRW(c.margin)}</td>
                      <td className="text-right text-gray-500">{formatKRW(c.vat_amount)}</td>
                      <td className="text-right text-emerald-600 font-medium">{formatKRW(c.net_profit)}</td>
                      <td className="text-right">{formatPercent(c.margin_rate)}</td>
                      <td>
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-gray-100">
                            <Pencil size={14} className="text-gray-500" />
                          </button>
                          <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded hover:bg-red-50">
                            <Trash2 size={14} className="text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={15} className="text-center py-8 text-gray-400">
                      {search || categoryFilter ? '검색 결과가 없습니다' : '품목을 추가해주세요'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 추가/수정 모달 */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? '품목 수정' : '품목 추가'}
        width="max-w-2xl"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="form-label">운영구분 *</label>
            <div className="flex gap-2">
              {PRODUCT_OPERATION_TYPES.map(op => (
                <button key={op} type="button"
                  onClick={() => {
                    // 운영구분 전환 시 카테고리 자동 보정
                    const cats = op === '초도물품' ? INITIAL_CATEGORIES : CATEGORIES;
                    const newCategory = cats.includes(form.category) ? form.category : cats[0];
                    setForm({ ...form, operation_type: op, category: newCategory });
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition ${
                    form.operation_type === op
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {op}
                </button>
              ))}
            </div>
          </div>
          <div className="col-span-2">
            <label className="form-label">브랜드</label>
            <select className="form-select"
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}>
              <option value="">(브랜드 미지정)</option>
              {brandOptions.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              같은 (브랜드 + 운영구분) 조합끼리 품목 리스트를 공유합니다.
              {brandOptions.length === 0 && <span className="text-orange-500"> 먼저 [본사]에서 브랜드를 등록하세요.</span>}
            </p>
          </div>
          <div className="col-span-2">
            <label className="form-label">품목명 *</label>
            <input
              type="text"
              className="form-input"
              placeholder="예: 돈가그리살"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">분류</label>
            <select
              className="form-select"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {modalCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">단위</label>
            <input
              type="text"
              className="form-input"
              placeholder="예: kg, ea, 팩"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <label className="form-label">규격</label>
            <input
              type="text"
              className="form-input"
              placeholder="예: 200g*4"
              value={form.spec}
              onChange={(e) => setForm({ ...form, spec: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">재료원가</label>
            <input
              type="number"
              className="form-input"
              placeholder="예: 5000"
              value={form.material_cost}
              onChange={(e) => setForm({ ...form, material_cost: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="form-label">기타원가</label>
            <input
              type="number"
              className="form-input"
              placeholder="예: 5000"
              value={form.other_cost}
              onChange={(e) => setForm({ ...form, other_cost: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="form-label">납품가</label>
            <input
              type="number"
              className="form-input"
              placeholder="예: 30000"
              value={form.selling_price}
              onChange={(e) => setForm({ ...form, selling_price: Number(e.target.value) })}
            />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded"
                checked={form.vat_apply}
                onChange={(e) => setForm({ ...form, vat_apply: e.target.checked })}
              />
              <span className="text-sm">부가세 적용 (Y)</span>
            </label>
          </div>
          <div className="col-span-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded"
                checked={form.apply_material_cost}
                onChange={(e) => setForm({ ...form, apply_material_cost: e.target.checked })}
              />
              <span className="text-sm">
                <span className="font-semibold text-amber-700">재료원가 적용 (Y)</span>
                <span className="text-gray-600 ml-2">체크 시 거래명세서 단가에 <strong>재료원가</strong>가 들어가고, 부가세 = 재료원가 × 10%</span>
              </span>
            </label>
          </div>
          <div className="col-span-2">
            <label className="form-label">장려금 (원/단위)</label>
            <input
              type="number"
              className="form-input"
              placeholder="예: 1000 (공장에서 받는 단위당 장려금)"
              value={form.incentive}
              onChange={(e) => setForm({ ...form, incentive: Number(e.target.value) })}
            />
            <p className="text-xs text-gray-500 mt-1">
              거래명세서에는 표시되지 않고, 손익에만 <strong>수량 × 장려금</strong>이 가산됩니다 (절세용)
            </p>
          </div>
          <div className="col-span-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded"
                checked={form.invoice_hidden}
                onChange={(e) => setForm({ ...form, invoice_hidden: e.target.checked })}
              />
              <span className="text-sm">
                <span className="font-semibold text-purple-700">거래명세서 미표시 (대시보드 전용)</span>
                <span className="text-gray-600 ml-2">체크 시 거래처에게 보이는 명세서/이메일/PDF에서 숨김. 대시보드와 손익엔 정상 반영</span>
              </span>
            </label>
          </div>
        </div>

        {/* 실시간 계산 미리보기 */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-gray-500">마진</span>
              <p className="font-semibold text-blue-600">{formatKRW(computed.margin)}원</p>
            </div>
            <div>
              <span className="text-gray-500" title="매출부가세 - 매입부가세">납부부가세</span>
              <p className="font-semibold">{formatKRW(computed.vat_amount)}원</p>
            </div>
            <div>
              <span className="text-gray-500">순익</span>
              <p className="font-semibold text-emerald-600">{formatKRW(computed.net_profit)}원</p>
            </div>
            <div>
              <span className="text-gray-500">마진율</span>
              <p className="font-semibold">{formatPercent(computed.margin_rate)}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">
            취소
          </button>
          <button onClick={handleSave} className="btn-primary">
            {editing ? '수정' : '추가'}
          </button>
        </div>
      </Modal>
    </>
  );
}
