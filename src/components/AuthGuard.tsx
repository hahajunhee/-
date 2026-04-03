'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import MasterSidebar from './MasterSidebar';
import PartnerSidebar from './PartnerSidebar';

interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: 'master' | 'partner';
  customer_id: number | null;
}

export default function AuthGuard({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole: 'master' | 'partner';
}) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth')
      .then((r) => r.json())
      .then(async (data) => {
        if (!data.user || data.user.role !== requiredRole) {
          router.push('/login');
          return;
        }
        setUser(data.user);
        // 협력사면 회사명 가져오기
        if (data.user.role === 'partner' && data.user.customer_id) {
          try {
            const custRes = await fetch('/api/customers');
            const customers = await custRes.json();
            const c = customers.find((c: any) => c.id === data.user.customer_id);
            if (c) setCompanyName(c.company_name);
          } catch {}
        }
        setLoading(false);
      })
      .catch(() => router.push('/login'));
  }, [requiredRole, router]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-400">로딩 중...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="h-full flex">
      {requiredRole === 'master' ? (
        <MasterSidebar userName={user.name} />
      ) : (
        <PartnerSidebar userName={user.name} companyName={companyName} />
      )}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
