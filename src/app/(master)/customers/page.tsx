'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
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
  royalty_type: 'percent' as 'percent' | 'fixed_monthly',
  royalty_rate: 0,
  royalty_amount: 0,
};

const OP_BADGE: Record<OperationType, string> = {
  '본점': 'bg-purple-100 text-purple-700',
  '직영점': 'bg-blue-100 text-blue-700',
  '가맹점': 'bg-emerald-100 text-emerald-700',
  '초도물품': 'bg-amber-100 text-amber-700',
};

// 표시 컬럼 정의 (고정 순서, 액션 열은 항상 마지막)
interface ColumnDef {
  key: string;
  label: string;
  thClass?: string;
  sortVal: (c: Customer) => string | number;
}

const COLUMNS: ColumnDef[] = [
  { key: 'brand', label: '브랜드', sortVal: (c) => c.brand || '' },
  { key: 'operation_type', label: '운영구분', thClass: 'text-center', sortVal: (c) => c.operation_type || '' },
  { key: 'company_name', label: '상호', sortVal: (c) => c.company_name || '' },
  { key: 'contact_name', label: '성명', sortVal: (c) => c.contact_name || '' },
  { key: 'tel', label: '연락처', sortVal: (c) => c.tel || '' },
  { key: 'address', label: '주소', sortVal: (c) => c.address || '' },
  { key: 'reg_number', label: '등록번호', sortVal: (c) => c.reg_number || '' },
];

const SORT_STORAGE_KEY = 'customers-sort-v1';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filtered, setFiltered] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyCustomer);
  const [loading, setLoading] = useState(true);
  const [brandOptions, setBrandOptions] = useState<string[]>([]);

  // 정렬 상태 (localStorage 영속)
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // localStorage 정렬 복원
  useEffect(() => {
    try {
      const rawSort = localStorage.getItem(SORT_STORAGE_KEY);
      if (rawSort) {
        const { key, dir } = JSON.parse(rawSort);
        const validKeys = COLUMNS.map(c => c.key);
        if (key && validKeys.includes(key)) {
          setSortKey(key);
          setSortDir(dir === 'desc' ? 'desc' : 'asc');
        }
      }
    } catch {}
  }, []);

  // sort 저장
  useEffect(() => {
    try { localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify({ key: sortKey, dir: sortDir })); } catch {}
  }, [sortKey, sortDir]);

  const handleSortClick = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };
  const resetSort = () => {
    setSortKey(null);
    setSortDir('asc');
  };

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
    let list = customers;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((c) =>
        c.company_name.toLowerCase().includes(s) ||
        c.contact_name.toLowerCase().includes(s) ||
        c.tel.includes(s)
      );
    }
    // 정렬
    if (sortKey) {
      const col = COLUMNS.find(c => c.key === sortKey);
      if (col) {
        list = [...list].sort((a, b) => {
          const va = col.sortVal(a);
          const vb = col.sortVal(b);
          if (typeof va === 'number' && typeof vb === 'number') {
            return sortDir === 'asc' ? va - vb : vb - va;
          }
          const sa = String(va);
          const sb = String(vb);
          return sortDir === 'asc' ? sa.localeCompare(sb, 'ko') : sb.localeCompare(sa, 'ko');
        });
      }
    }
    setFiltered(list);
  }, [customers, search, sortKey, sortDir]);

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
      royalty_type: (c.royalty_type === 'fixed_monthly' ? 'fixed_monthly' : 'percent') as 'percent' | 'fixed_monthly',
      royalty_rate: Number(c.royalty_rate) || 0,
      royalty_amount: Number(c.royalty_amount) || 0,
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
        title="거래처"
        description={`총 ${customers.length}개`}
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

      {/* 도움말 + 정렬 초기화 */}
      <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
        <span>💡 열 제목을 <strong>클릭</strong>하면 해당 열로 정렬됩니다 (브라우저에 저장됨)</span>
        {sortKey && (
          <button onClick={resetSort} className="text-xs text-blue-500 hover:underline">정렬 해제</button>
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">불러오는 중...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {COLUMNS.map(col => {
                    const isSorted = sortKey === col.key;
                    return (
                      <th key={col.key}
                        className={`${col.thClass || ''} cursor-pointer select-none transition ${
                          isSorted ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => handleSortClick(col.key)}>
                        <div className={`inline-flex items-center gap-1 ${col.thClass === 'text-right' ? 'justify-end' : col.thClass === 'text-center' ? 'justify-center' : ''}`}>
                          <span>{col.label}</span>
                          {isSorted ? (
                            sortDir === 'asc' ? <ArrowUp size={12} className="text-blue-500" /> : <ArrowDown size={12} className="text-blue-500" />
                          ) : <ArrowUpDown size={11} className="text-gray-300" />}
                        </div>
                      </th>
                    );
                  })}
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const op = (c.operation_type || '가맹점') as OperationType;
                  const renderCell = (key: string) => {
                    switch (key) {
                      case 'company_name':
                        return <td key={key} className="font-medium">{c.company_name}</td>;
                      case 'brand':
                        return <td key={key}>
                          {c.brand ? (
                            <span className="inline-block px-2 py-0.5 text-xs rounded bg-indigo-100 text-indigo-700 font-medium">{c.brand}</span>
                          ) : <span className="text-gray-300">-</span>}
                        </td>;
                      case 'operation_type':
                        return <td key={key} className="text-center">
                          <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${OP_BADGE[op]}`}>{op}</span>
                        </td>;
                      case 'contact_name': return <td key={key}>{c.contact_name}</td>;
                      case 'tel': return <td key={key} className="text-gray-500">{c.tel}</td>;
                      case 'address': return <td key={key} className="text-gray-500 max-w-[200px] truncate">{c.address}</td>;
                      case 'reg_number': return <td key={key} className="text-gray-500 font-mono text-xs">{c.reg_number}</td>;
                      default: return <td key={key}></td>;
                    }
                  };
                  return (
                    <tr key={c.id}>
                      {COLUMNS.map(col => renderCell(col.key))}
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
                    <td colSpan={COLUMNS.length + 1} className="text-center py-8 text-gray-400">
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
          {/* 1. 브랜드 */}
          <div className="col-span-2">
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

          {/* 2. 운영구분 */}
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

          {/* 3. 상호명 */}
          <div className="col-span-2">
            <label className="form-label">상호명 *</label>
            <input type="text" className="form-input" placeholder="예: 미식당 성수본점" value={form.company_name}
              onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
          </div>

          {/* 4. 사업자번호 */}
          <div className="col-span-2">
            <label className="form-label">사업자등록번호</label>
            <input type="text" className="form-input" value={form.reg_number}
              placeholder="예: 527-42-01009"
              onChange={(e) => setForm({ ...form, reg_number: e.target.value })} />
          </div>

          {/* 4-1. 업태 / 종목 (거래명세서 공급받는자 정보) */}
          <div>
            <label className="form-label">업태</label>
            <input type="text" className="form-input" placeholder="예: 음식점업" value={form.business_type}
              onChange={(e) => setForm({ ...form, business_type: e.target.value })} />
          </div>
          <div>
            <label className="form-label">종목</label>
            <input type="text" className="form-input" placeholder="예: 한식" value={form.business_category}
              onChange={(e) => setForm({ ...form, business_category: e.target.value })} />
          </div>

          {/* 5. 성명 + 가맹점이면 로열티 */}
          <div>
            <label className="form-label">성명</label>
            <input type="text" className="form-input" placeholder="예: 김도윤" value={form.contact_name}
              onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
          </div>

          {/* 6. 나머지 */}
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
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">취소</button>
          <button onClick={handleSave} className="btn-primary">{editing ? '수정' : '추가'}</button>
        </div>
      </Modal>
    </>
  );
}
