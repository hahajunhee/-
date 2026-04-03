'use client';

import { useEffect, useState, useCallback } from 'react';
import { Save } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';
import { Settings } from '@/types';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    const res = await fetch('/api/settings');
    if (res.ok) {
      setSettings(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      toast.success('저장되었습니다');
    } else {
      toast.error('저장 실패');
    }
    setSaving(false);
  };

  if (loading) return <div className="p-8 text-center text-gray-400">불러오는 중...</div>;
  if (!settings) return <div className="p-8 text-center text-red-500">설정을 불러올 수 없습니다</div>;

  const update = (field: keyof Settings, value: string) => {
    setSettings({ ...settings, [field]: value });
  };

  return (
    <>
      <PageHeader
        title="설정"
        description="공급자 정보 및 시스템 설정"
        action={
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            <Save size={16} /> {saving ? '저장 중...' : '저장'}
          </button>
        }
      />

      <div className="max-w-2xl space-y-6">
        <div className="card">
          <h3 className="font-semibold mb-4">공급자 정보</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">상호명</label>
              <input type="text" className="form-input" value={settings.company_name}
                onChange={(e) => update('company_name', e.target.value)} />
            </div>
            <div>
              <label className="form-label">대표자</label>
              <input type="text" className="form-input" value={settings.rep_name}
                onChange={(e) => update('rep_name', e.target.value)} />
            </div>
            <div>
              <label className="form-label">사업자등록번호</label>
              <input type="text" className="form-input" value={settings.reg_number}
                onChange={(e) => update('reg_number', e.target.value)} />
            </div>
            <div>
              <label className="form-label">업태</label>
              <input type="text" className="form-input" value={settings.business_type}
                onChange={(e) => update('business_type', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="form-label">주소</label>
              <input type="text" className="form-input" value={settings.address}
                onChange={(e) => update('address', e.target.value)} />
            </div>
            <div>
              <label className="form-label">전화번호</label>
              <input type="text" className="form-input" value={settings.tel}
                onChange={(e) => update('tel', e.target.value)} />
            </div>
            <div>
              <label className="form-label">FAX</label>
              <input type="text" className="form-input" value={settings.fax}
                onChange={(e) => update('fax', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="form-label">계좌 정보</label>
              <input type="text" className="form-input" value={settings.bank_info}
                onChange={(e) => update('bank_info', e.target.value)} />
            </div>
            <div>
              <label className="form-label">출력 담당자</label>
              <input type="text" className="form-input" value={settings.print_operator}
                onChange={(e) => update('print_operator', e.target.value)} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
