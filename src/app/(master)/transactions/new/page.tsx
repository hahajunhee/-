'use client';

import { useEffect, useState, useCallback, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Trash2, Save, FileText, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';
import { Product, Customer, TransactionItem, OPERATION_TYPES, OperationType } from '@/types';
import { computeItemFields, formatKRW } from '@/lib/calculator';

const OP_BADGE: Record<OperationType, string> = {
  '본점': 'bg-purple-100 text-purple-700',
  '직영점': 'bg-blue-100 text-blue-700',
  '가맹점': 'bg-emerald-100 text-emerald-700',
  '초도물품': 'bg-amber-100 text-amber-700',
};

function TransactionNewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit'); // 수정 모드 ID
  const isEdit = !!editId;
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerId, setCustomerId] = useState<number>(0);
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>('unpaid');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<'master' | 'manager' | 'partner' | null>(null);
  const [canViewMargin, setCanViewMargin] = useState<boolean>(true);
  const [brandFilter, setBrandFilter] = useState<string>('');         // 1차: 브랜드
  const [opFilter, setOpFilter] = useState<'' | OperationType>('');   // 2차: 운영구분
  const [brandOptions, setBrandOptions] = useState<string[]>([]);
  const [custDropdownOpen, setCustDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    const [pRes, cRes, aRes, sRes] = await Promise.all([
      fetch('/api/products'),
      fetch('/api/customers'),
      fetch('/api/auth'),
      fetch('/api/settings'),
    ]);
    setProducts(await pRes.json());
    setCustomers(await cRes.json());
    try {
      const auth = await aRes.json();
      setUserRole(auth?.user?.role || null);
      // master는 항상 노출, manager는 can_view_margin 플래그에 따라
      const role = auth?.user?.role;
      if (role === 'manager') {
        setCanViewMargin(!!auth.user.can_view_margin);
      } else {
        setCanViewMargin(true);
      }
    } catch {}
    try {
      const s = await sRes.json();
      setBrandOptions(Array.isArray(s?.brands) ? s.brands : []);
    } catch {}

    // 수정 모드: 기존 거래 로드
    if (editId) {
      try {
        const r = await fetch(`/api/transactions/${editId}`);
        if (r.ok) {
          const txn = await r.json();
          setDate(txn.date_formatted || txn.date?.split('T')[0] || '');
          setCustomerId(Number(txn.customer_id));
          setPaymentStatus(txn.payment_status === 'paid' ? 'paid' : 'unpaid');
          setItems((txn.items || []).map((it: any) => ({
            product_id: it.product_id,
            product_name: it.product_name,
            category: it.category,
            spec: it.spec,
            unit: it.unit,
            qty: Number(it.qty),
            unit_price: Number(it.unit_price),
            material_cost: Number(it.material_cost),
            other_cost: Number(it.other_cost),
            vat_apply: it.vat_apply,
            amount: Number(it.amount),
            vat_amount: Number(it.vat_amount),
            margin: Number(it.margin),
            net_profit: Number(it.net_profit),
            invoice_hidden: !!it.invoice_hidden,
          })));
        }
      } catch {}
    }
  }, [editId]);

  // 마진/순익 노출: master는 항상, manager는 can_view_margin 플래그에 따라
  const showProfit = userRole === 'master' || (userRole === 'manager' && canViewMargin);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCustDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 1차(브랜드) + 2차(운영구분) 필터 적용된 거래처 목록
  const filteredCustomers = customers.filter(c => {
    if (brandFilter && (c.brand || '') !== brandFilter) return false;
    if (opFilter && (c.operation_type || '가맹점') !== opFilter) return false;
    return true;
  });

  // 거래처 선택 시 해당 (브랜드 + 운영구분) 또는 (브랜드 + 초도물품) 품목 노출
  const selectedCustomer = customers.find(c => c.id === customerId);
  const customerOp = selectedCustomer?.operation_type || null;
  const customerBrand = selectedCustomer ? (selectedCustomer.brand || '') : null;
  const filteredProducts = products.filter(p => {
    const pop = (p.operation_type || '가맹점') as OperationType;
    if (customerOp) {
      // 거래처 운영구분과 일치하거나, 초도물품인 경우만 허용
      if (pop !== customerOp && pop !== '초도물품') return false;
    }
    if (customerBrand !== null && (p.brand || '') !== customerBrand) return false;
    if (categoryFilter && p.category !== categoryFilter) return false;
    return true;
  });

  const addItem = (product: Product) => {
    // 이미 추가된 품목인지 확인
    if (items.some((i) => i.product_id === product.id)) {
      toast.error('이미 추가된 품목입니다');
      return;
    }
    // 재료원가 적용(Y) → 거래 단가 = 재료원가, 아니면 단가(납품가)
    const effectiveUnitPrice = product.apply_material_cost
      ? Number(product.material_cost)
      : Number(product.selling_price);
    const newItem: TransactionItem = {
      product_id: product.id,
      product_name: product.name,
      category: product.category,
      spec: product.spec,
      unit: product.unit,
      qty: 1,
      unit_price: effectiveUnitPrice,
      material_cost: Number(product.material_cost),
      other_cost: Number(product.other_cost),
      vat_apply: product.vat_apply,
      amount: effectiveUnitPrice,
      vat_amount: 0,
      margin: 0,
      net_profit: 0,
      invoice_hidden: !!product.invoice_hidden,
    };
    const computed = computeItemFields(newItem);
    setItems([...items, { ...newItem, ...computed }]);
  };

  const updateQty = (index: number, qty: number) => {
    const updated = [...items];
    updated[index].qty = qty;
    const computed = computeItemFields(updated[index]);
    updated[index] = { ...updated[index], ...computed };
    setItems(updated);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const supplyTotal = items.reduce((sum, i) => sum + i.amount, 0);
  const vatTotal = items.reduce((sum, i) => sum + i.vat_amount, 0);
  const grandTotal = supplyTotal + vatTotal;
  const totalMargin = items.reduce((sum, i) => sum + i.margin, 0);
  const totalNetProfit = items.reduce((sum, i) => sum + i.net_profit, 0);

  const handleSave = async (openInvoice = false) => {
    if (!customerId) {
      toast.error('거래처를 선택하세요');
      return;
    }
    if (items.length === 0) {
      toast.error('품목을 추가하세요');
      return;
    }
    setSaving(true);
    const payload = {
      date,
      customer_id: customerId,
      payment_status: paymentStatus,
      supply_total: supplyTotal,
      vat_total: vatTotal,
      grand_total: grandTotal,
      items: items.map((i) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        category: i.category,
        spec: i.spec,
        unit: i.unit,
        qty: i.qty,
        unit_price: i.unit_price,
        material_cost: i.material_cost,
        other_cost: i.other_cost,
        amount: i.amount,
        vat_apply: i.vat_apply,
        vat_amount: i.vat_amount,
        margin: i.margin,
        net_profit: i.net_profit,
        invoice_hidden: !!i.invoice_hidden,
      })),
    };

    const res = await fetch(isEdit ? `/api/transactions/${editId}` : '/api/transactions', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const txn = await res.json();
      toast.success(isEdit ? '거래가 수정되었습니다' : '거래가 저장되었습니다');
      if (openInvoice) {
        router.push(`/invoice?id=${isEdit ? editId : txn.id}`);
      } else {
        setItems([]);
        router.push('/transactions');
      }
    } else {
      toast.error(isEdit ? '수정 실패' : '저장 실패');
    }
    setSaving(false);
  };

  return (
    <>
      <PageHeader
        title={isEdit ? '발주 수정' : '발주'}
        description={isEdit ? `발주 #${editId} 수정` : '새로운 발주를 등록합니다'}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 좌측: 품목 선택 */}
        <div className="lg:col-span-1">
          <div className="card">
            <h3 className="font-semibold mb-3">품목 선택</h3>
            <select
              className="form-select mb-3"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">전체 분류</option>
              {['고기', '야채', '소스', '가공', '음료'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {filteredProducts.map((p) => {
                const added = items.some((i) => i.product_id === p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => addItem(p)}
                    disabled={added}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      added
                        ? 'bg-blue-50 text-blue-400 cursor-not-allowed'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium">{p.name}</span>
                        <span className="text-gray-400 ml-2 text-xs">{p.spec}</span>
                        {(p.operation_type as OperationType) === '초도물품' && (
                          <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-amber-200 text-amber-800 font-semibold">초도</span>
                        )}
                        {p.apply_material_cost && (
                          <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-amber-100 text-amber-700">원가</span>
                        )}
                        {p.invoice_hidden && (
                          <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-purple-100 text-purple-700 font-medium"
                            title="명세서에는 표시 안 되지만 통계에는 반영됨">대시보드 전용</span>
                        )}
                      </div>
                      <span className="text-gray-500 text-xs">
                        {formatKRW(p.apply_material_cost ? p.material_cost : p.selling_price)}원
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 우측: 거래 정보 + 품목 목록 */}
        <div className="lg:col-span-2 space-y-4">
          {/* 거래 기본 정보 */}
          <div className="card space-y-3">
            {/* 1차: 브랜드 / 2차: 운영구분 필터 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">1차: 브랜드 (선택)</label>
                <select className="form-select" value={brandFilter}
                  onChange={(e) => { setBrandFilter(e.target.value); setCustomerId(0); }}>
                  <option value="">전체 브랜드</option>
                  {brandOptions.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">2차: 운영구분 (선택)</label>
                <select className="form-select" value={opFilter}
                  onChange={(e) => { setOpFilter(e.target.value as OperationType | ''); setCustomerId(0); }}>
                  <option value="">전체 운영구분</option>
                  {OPERATION_TYPES.map(op => <option key={op} value={op}>{op}</option>)}
                </select>
              </div>
            </div>

            {/* 거래일자 + 거래처(커스텀 드롭다운) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">거래일자 *</label>
                <input
                  type="date"
                  className="form-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="relative" ref={dropdownRef}>
                <label className="form-label">거래처 ({filteredCustomers.length}곳)</label>
                <button type="button"
                  onClick={() => setCustDropdownOpen(!custDropdownOpen)}
                  className="form-select flex items-center justify-between w-full text-left">
                  {(() => {
                    const sel = customers.find(c => c.id === customerId);
                    if (!sel) return <span className="text-gray-400">거래처 선택</span>;
                    const op = (sel.operation_type || '가맹점') as OperationType;
                    return (
                      <span className="flex items-center gap-2 truncate">
                        <span className="font-medium">{sel.company_name}</span>
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
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-[300px] overflow-y-auto">
                    <button type="button"
                      onClick={() => { setCustomerId(0); setCustDropdownOpen(false); }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 border-b">
                      거래처 선택 해제
                    </button>
                    {filteredCustomers.length === 0 && (
                      <div className="px-3 py-4 text-sm text-gray-400 text-center">조건에 맞는 거래처가 없습니다</div>
                    )}
                    {filteredCustomers.map(c => {
                      const op = (c.operation_type || '가맹점') as OperationType;
                      const isSelected = c.id === customerId;
                      return (
                        <button type="button" key={c.id}
                          onClick={() => { setCustomerId(c.id); setCustDropdownOpen(false); }}
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
                {/* 숨김 select - 기존 코드 호환용 */}
                <select className="hidden" value={customerId}
                  onChange={(e) => setCustomerId(Number(e.target.value))}>
                  <option value={0}>거래처 선택</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.company_name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 품목 목록 */}
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h3 className="font-semibold text-sm">거래 품목 ({items.length}건)</h3>
            </div>
            {items.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Plus size={24} className="mx-auto mb-2" />
                <p>좌측에서 품목을 선택하세요</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>품목명</th>
                      <th>규격</th>
                      <th>단위</th>
                      <th className="text-center w-24">수량</th>
                      <th className="text-right">단가</th>
                      <th className="text-right">금액</th>
                      <th className="text-center">부가세여부</th>
                      {showProfit && <th className="text-right">마진</th>}
                      <th className="text-right">부가세</th>
                      {showProfit && <th className="text-right">순익</th>}
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={item.product_id} className={item.invoice_hidden ? 'bg-purple-50/40' : ''}>
                        <td className="font-medium">
                          {item.product_name}
                          {item.invoice_hidden && (
                            <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-purple-100 text-purple-700 font-medium"
                              title="이 품목은 거래명세서에는 표시되지 않지만 통계에는 반영됩니다">대시보드 전용</span>
                          )}
                        </td>
                        <td className="text-gray-500">{item.spec}</td>
                        <td className="text-gray-500">{item.unit}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            className="form-input text-center w-20"
                            value={item.qty}
                            onChange={(e) => updateQty(idx, Number(e.target.value))}
                          />
                        </td>
                        <td className="text-right">{formatKRW(item.unit_price)}</td>
                        <td className="text-right font-medium">{formatKRW(item.amount)}</td>
                        <td className="text-center">{item.vat_apply ? 'Y' : 'N'}</td>
                        {showProfit && <td className="text-right text-blue-600">{formatKRW(item.margin)}</td>}
                        <td className="text-right text-gray-500">{formatKRW(item.vat_amount)}</td>
                        {showProfit && <td className="text-right text-emerald-600">{formatKRW(item.net_profit)}</td>}
                        <td>
                          <button onClick={() => removeItem(idx)} className="p-1 rounded hover:bg-red-50">
                            <Trash2 size={14} className="text-red-400" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 합계 */}
          {items.length > 0 && (
            <div className="card">
              <div className={`grid grid-cols-2 ${showProfit ? 'md:grid-cols-5' : 'md:grid-cols-3'} gap-4 text-center`}>
                <div>
                  <p className="text-xs text-gray-500">공급가액</p>
                  <p className="text-lg font-bold">{formatKRW(supplyTotal)}원</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">부가세</p>
                  <p className="text-lg font-bold">{formatKRW(vatTotal)}원</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">합계</p>
                  <p className="text-lg font-bold text-blue-600">{formatKRW(grandTotal)}원</p>
                </div>
                {showProfit && (
                  <>
                    <div>
                      <p className="text-xs text-gray-500">총 마진</p>
                      <p className="text-lg font-bold text-orange-500">{formatKRW(totalMargin)}원</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">총 순익</p>
                      <p className="text-lg font-bold text-emerald-600">{formatKRW(totalNetProfit)}원</p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                <button
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  className="btn-primary"
                >
                  <Save size={16} /> {isEdit ? '수정 저장' : '저장'}
                </button>
                <button
                  onClick={() => handleSave(true)}
                  disabled={saving}
                  className="btn-success"
                >
                  <FileText size={16} /> {isEdit ? '수정 + 명세서 보기' : '저장 + 명세서 보기'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function TransactionNewPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">불러오는 중...</div>}>
      <TransactionNewContent />
    </Suspense>
  );
}
