'use client';

import { useEffect, useState, useCallback } from 'react';
import { CheckCircle, XCircle, Trash2, Clock, UserCheck, UserX, Shield, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  status: string;
  customer_id: number | null;
  company_name: string | null;
  allowed_tabs: string[] | null;
  created_at: string;
}

const TAB_OPTIONS: { key: string; label: string }[] = [
  { key: 'dashboard', label: '대시보드' },
  { key: 'products', label: '품목 관리' },
  { key: 'customers', label: '거래처' },
  { key: 'transactions_new', label: '발주' },
  { key: 'transactions', label: '거래 내역' },
  { key: 'orders', label: '발주 관리' },
  { key: 'costs', label: '비용 입력' },
];

export default function MembersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<{ id: number; company_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [approveModal, setApproveModal] = useState<User | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [permModal, setPermModal] = useState<User | null>(null);
  const [permTabs, setPermTabs] = useState<string[]>([]);
  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    name: '',
    role: 'partner' as 'manager' | 'partner',
    customer_id: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [uRes, cRes] = await Promise.all([
      fetch('/api/members'),
      fetch('/api/customers'),
    ]);
    setUsers(await uRes.json());
    setCustomers(await cRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleApprove = async () => {
    if (!approveModal) return;
    const res = await fetch('/api/members', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: approveModal.id,
        action: 'approve',
        customer_id: selectedCustomerId ? Number(selectedCustomerId) : approveModal.customer_id,
      }),
    });
    if (res.ok) {
      toast.success('승인되었습니다');
      setApproveModal(null);
      fetchData();
    }
  };

  const handleReject = async (id: number) => {
    if (!confirm('가입을 거절하시겠습니까?')) return;
    await fetch('/api/members', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'reject' }),
    });
    toast.success('거절되었습니다');
    fetchData();
  };

  const openPermModal = (u: User) => {
    setPermModal(u);
    // 기본: 거래처/거래입력/거래내역/발주관리
    const defaults = u.allowed_tabs && u.allowed_tabs.length > 0
      ? u.allowed_tabs
      : ['customers', 'transactions_new', 'transactions', 'orders'];
    setPermTabs(defaults);
  };

  const togglePermTab = (key: string) => {
    setPermTabs(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const savePerms = async () => {
    if (!permModal) return;
    const res = await fetch('/api/members', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: permModal.id, action: 'update_tabs', allowed_tabs: permTabs }),
    });
    if (res.ok) {
      toast.success('권한이 저장되었습니다');
      setPermModal(null);
      fetchData();
    } else {
      toast.error('저장 실패');
    }
  };

  const changeRole = async (u: User, newRole: string) => {
    if (u.role === 'master') { toast.error('관리자 역할은 변경할 수 없습니다'); return; }
    if (!confirm(`${u.name}의 역할을 ${newRole === 'manager' ? '매니저' : '협력사'}로 변경하시겠습니까?`)) return;
    const res = await fetch('/api/members', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id, action: 'update_role', role: newRole }),
    });
    if (res.ok) {
      toast.success('역할이 변경되었습니다');
      fetchData();
    }
  };

  const openCreate = () => {
    setCreateForm({ email: '', password: '', name: '', role: 'partner', customer_id: '' });
    setCreateModal(true);
  };

  const handleCreate = async () => {
    if (!createForm.email || !createForm.password || !createForm.name) {
      toast.error('아이디/비밀번호/이름은 필수입니다');
      return;
    }
    if (createForm.role === 'partner' && !createForm.customer_id) {
      toast.error('거래처를 선택하세요');
      return;
    }
    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: createForm.email,
        password: createForm.password,
        name: createForm.name,
        role: createForm.role,
        customer_id: createForm.customer_id ? Number(createForm.customer_id) : null,
      }),
    });
    if (res.ok) {
      toast.success(`${createForm.role === 'manager' ? '매니저' : '거래처'} 계정이 생성되었습니다`);
      setCreateModal(false);
      fetchData();
    } else {
      const data = await res.json();
      toast.error(data.error || '생성 실패');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('이 회원을 삭제하시겠습니까?')) return;
    await fetch('/api/members', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'delete' }),
    });
    toast.success('삭제되었습니다');
    fetchData();
  };

  const pending = users.filter(u => u.status === 'pending');
  const approved = users.filter(u => u.status === 'approved');
  const rejected = users.filter(u => u.status === 'rejected');

  const statusBadge = (status: string) => {
    if (status === 'pending') return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700"><Clock size={12}/> 대기</span>;
    if (status === 'approved') return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700"><UserCheck size={12}/> 승인</span>;
    return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600"><UserX size={12}/> 거절</span>;
  };

  return (
    <>
      <PageHeader
        title="회원 관리"
        description={`총 ${users.length}명 (승인대기 ${pending.length}명)`}
        action={
          <button onClick={openCreate} className="btn-primary">
            <UserPlus size={16} /> 신규 계정 생성
          </button>
        }
      />

      {pending.length > 0 && (
        <div className="card mb-4 border-yellow-300 bg-yellow-50">
          <h3 className="font-semibold text-yellow-800 mb-3">승인 대기 ({pending.length}명)</h3>
          <div className="space-y-2">
            {pending.map(u => (
              <div key={u.id} className="flex items-center justify-between bg-white p-3 rounded-lg border">
                <div>
                  <span className="font-medium">{u.name}</span>
                  <span className="text-gray-500 ml-2 text-sm">{u.email}</span>
                  {u.company_name && <span className="text-blue-600 ml-2 text-sm">{u.company_name}</span>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setApproveModal(u); setSelectedCustomerId(String(u.customer_id || '')); }}
                    className="btn-success text-xs py-1 px-3"><CheckCircle size={14}/> 승인</button>
                  <button onClick={() => handleReject(u.id)}
                    className="btn-danger text-xs py-1 px-3"><XCircle size={14}/> 거절</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">불러오는 중...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>이메일</th>
                <th>역할</th>
                <th>소속 거래처</th>
                <th>상태</th>
                <th>가입일</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody>
              {[...approved, ...rejected].map(u => (
                <tr key={u.id}>
                  <td className="font-medium">{u.name}</td>
                  <td className="text-gray-500">{u.email}</td>
                  <td>
                    {u.role === 'master' && <span className="text-blue-600 font-medium">관리자</span>}
                    {u.role === 'manager' && <span className="text-amber-600 font-medium">매니저</span>}
                    {u.role === 'partner' && <span className="text-emerald-600">협력사</span>}
                  </td>
                  <td className="text-gray-500">{u.company_name || '-'}</td>
                  <td>{statusBadge(u.status)}</td>
                  <td className="text-gray-400 text-xs">{u.created_at?.split('T')[0]}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      {u.role !== 'master' && (
                        <>
                          {u.role === 'partner' && (
                            <button onClick={() => changeRole(u, 'manager')}
                              className="text-xs px-2 py-1 rounded hover:bg-amber-50 text-amber-600" title="매니저로 승격">
                              ↑매니저
                            </button>
                          )}
                          {u.role === 'manager' && (
                            <>
                              <button onClick={() => openPermModal(u)}
                                className="p-1.5 rounded hover:bg-amber-50" title="권한 설정">
                                <Shield size={14} className="text-amber-600" />
                              </button>
                              <button onClick={() => changeRole(u, 'partner')}
                                className="text-xs px-2 py-1 rounded hover:bg-gray-100 text-gray-500" title="협력사로 변경">
                                협력사
                              </button>
                            </>
                          )}
                          <button onClick={() => handleDelete(u.id)} className="p-1.5 rounded hover:bg-red-50">
                            <Trash2 size={14} className="text-red-400" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={createModal} onClose={() => setCreateModal(false)} title="신규 계정 생성">
        <div className="space-y-4">
          <div>
            <label className="form-label">역할 *</label>
            <div className="flex gap-2">
              <button
                onClick={() => setCreateForm({ ...createForm, role: 'partner' })}
                className={`flex-1 py-2 px-4 rounded-lg border-2 text-sm font-medium transition ${
                  createForm.role === 'partner'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >거래처</button>
              <button
                onClick={() => setCreateForm({ ...createForm, role: 'manager' })}
                className={`flex-1 py-2 px-4 rounded-lg border-2 text-sm font-medium transition ${
                  createForm.role === 'manager'
                    ? 'border-amber-500 bg-amber-50 text-amber-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >매니저</button>
            </div>
          </div>
          <div>
            <label className="form-label">아이디 *</label>
            <input type="text" className="form-input" placeholder="예: customer001"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
          </div>
          <div>
            <label className="form-label">비밀번호 *</label>
            <input type="text" className="form-input" placeholder="배포할 임시 비밀번호"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} />
          </div>
          <div>
            <label className="form-label">이름 *</label>
            <input type="text" className="form-input" placeholder="담당자 또는 매니저 이름"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
          </div>
          {createForm.role === 'partner' && (
            <div>
              <label className="form-label">연결할 거래처 *</label>
              <select className="form-select" value={createForm.customer_id}
                onChange={(e) => setCreateForm({ ...createForm, customer_id: e.target.value })}>
                <option value="">거래처를 선택하세요</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.company_name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700">
            💡 생성된 계정은 즉시 사용 가능합니다. 거래처에게 아이디/비밀번호를 안내해주세요.
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setCreateModal(false)} className="btn-secondary">취소</button>
            <button onClick={handleCreate} className="btn-primary">계정 생성</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!permModal} onClose={() => setPermModal(null)} title="매니저 탭 권한 설정">
        {permModal && (
          <div className="space-y-4">
            <p className="text-sm">
              <strong>{permModal.name}</strong> ({permModal.email}) 매니저가 볼 수 있는 탭을 선택하세요.
            </p>
            <p className="text-xs text-gray-500">
              * 회원관리, 설정 탭은 관리자 전용이라 매니저에게는 항상 숨겨집니다.
            </p>
            <div className="space-y-2 border rounded-lg p-4 bg-gray-50">
              {TAB_OPTIONS.map(tab => (
                <label key={tab.key} className="flex items-center gap-2 cursor-pointer hover:bg-white rounded px-2 py-1">
                  <input type="checkbox"
                    checked={permTabs.includes(tab.key)}
                    onChange={() => togglePermTab(tab.key)}
                    className="w-4 h-4" />
                  <span className="text-sm">{tab.label}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPermModal(null)} className="btn-secondary">취소</button>
              <button onClick={savePerms} className="btn-primary">저장</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!approveModal} onClose={() => setApproveModal(null)} title="회원 승인">
        {approveModal && (
          <div className="space-y-4">
            <p><strong>{approveModal.name}</strong> ({approveModal.email})을 승인합니다.</p>
            <div>
              <label className="form-label">거래처 연결 *</label>
              <select className="form-select" value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}>
                <option value="">거래처를 선택하세요</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.company_name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">협력사 계정에 거래처를 연결해야 발주가 가능합니다</p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setApproveModal(null)} className="btn-secondary">취소</button>
              <button onClick={handleApprove} className="btn-success">승인</button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
