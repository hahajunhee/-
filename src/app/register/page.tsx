'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { UserPlus } from 'lucide-react';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', password2: '', customer_id: '' });
  const [customers, setCustomers] = useState<{ id: number; company_name: string }[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/customers').then(r => r.json()).then(setCustomers).catch(() => {});
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (form.password !== form.password2) {
      setError('비밀번호가 일치하지 않습니다');
      return;
    }
    if (form.password.length < 4) {
      setError('비밀번호는 4자 이상이어야 합니다');
      return;
    }

    setLoading(true);
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'register',
        name: form.name,
        email: form.email,
        password: form.password,
        customer_id: form.customer_id ? Number(form.customer_id) : null,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      setSuccess(data.message);
      setForm({ name: '', email: '', password: '', password2: '', customer_id: '' });
    } else {
      setError(data.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 rounded-2xl mb-4">
              <UserPlus size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold">협력사 회원가입</h1>
            <p className="text-gray-500 mt-1">관리자 승인 후 이용 가능합니다</p>
          </div>

          {success ? (
            <div className="text-center">
              <div className="p-4 bg-emerald-50 text-emerald-700 rounded-lg mb-4">{success}</div>
              <Link href="/login" className="text-blue-600 font-medium hover:underline">
                로그인 페이지로 이동
              </Link>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="form-label">이름 (담당자명) *</label>
                <input type="text" className="form-input" placeholder="예: 김도윤"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label className="form-label">이메일 *</label>
                <input type="email" className="form-input" placeholder="예: partner@company.com"
                  value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div>
                <label className="form-label">비밀번호 *</label>
                <input type="password" className="form-input" placeholder="4자 이상"
                  value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </div>
              <div>
                <label className="form-label">비밀번호 확인 *</label>
                <input type="password" className="form-input" placeholder="비밀번호를 다시 입력"
                  value={form.password2} onChange={(e) => setForm({ ...form, password2: e.target.value })} required />
              </div>
              <div>
                <label className="form-label">소속 거래처</label>
                <select className="form-select" value={form.customer_id}
                  onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
                  <option value="">선택하세요 (없으면 관리자가 연결)</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.company_name}</option>
                  ))}
                </select>
              </div>

              {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

              <button type="submit" disabled={loading} className="btn-success w-full justify-center py-3">
                {loading ? '처리 중...' : '회원가입 신청'}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link href="/login" className="text-sm text-gray-500 hover:text-blue-600">
              이미 계정이 있으신가요? 로그인
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
