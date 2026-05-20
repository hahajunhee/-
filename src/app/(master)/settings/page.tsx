'use client';

import { useEffect, useState, useCallback } from 'react';
import { Save, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';
import { Settings } from '@/types';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newBrand, setNewBrand] = useState('');

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

  const handleSealUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      toast.error('이미지는 1MB 이하만 업로드 가능합니다');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setSettings(prev => prev ? { ...prev, seal_image: result } : prev);
    };
    reader.readAsDataURL(file);
  };

  const removeSeal = () => {
    if (settings) setSettings({ ...settings, seal_image: '' });
  };

  const addBrand = () => {
    const name = newBrand.trim();
    if (!name) return;
    if (!settings) return;
    const brands = settings.brands || [];
    if (brands.includes(name)) {
      toast.error('이미 등록된 브랜드입니다');
      return;
    }
    setSettings({ ...settings, brands: [...brands, name] });
    setNewBrand('');
  };

  const removeBrand = (b: string) => {
    if (!settings) return;
    setSettings({ ...settings, brands: (settings.brands || []).filter((x) => x !== b) });
  };

  return (
    <>
      <PageHeader
        title="본사"
        description="공급자 정보 및 브랜드 설정"
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
              <input type="text" className="form-input" placeholder="예: (주)굿푸드시스템" value={settings.company_name}
                onChange={(e) => update('company_name', e.target.value)} />
            </div>
            <div>
              <label className="form-label">대표자</label>
              <input type="text" className="form-input" placeholder="예: 김수길" value={settings.rep_name}
                onChange={(e) => update('rep_name', e.target.value)} />
            </div>
            <div>
              <label className="form-label">사업자등록번호</label>
              <input type="text" className="form-input" placeholder="예: 132-81-60911" value={settings.reg_number}
                onChange={(e) => update('reg_number', e.target.value)} />
            </div>
            <div>
              <label className="form-label">업태</label>
              <input type="text" className="form-input" placeholder="예: 제조,도소매,서비스" value={settings.business_type}
                onChange={(e) => update('business_type', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="form-label">주소</label>
              <input type="text" className="form-input" placeholder="예: 경기 구리시 동구릉로460번길 95 1층, 3층" value={settings.address}
                onChange={(e) => update('address', e.target.value)} />
            </div>
            <div>
              <label className="form-label">전화번호</label>
              <input type="text" className="form-input" placeholder="예: 031-555-6663" value={settings.tel}
                onChange={(e) => update('tel', e.target.value)} />
            </div>
            <div>
              <label className="form-label">FAX</label>
              <input type="text" className="form-input" placeholder="예: 031-555-7774" value={settings.fax}
                onChange={(e) => update('fax', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="form-label">계좌 정보</label>
              <input type="text" className="form-input" placeholder="예: 하나: 486-910008-32704 / 국민: 442801-01-132431" value={settings.bank_info}
                onChange={(e) => update('bank_info', e.target.value)} />
            </div>
            <div>
              <label className="form-label">출력 담당자</label>
              <input type="text" className="form-input" placeholder="예: 신현숙" value={settings.print_operator}
                onChange={(e) => update('print_operator', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="form-label">거래명세서 하단 메모</label>
              <input type="text" className="form-input"
                placeholder="예: ★★D-2발주부탁드립니다. **발주폰-010-4078-0692** **택배폰-010-2043-4983**"
                value={settings.invoice_note || ''}
                onChange={(e) => update('invoice_note', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="form-label">법인 도장 (거래명세서 제목 옆에 표시됨)</label>
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <input type="file" accept="image/png,image/jpeg,image/gif"
                    onChange={handleSealUpload}
                    className="block text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100 cursor-pointer" />
                  <p className="text-xs text-gray-400 mt-1">PNG/JPG/GIF, 1MB 이하 (배경 투명한 PNG 권장)</p>
                </div>
                {settings.seal_image && (
                  <div className="flex flex-col items-center gap-1">
                    <img src={settings.seal_image} alt="법인 도장" className="w-20 h-20 object-contain border rounded bg-white" />
                    <button onClick={removeSeal} className="text-xs text-red-500 hover:underline">제거</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 브랜드 생성 */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">브랜드 관리</h3>
            <span className="text-xs text-gray-500">
              본사 ▸ 브랜드 ▸ 본점/직영점/가맹점
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            브랜드를 등록하면 거래처/품목/대시보드의 브랜드 선택 옵션에 자동으로 노출됩니다.
          </p>
          <div className="flex gap-2 mb-3">
            <input type="text" className="form-input flex-1"
              placeholder="새 브랜드명 (예: 한우진가)"
              value={newBrand}
              onChange={(e) => setNewBrand(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBrand(); } }} />
            <button onClick={addBrand} className="btn-primary">
              <Plus size={16} /> 추가
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(settings.brands || []).length === 0 && (
              <p className="text-sm text-gray-400 py-2">등록된 브랜드가 없습니다. 위에서 브랜드명을 입력하고 추가하세요.</p>
            )}
            {(settings.brands || []).map((b, idx) => (
              <span key={b} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-sm">
                <span className="text-xs text-indigo-400 font-mono">{idx + 1}</span>
                <span className="font-medium text-indigo-700">{b}</span>
                <button onClick={() => removeBrand(b)} className="ml-1 p-0.5 rounded hover:bg-indigo-200">
                  <X size={12} className="text-indigo-500" />
                </button>
              </span>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mt-3">
            💡 저장 버튼을 눌러야 적용됩니다. 브랜드를 삭제해도 기존 거래처/품목의 브랜드명은 그대로 남아 있습니다 (수동 정리 필요).
          </p>
        </div>
      </div>
    </>
  );
}
