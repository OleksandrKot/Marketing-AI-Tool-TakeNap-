'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardControls from '@/components/admin/DashboardControls';
import DashboardStats from '@/components/admin/DashboardStats';
import { useAdmin } from '@/components/admin/AdminProvider';

type AdminUser = {
  id: string;
  email: string;
  created_at: string;
  is_admin?: boolean;
  is_blocked?: boolean;
};

export default function AdminDashboardPage() {
  const adminCtx = useAdmin();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);

  useEffect(() => {
    if (!adminCtx.loading && adminCtx.isAdmin === false) {
      // Not an admin — redirect away
      router.replace('/');
    }
  }, [adminCtx.isAdmin, adminCtx.loading, router]);

  useEffect(() => {
    async function load() {
      // loading/error state not needed in this view; log errors to console
      try {
        const res = await fetch('/api/admins/users', { cache: 'no-store' });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error || 'Failed to load users');
        setUsers(payload.data || []);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
      } finally {
        // no UI loading state to clear
      }
    }

    if (!adminCtx.loading && adminCtx.isAdmin) load();
  }, [adminCtx.loading, adminCtx.isAdmin]);

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  const newUsers7d = users.filter(
    (u) => new Date(u.created_at) >= sevenDaysAgo && new Date(u.created_at) <= now
  ).length;
  const newUsers30d = users.filter(
    (u) => new Date(u.created_at) >= thirtyDaysAgo && new Date(u.created_at) <= now
  ).length;

  if (adminCtx.loading) {
    return (
      <div className="py-8 text-center text-sm text-slate-600">Checking admin permissions…</div>
    );
  }

  if (!adminCtx.isAdmin) {
    return (
      <div className="py-8 text-center text-sm text-red-600">Access denied — admins only.</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-600 mt-1">
            High-level overview of users and access requests.
          </p>
        </div>
        {false ? (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-1 rounded-lg">
            Set <code>ACCESS_REQUESTS_ADMIN_SECRET</code> or <code>ADMIN_SECRET</code> in env to
            enable admin data.
          </p>
        ) : null}
      </div>

      {/* Client-side live stats (keeps values up-to-date) */}
      <DashboardStats />

      {/* Interactive controls (client) */}
      <section>
        <DashboardControls />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-500 uppercase mb-1">
            New users (last 7 days)
          </div>
          <div className="text-2xl font-semibold text-slate-900">{newUsers7d}</div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-500 uppercase mb-1">
            New users (last 30 days)
          </div>
          <div className="text-2xl font-semibold text-slate-900">{newUsers30d}</div>
        </div>
        <div className="rounded-2xl bg-white border border-dashed border-slate-200 p-4 flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Access queue</div>
            <p className="text-sm text-slate-600">
              Review and approve new access requests in the{' '}
              <Link href="/admin/access-requests" className="text-blue-600 underline">
                Access requests
              </Link>{' '}
              tab.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
