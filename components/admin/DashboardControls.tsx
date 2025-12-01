'use client';

import { useState } from 'react';

export default function DashboardControls() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function doSync() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admins/sync', { method: 'POST' });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Sync failed');
      setMessage(`Sync done: attempted=${payload.attempted}, updated=${payload.updated}`);
    } catch (e) {
      setMessage((e as Error).message || 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function reload() {
    setLoading(true);
    setMessage(null);
    try {
      const [u, r] = await Promise.all([fetch('/api/admins/users'), fetch('/api/access-requests')]);
      const pu = await u.json().catch(() => ({}));
      const pr = await r.json().catch(() => ({}));
      setMessage(`Users: ${(pu.data || []).length}, Requests: ${(pr.data || []).length}`);
    } catch (e) {
      setMessage((e as Error).message || 'Error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div className="flex items-center gap-3">
        <button
          className="px-3 py-2 bg-blue-600 text-white rounded disabled:opacity-60"
          onClick={doSync}
          disabled={loading}
        >
          Sync users
        </button>
        <button
          className="px-3 py-2 bg-slate-100 text-slate-900 rounded disabled:opacity-60"
          onClick={reload}
          disabled={loading}
        >
          Reload counts
        </button>
      </div>
      <div className="text-sm text-slate-600">{message ?? 'Ready'}</div>
    </div>
  );
}
