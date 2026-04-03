'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Package, Building2, FileText,
  PlusCircle, Settings, Users, ShoppingCart, LogOut, ChevronLeft, ChevronRight, Mail,
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { href: '/', label: '대시보드', icon: LayoutDashboard },
  { href: '/products', label: '품목 관리', icon: Package },
  { href: '/customers', label: '거래처 관리', icon: Building2 },
  { href: '/transactions/new', label: '거래 입력', icon: PlusCircle },
  { href: '/transactions', label: '거래 내역', icon: FileText },
  { href: '/orders-manage', label: '발주 관리', icon: ShoppingCart },
  { href: '/members', label: '회원 관리', icon: Users },
  { href: '/settings', label: '설정', icon: Settings },
];

export default function MasterSidebar({ userName }: { userName: string }) {
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
        {!collapsed && <h1 className="text-lg font-bold tracking-tight">거래관리</h1>}
        <button onClick={() => setCollapsed(!collapsed)} className="p-1 rounded hover:bg-slate-700">
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 py-4">
        {navItems.map((item) => {
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
            <span className="text-blue-400">관리자</span> {userName}
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
