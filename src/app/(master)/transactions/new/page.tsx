'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Trash2, Save, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';
import { Product, Customer, TransactionItem } from '@/types';
import { computeItemFields, formatKRW } from '@/lib/calculator';

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

  const fetchData = useCallback(async () => {
    const [pRes, cRes, aRes] = await Promise.all([
      fetch('/api/products'),
      fetch('/api/customers'),
      fetch('/api/auth'),
    ]);
    setProducts(await pRes.json());
    setCustomers(await cRes.json());
    try {
      const auth = await aRes.json();
      setUserRole(auth?.user?.role || null);
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
            incentive: Number(it.incentive) || 0,
            invoice_hidden: !!it.invoice_hidden,
          })));
        }
      } catch {}
    }
  }, [editId]);

  // 매니저는 마진/순익 비공개
  const showProfit = userRole !== 'manager';

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredProducts = categoryFilter
    ? products.filter((p) => p.category === categoryFilter)
    : products;

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
    const incentive = Number(product.incentive) || 0;
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
      incentive,
      invoice_hidden: !!product.invoice_hidden,
    };
    const computed = computeItemFields({ ...newItem, incentive });
    setItems([...items, { ...newItem, ...computed }]);
  };

  const updateQty = (index: number, qty: number) => {
    const updated = [...items];
    updated[index].qty = qty;
    const computed = computeItemFields({
      ...updated[index],
      incentive: updated[index].incentive || 0,
    });
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
        incentive: i.incentive || 0,
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
        title={isEdit ? '거래 수정' : '거래 입력'}
        description={isEdit ? `거래 #${editId} 수정` : '새로운 거래를 등록합니다'}
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
                        {p.apply_material_cost && (
                          <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-amber-100 text-amber-700">원가</span>
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
          <div className="card">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">거래일자</label>
                <input
                  type="date"
                  className="form-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">거래처</label>
                <select
                  className="form-select"
                  value={customerId}
                  onChange={(e) => setCustomerId(Number(e.target.value))}
                >
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
                      <tr key={item.product_id}>
                        <td className="font-medium">{item.product_name}</td>
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
