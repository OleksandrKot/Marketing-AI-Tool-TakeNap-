import Link from 'next/link';

async function fetchJson<T>(url: string, adminSecret: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'x-admin-secret': adminSecret,
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({} as Record<string, unknown>));
    const err = (payload as Record<string, unknown>)['error'];
    throw new Error(String(err ?? `Failed request: ${res.status}`));
  }
  return res.json();
}

type AdminUser = {
  id: string;
  email: string;
  created_at: string;
  is_admin?: boolean;
  is_blocked?: boolean;
};

export default async function AdminDashboardPage() {
  const adminSecret = process.env.ACCESS_REQUESTS_ADMIN_SECRET || process.env.ADMIN_SECRET || '';

  let users: AdminUser[] = [];
  type AccessRequest = { id: string; email: string; status?: string; created_at?: string };
  let accessRequests: AccessRequest[] = [];

  if (adminSecret) {
    try {
      const base = process.env.NEXT_PUBLIC_APP_URL || '';
      const root = base.replace(/\/$/, '');
      const usersUrl = `${root}/api/admins/users`;
      const requestsUrl = `${root}/api/access-requests`;

      const [usersResp, reqResp] = await Promise.all([
        fetchJson<{ ok: boolean; data: AdminUser[] }>(usersUrl, adminSecret),
        fetchJson<{ ok: boolean; data: AccessRequest[] }>(requestsUrl, adminSecret),
      ]);

      users = usersResp?.data || [];
      accessRequests = reqResp?.data || [];
    } catch {
      // swallow errors – UI will show fallback
    }
  }

  const totalUsers = users.length;
  const blocked = users.filter((u) => u.is_blocked).length;
  const admins = users.filter((u) => u.is_admin).length;
  const pendingRequests = accessRequests.filter((r) => r.status === 'pending').length;

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-600 mt-1">
            High-level overview of users and access requests.
          </p>
        </div>
        {!adminSecret ? (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-1 rounded-lg">
            Set <code>ACCESS_REQUESTS_ADMIN_SECRET</code> or <code>ADMIN_SECRET</code> in env to
            enable admin data.
          </p>
        ) : null}
      </div>

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
