'use client';

import { useEffect, useState } from 'react';

export default function DashboardStats() {
  const [, setLoading] = useState(true);
  const [totalUsers, setTotalUsers] = useState(0);
  const [admins, setAdmins] = useState(0);
  const [blocked, setBlocked] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [new7, setNew7] = useState(0);
  const [new30, setNew30] = useState(0);

  async function fetchCounts() {
    setLoading(true);
    try {
      const [usersRes, reqRes] = await Promise.all([
        fetch('/api/admins/users'),
        fetch('/api/access-requests'),
      ]);
      const usersJson = await usersRes.json().catch(() => ({} as Record<string, unknown>));
      const reqJson = await reqRes.json().catch(() => ({} as Record<string, unknown>));
      const users = (usersJson.data || []) as Array<{
        is_admin?: boolean;
        is_blocked?: boolean;
        created_at?: string;
      }>;
      const reqs = (reqJson.data || []) as Array<{ status?: string }>;

      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 7);
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);

      setTotalUsers(users.length);
      setAdmins(users.filter((u) => u.is_admin).length);
      setBlocked(users.filter((u) => u.is_blocked).length);
      setPendingRequests(reqs.filter((r) => r.status === 'pending').length);
      setNew7(users.filter((u) => u.created_at && new Date(u.created_at) >= sevenDaysAgo).length);
      setNew30(users.filter((u) => u.created_at && new Date(u.created_at) >= thirtyDaysAgo).length);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCounts();
    const t = setInterval(fetchCounts, 30_000);
    return () => clearInterval(t);
  }, []);

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
