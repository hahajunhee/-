'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';
import { Product } from '@/types';
import { formatKRW, computeItemFields } from '@/lib/calculator';

interface OrderItem {
  product_id: number;
  product_name: string;
  category: string;
  spec: string;
  unit: string;
  qty: number;
  unit_price: number;
  material_cost: number;
  other_cost: number;
  amount: number;
  vat_apply: boolean;
  vat_amount: number;
  margin: number;
  net_profit: number;
}

export default function NewOrderPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [notes, setNotes] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(setProducts).catch(() => {});
  }, []);

  const filteredProducts = categoryFilter
    ? products.filter(p => p.category === categoryFilter)
    : products;

  const addItem = (product: Product) => {
    if (items.some(i => i.product_id === product.id)) {
      toast.error('이미 추가된 품목입니다');
      return;
    }
    const unitPrice = Number(product.selling_price);
    const materialCost = Number(product.material_cost);
    const otherCost = Number(product.other_cost);
    const computed = computeItemFields({
      unit_price: unitPrice,
      material_cost: materialCost,
      other_cost: otherCost,
      qty: 1,
      vat_apply: product.vat_apply,
    });
    setItems([...items, {
      product_id: product.id,
      product_name: product.name,
      category: product.category,
      spec: product.spec,
      unit: product.unit,
      qty: 1,
      unit_price: unitPrice,
      material_cost: materialCost,
      other_cost: otherCost,
      vat_apply: product.vat_apply,
      ...computed,
    }]);
  };

  const updateQty = (index: number, qty: number) => {
    const updated = [...items];
    updated[index].qty = qty;
    const computed = computeItemFields({
      unit_price: updated[index].unit_price,
      material_cost: updated[index].material_cost,
      other_cost: updated[index].other_cost,
      qty,
      vat_apply: updated[index].vat_apply,
    });
    updated[index] = { ...updated[index], ...computed };
    setItems(updated);
  };

  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const supplyTotal = items.reduce((s, i) => s + i.amount, 0);
  const vatTotal = items.reduce((s, i) => s + i.vat_amount, 0);
  const grandTotal = supplyTotal + vatTotal;

  const handleSubmit = async () => {
    if (items.length === 0) { toast.error('품목을 추가하세요'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(i => ({
            product_id: i.product_id,
            qty: i.qty,
          })),
          notes,
        }),
      });
      if (res.ok) {
        toast.success('발주서가 제출되었습니다');
        router.push('/partner/orders');
      } else {
        const data = await res.json();
        toast.error(data.error || '제출 실패');
      }
    } catch {
      toast.error('서버 연결 오류');
    }
    setSaving(false);
  };

  return (
    <>
      <PageHeader title="발주서 작성" description="필요한 품목을 선택하고 수량을 입력하세요" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 품목 선택 */}
        <div className="lg:col-span-1">
          <div className="card">
            <h3 className="font-semibold mb-3">품목 선택</h3>
            <select className="form-select mb-3" value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">전체 분류</option>
              {['고기', '야채', '소스', '가공', '음료'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {filteredProducts.map(p => {
                const added = items.some(i => i.product_id === p.id);
                return (
                  <button key={p.id} onClick={() => addItem(p)} disabled={added}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      added ? 'bg-emerald-50 text-emerald-400 cursor-not-allowed' : 'hover:bg-gray-100'
                    }`}>
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium">{p.name}</span>
                        <span className="text-gray-400 ml-2 text-xs">{p.spec}</span>
                      </div>
                      <span className="text-gray-500 text-xs">{formatKRW(p.selling_price)}원/{p.unit}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 발주 내용 */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h3 className="font-semibold text-sm">발주 품목 ({items.length}건)</h3>
            </div>
            {items.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Plus size={24} className="mx-auto mb-2" />
                <p>좌측에서 품목을 선택하세요</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>품목명</th>
                    <th>규격</th>
                    <th>단위</th>
                    <th className="text-center w-24">수량</th>
                    <th className="text-right">단가</th>
                    <th className="text-right">금액</th>
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
                        <input type="number" min="0" step="1"
                          className="form-input text-center w-20"
                          value={item.qty}
                          onChange={(e) => updateQty(idx, Number(e.target.value))} />
                      </td>
                      <td className="text-right">{formatKRW(item.unit_price)}</td>
                      <td className="text-right font-medium">{formatKRW(item.amount)}</td>
                      <td>
                        <button onClick={() => removeItem(idx)} className="p-1 rounded hover:bg-red-50">
                          <Trash2 size={14} className="text-red-400" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {items.length > 0 && (
            <div className="card">
              <div>
                <label className="form-label">비고 (요청사항)</label>
                <textarea className="form-input" rows={2} value={notes}
                  placeholder="예: 오전 10시까지 납품 요청합니다. 냉장 배송 부탁드립니다."
                  onChange={(e) => setNotes(e.target.value)} />
              </div>

              <div className="grid grid-cols-3 gap-4 text-center mt-4">
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
                  <p className="text-lg font-bold text-emerald-600">{formatKRW(grandTotal)}원</p>
                </div>
              </div>

              <div className="flex justify-end mt-4 pt-4 border-t">
                <button onClick={handleSubmit} disabled={saving} className="btn-success">
                  <Send size={16} /> {saving ? '제출 중...' : '발주서 제출'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
