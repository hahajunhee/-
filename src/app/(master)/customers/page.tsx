'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';
import { Customer, OPERATION_TYPES, OperationType } from '@/types';

const emptyCustomer = {
  company_name: '',
  brand: '',
  contact_name: '',
  email: '',
  address: '',
  tel: '',
  business_type: '',
  business_category: '',
  fax: '',
  reg_number: '',
  operation_type: '가맹점' as OperationType,
  royalty_rate: 0,
};

const OP_BADGE: Record<OperationType, string> = {
  '본점': 'bg-purple-100 text-purple-700',
  '직영점': 'bg-blue-100 text-blue-700',
  '가맹점': 'bg-emerald-100 text-emerald-700',
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filtered, setFiltered] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyCustomer);
  const [loading, setLoading] = useState(true);
  const [brandOptions, setBrandOptions] = useState<string[]>([]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const [cRes, sRes] = await Promise.all([
      fetch('/api/customers'),
      fetch('/api/settings'),
    ]);
    const data = await cRes.json();
    setCustomers(data);
    try {
      const s = await sRes.json();
      setBrandOptions(Array.isArray(s?.brands) ? s.brands : []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  useEffect(() => {
    if (!search) {
      setFiltered(customers);
    } else {
      const s = search.toLowerCase();
      setFiltered(customers.filter((c) =>
        c.company_name.toLowerCase().includes(s) ||
        c.contact_name.toLowerCase().includes(s) ||
        c.tel.includes(s)
      ));
    }
  }, [customers, search]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyCustomer);
    setModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      company_name: c.company_name,
      brand: c.brand || '',
      contact_name: c.contact_name,
      email: c.email || '',
      address: c.address,
      tel: c.tel,
      business_type: c.business_type,
      business_category: c.business_category,
      fax: c.fax,
      reg_number: c.reg_number,
      operation_type: (c.operation_type || '가맹점') as OperationType,
      royalty_rate: Number(c.royalty_rate) || 0,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.company_name.trim()) {
      toast.error('상호명을 입력하세요');
      return;
    }
    const url = editing ? `/api/customers/${editing.id}` : '/api/customers';
    const method = editing ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      toast.success(editing ? '수정되었습니다' : '추가되었습니다');
      setModalOpen(false);
      fetchCustomers();
    } else {
      toast.error('저장 실패');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('삭제되었습니다');
      fetchCustomers();
    } else {
      toast.error('삭제 실패 (거래 내역이 있는 거래처는 삭제할 수 없습니다)');
    }
  };

  return (
    <>
      <PageHeader
        title="거래처 관리"
        description={`총 ${customers.length}개 거래처`}
        action={
          <button onClick={openAdd} className="btn-primary">
            <Plus size={16} /> 거래처 추가
          </button>
        }
      />

      <div className="card mb-4">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="상호명, 담당자, 연락처 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input pl-9"
          />
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">불러오는 중...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>상호</th>
                  <th>브랜드</th>
                  <th className="text-center">운영구분</th>
                  <th className="text-right">로열티</th>
                  <th>성명</th>
                  <th>연락처</th>
                  <th>주소</th>
                  <th>업태</th>
                  <th>등록번호</th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const op = (c.operation_type || '가맹점') as OperationType;
                  return (
                  <tr key={c.id}>
                    <td className="font-medium">{c.company_name}</td>
                    <td>
                      {c.brand ? (
                        <span className="inline-block px-2 py-0.5 text-xs rounded bg-indigo-100 text-indigo-700 font-medium">
                          {c.brand}
                        </span>
                      ) : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="text-center">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${OP_BADGE[op]}`}>
                        {op}
                      </span>
                    </td>
                    <td className="text-right">
                      {op === '가맹점' && Number(c.royalty_rate) > 0 ? (
                        <span className="text-orange-600 font-semibold">{Number(c.royalty_rate)}%</span>
                      ) : <span className="text-gray-300">-</span>}
                    </td>
                    <td>{c.contact_name}</td>
                    <td className="text-gray-500">{c.tel}</td>
                    <td className="text-gray-500 max-w-[200px] truncate">{c.address}</td>
                    <td className="text-gray-500">{c.business_type}</td>
                    <td className="text-gray-500 font-mono text-xs">{c.reg_number}</td>
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
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-gray-400">
                      {search ? '검색 결과가 없습니다' : '거래처를 추가해주세요'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? '거래처 수정' : '거래처 추가'}
        width="max-w-2xl"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="form-label">운영구분 *</label>
            <div className="flex gap-2">
              {OPERATION_TYPES.map(op => (
                <button key={op} type="button"
                  onClick={() => setForm({ ...form, operation_type: op })}
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
          <div>
            <label className="form-label">상호명 *</label>
            <input type="text" className="form-input" placeholder="예: 미식당 성수본점" value={form.company_name}
              onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
          </div>
          <div>
            <label className="form-label">브랜드</label>
            <select className="form-select" value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}>
              <option value="">(브랜드 미지정)</option>
              {brandOptions.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            {brandOptions.length === 0 && (
              <p className="text-xs text-orange-500 mt-1">먼저 [본사] 메뉴에서 브랜드를 등록하세요</p>
            )}
          </div>
          <div>
            <label className="form-label">성명</label>
            <input type="text" className="form-input" placeholder="예: 김도윤" value={form.contact_name}
              onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
          </div>
          {form.operation_type === '가맹점' && (
            <div>
              <label className="form-label">로열티 (%)</label>
              <input type="number" step="0.1" className="form-input" placeholder="예: 5 (= 5%)"
                value={form.royalty_rate}
                onChange={(e) => setForm({ ...form, royalty_rate: Number(e.target.value) })} />
              <p className="text-xs text-gray-500 mt-1">대시보드에서 가맹점 매출 × 로열티%가 본점 매출/가맹점 비용으로 자동 반영 (부가세 별도)</p>
            </div>
          )}
          <div className="col-span-2">
            <label className="form-label">이메일</label>
            <input type="email" className="form-input" placeholder="예: partner@company.com" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className="form-label">주소</label>
            <input type="text" className="form-input" placeholder="예: 서울 성동구 아차산로 17길 25, 1층" value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <label className="form-label">연락처</label>
            <input type="text" className="form-input" placeholder="예: 010-1234-5678" value={form.tel}
              onChange={(e) => setForm({ ...form, tel: e.target.value })} />
          </div>
          <div>
            <label className="form-label">FAX</label>
            <input type="text" className="form-input" placeholder="예: 02-123-5679" value={form.fax}
              onChange={(e) => setForm({ ...form, fax: e.target.value })} />
          </div>
          <div>
            <label className="form-label">업태</label>
            <input type="text" className="form-input" placeholder="예: 숙박 및 음식업" value={form.business_type}
              onChange={(e) => setForm({ ...form, business_type: e.target.value })} />
          </div>
          <div>
            <label className="form-label">업종</label>
            <input type="text" className="form-input" placeholder="예: 한식 일반 음식점" value={form.business_category}
              onChange={(e) => setForm({ ...form, business_category: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className="form-label">사업자등록번호</label>
            <input type="text" className="form-input" value={form.reg_number}
              placeholder="예: 527-42-01009"
              onChange={(e) => setForm({ ...form, reg_number: e.target.value })} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">취소</button>
          <button onClick={handleSave} className="btn-primary">{editing ? '수정' : '추가'}</button>
        </div>
      </Modal>
    </>
  );
}
