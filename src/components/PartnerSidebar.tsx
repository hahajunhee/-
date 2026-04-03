'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ShoppingCart, PlusCircle, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { href: '/partner/orders', label: '발주 내역', icon: ShoppingCart },
  { href: '/partner/orders/new', label: '발주서 작성', icon: PlusCircle },
];

export default function PartnerSidebar({ userName, companyName }: { userName: string; companyName: string }) {
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
    <aside className={`${collapsed ? 'w-16' : 'w-60'} bg-emerald-900 text-white flex flex-col transition-all duration-200 shrink-0`}>
      <div className="flex items-center justify-between px-4 h-16 border-b border-emerald-700">
        {!collapsed && <h1 className="text-lg font-bold tracking-tight">협력사 포털</h1>}
        <button onClick={() => setCollapsed(!collapsed)} className="p-1 rounded hover:bg-emerald-700">
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 py-4">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} title={item.label}
              className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                isActive ? 'bg-emerald-600 text-white' : 'text-emerald-200 hover:bg-emerald-800 hover:text-white'
              }`}>
              <item.icon size={20} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-emerald-700">
        {!collapsed && (
          <div className="px-4 py-2 text-xs text-emerald-300">
            <p className="text-emerald-400">{companyName}</p>
            <p>{userName}</p>
          </div>
        )}
        <button onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 text-sm text-emerald-200 hover:bg-emerald-800 hover:text-white w-full">
          <LogOut size={20} className="shrink-0" />
          {!collapsed && <span>로그아웃</span>}
        </button>
      </div>
    </aside>
  );
}
