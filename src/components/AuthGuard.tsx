'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import MasterSidebar from './MasterSidebar';
import PartnerSidebar from './PartnerSidebar';

interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: 'master' | 'manager' | 'partner';
  customer_id: number | null;
  allowed_tabs?: string[] | null;
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
        // master 페이지는 master와 manager 모두 접근 가능
        const allowed =
          requiredRole === 'master'
            ? data.user && (data.user.role === 'master' || data.user.role === 'manager')
            : data.user && data.user.role === requiredRole;
        if (!allowed) {
          router.push('/login');
          return;
        }
        setUser(data.user);
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
      <div className="no-print">
        {requiredRole === 'master' ? (
          <MasterSidebar userName={user.name} userRole={user.role as 'master' | 'manager'} allowedTabs={user.allowed_tabs || null} />
        ) : (
          <PartnerSidebar userName={user.name} companyName={companyName} />
        )}
      </div>
      <main className="flex-1 overflow-y-auto main-content">
        <div className="p-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
