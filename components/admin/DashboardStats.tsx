'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchJSON } from '@/lib/api/client';

export default function DashboardStats() {
  const usersQuery = useQuery<{
    data: Array<{ is_admin?: boolean; is_blocked?: boolean; created_at?: string }>;
  }>({
    queryKey: ['admin', 'users'],
    queryFn: () => fetchJSON('/api/admins/users'),
    refetchInterval: 30_000,
  });

  const requestsQuery = useQuery<{ data: Array<{ status?: string }> }>({
    queryKey: ['access', 'requests'],
    queryFn: () => fetchJSON('/api/access-requests'),
    refetchInterval: 30_000,
  });

  const users = usersQuery.data?.data || [];
  const reqs = requestsQuery.data?.data || [];

  const { totalUsers, admins, blocked, pendingRequests, new7, new30 } = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    return {
      totalUsers: users.length,
      admins: users.filter((u) => u.is_admin).length,
      blocked: users.filter((u) => u.is_blocked).length,
      pendingRequests: reqs.filter((r) => r.status === 'pending').length,
      new7: users.filter((u) => u.created_at && new Date(u.created_at) >= sevenDaysAgo).length,
      new30: users.filter((u) => u.created_at && new Date(u.created_at) >= thirtyDaysAgo).length,
    };
  }, [users, reqs]);

  return (
    <>
      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Total users</div>
          <div className="text-2xl font-semibold text-slate-900">{totalUsers}</div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Admins</div>
          <div className="text-2xl font-semibold text-slate-900">{admins}</div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Blocked</div>
          <div className="text-2xl font-semibold text-slate-900">{blocked}</div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-500 uppercase mb-1">
            Pending requests
          </div>
          <div className="text-2xl font-semibold text-slate-900">{pendingRequests}</div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3 mt-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-500 uppercase mb-1">
            New users (last 7 days)
          </div>
          <div className="text-2xl font-semibold text-slate-900">{new7}</div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-500 uppercase mb-1">
            New users (last 30 days)
          </div>
          <div className="text-2xl font-semibold text-slate-900">{new30}</div>
        </div>
        <div className="rounded-2xl bg-white border border-dashed border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Access queue</div>
          <p className="text-sm text-slate-600">
            Review and approve new access requests in the{' '}
            <a className="text-blue-600 underline" href="/admin/access-requests">
              Access requests
            </a>{' '}
            tab.
          </p>
        </div>
      </section>
    </>
  );
}
