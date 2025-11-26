'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { ProfileDropdown } from '@/app/login-auth/components/profile-dropdown';

const navItems = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/access-requests', label: 'Access requests' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/settings', label: 'Settings' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-slate-200 bg-white">
        <div className="h-16 flex items-center px-6 border-b border-slate-200">
          <button
            onClick={() => router.push('/')}
            className="text-lg font-semibold tracking-tight text-slate-900"
          >
            Marketing AI Admin
          </button>
        </div>
        <nav className="flex-1 py-4 space-y-1">
          {navItems.map((item) => {
            const active =
              pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'block px-6 py-2.5 text-sm font-medium rounded-r-full transition-colors',
                  active ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100',
                ].join(' ')}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 flex items-center justify-between px-4 md:px-8 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-3 md:hidden">
            <button
              onClick={() => router.push('/')}
              className="text-base font-semibold tracking-tight text-slate-900"
            >
              Marketing AI Admin
            </button>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden md:inline text-xs text-slate-500 uppercase tracking-wide">
              Admin area
            </span>
            <ProfileDropdown />
          </div>
        </header>

        <main className="flex-1 px-4 md:px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
