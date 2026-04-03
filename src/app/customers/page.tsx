'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';
import { Customer } from '@/types';

const emptyCustomer = {
  company_name: '',
  contact_name: '',
  address: '',
  tel: '',
  business_type: '',
  business_category: '',
  fax: '',
  reg_number: '',
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filtered, setFiltered] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyCustomer);
  const [loading, setLoading] = useState(true);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/customers');
    const data = await res.json();
    setCustomers(data);
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
      contact_name: c.contact_name,
      address: c.address,
      tel: c.tel,
      business_type: c.business_type,
      business_category: c.business_category,
      fax: c.fax,
      reg_number: c.reg_number,
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
                  <th>성명</th>
                  <th>연락처</th>
                  <th>주소</th>
                  <th>업태</th>
                  <th>업종</th>
                  <th>등록번호</th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium">{c.company_name}</td>
                    <td>{c.contact_name}</td>
                    <td className="text-gray-500">{c.tel}</td>
                    <td className="text-gray-500 max-w-[200px] truncate">{c.address}</td>
                    <td className="text-gray-500">{c.business_type}</td>
                    <td className="text-gray-500">{c.business_category}</td>
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
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-400">
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
          <div>
            <label className="form-label">상호명 *</label>
            <input type="text" className="form-input" value={form.company_name}
              onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
          </div>
          <div>
            <label className="form-label">성명</label>
            <input type="text" className="form-input" value={form.contact_name}
              onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className="form-label">주소</label>
            <input type="text" className="form-input" value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <label className="form-label">연락처</label>
            <input type="text" className="form-input" value={form.tel}
              onChange={(e) => setForm({ ...form, tel: e.target.value })} />
          </div>
          <div>
            <label className="form-label">FAX</label>
            <input type="text" className="form-input" value={form.fax}
              onChange={(e) => setForm({ ...form, fax: e.target.value })} />
          </div>
          <div>
            <label className="form-label">업태</label>
            <input type="text" className="form-input" value={form.business_type}
              onChange={(e) => setForm({ ...form, business_type: e.target.value })} />
          </div>
          <div>
            <label className="form-label">업종</label>
            <input type="text" className="form-input" value={form.business_category}
              onChange={(e) => setForm({ ...form, business_category: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className="form-label">사업자등록번호</label>
            <input type="text" className="form-input" value={form.reg_number}
              placeholder="000-00-00000"
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
