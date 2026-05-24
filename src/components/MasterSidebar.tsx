'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Package, Building2, FileText,
  PlusCircle, Users, ShoppingCart, LogOut, ChevronLeft, ChevronRight,
  Wallet, Crown, TrendingUp, BarChart3,
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { key: 'settings', href: '/settings', label: '본사', icon: Crown },
  { key: 'customers', href: '/customers', label: '거래처', icon: Building2 },
  { key: 'products', href: '/products', label: '품목 관리', icon: Package },
  { key: 'transactions_new', href: '/transactions/new', label: '발주', icon: PlusCircle },
  { key: 'transactions', href: '/transactions', label: '발주 내역', icon: FileText },
  { key: 'orders', href: '/orders-manage', label: '발주 관리', icon: ShoppingCart },
  { key: 'revenues', href: '/revenues', label: '매출', icon: TrendingUp },
  { key: 'costs', href: '/costs', label: '비용', icon: Wallet },
  { key: 'dashboard', href: '/', label: '통계 (본사)', icon: LayoutDashboard },
  { key: 'customer_stats', href: '/customer-stats', label: '통계 (거래처)', icon: BarChart3 },
  { key: 'members', href: '/members', label: '계정 관리', icon: Users },
];

// 매니저는 회원관리/설정 영구 차단 (관리자 전용)
const MANAGER_ONLY_HIDDEN = ['members', 'settings'];
// 매니저 기본 노출 탭
const MANAGER_DEFAULT_TABS = ['dashboard', 'customer_stats', 'customers', 'transactions_new', 'transactions', 'orders', 'revenues', 'costs'];

export default function MasterSidebar({
  userName,
  userRole = 'master',
  allowedTabs = null,
}: {
  userName: string;
  userRole?: 'master' | 'manager';
  allowedTabs?: string[] | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    router.push('/login');
  };

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-60'} bg-slate-900 text-white flex flex-col transition-all duration-200 shrink-0`}>
      <div className="flex items-center justify-between px-4 h-16 border-b border-slate-700">
        {!collapsed && <h1 className="text-lg font-bold tracking-tight">SOYANG F&amp;C</h1>}
        <button onClick={() => setCollapsed(!collapsed)} className="p-1 rounded hover:bg-slate-700">
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 py-4">
        {navItems
          .filter((item) => {
            if (userRole === 'master') return true;
            if (MANAGER_ONLY_HIDDEN.includes(item.key)) return false;
            // 관리자가 권한 설정 안 했으면 기본 4개, 설정했으면 그 목록만
            const tabs = (allowedTabs && allowedTabs.length > 0) ? allowedTabs : MANAGER_DEFAULT_TABS;
            return tabs.includes(item.key);
          })
          .map((item) => {
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} title={item.label}
                className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                  isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}>
                <item.icon size={20} className="shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
      </nav>

      <div className="border-t border-slate-700">
        {!collapsed && (
          <div className="px-4 py-2 text-xs text-slate-400">
            <span className={userRole === 'master' ? 'text-blue-400' : 'text-amber-400'}>
              {userRole === 'master' ? '관리자' : '매니저'}
            </span> {userName}
          </div>
        )}
        <button onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 hover:text-white w-full">
          <LogOut size={20} className="shrink-0" />
          {!collapsed && <span>로그아웃</span>}
        </button>
      </div>
    </aside>
  );
}
