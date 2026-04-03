'use client';

import { useEffect, useState, useCallback } from 'react';
import { CheckCircle, XCircle, Trash2, Clock, UserCheck, UserX } from 'lucide-react';
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
  created_at: string;
}

export default function MembersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<{ id: number; company_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [approveModal, setApproveModal] = useState<User | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

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
      <PageHeader title="회원 관리" description={`총 ${users.length}명 (승인대기 ${pending.length}명)`} />

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
                  <td>{u.role === 'master' ? <span className="text-blue-600 font-medium">관리자</span> : '협력사'}</td>
                  <td className="text-gray-500">{u.company_name || '-'}</td>
                  <td>{statusBadge(u.status)}</td>
                  <td className="text-gray-400 text-xs">{u.created_at?.split('T')[0]}</td>
                  <td>
                    {u.role !== 'master' && (
                      <button onClick={() => handleDelete(u.id)} className="p-1.5 rounded hover:bg-red-50">
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
