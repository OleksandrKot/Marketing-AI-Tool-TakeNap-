'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJSON, postJSON } from '@/lib/api/client';

export default function DashboardControls() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const qc = useQueryClient();

  const syncMutation = useMutation<
    { attempted: number; updated: number },
    { message: string } | Error,
    void
  >({
    mutationFn: () => postJSON('/api/admins/sync', {}),
    onMutate: () => {
      setLoading(true);
      setMessage(null);
    },
    onSuccess: (payload) => {
      setMessage(`Sync done: attempted=${payload.attempted}, updated=${payload.updated}`);
      // Refresh related queries
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: ['access', 'requests'] });
    },
    onError: (e) => {
      const msg = (e as { message?: string })?.message || 'Error';
      setMessage(msg);
    },
    onSettled: () => setLoading(false),
  });

  const reloadCounts = async () => {
    try {
      setLoading(true);
      setMessage(null);
      const [pu, pr] = await Promise.all([
        fetchJSON<{ data: unknown[] }>('/api/admins/users'),
        fetchJSON<{ data: unknown[] }>('/api/access-requests'),
      ]);
      setMessage(`Users: ${(pu.data || []).length}, Requests: ${(pr.data || []).length}`);
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: ['access', 'requests'] });
    } catch (e) {
      const msg = (e as { message?: string })?.message || 'Error';
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div className="flex items-center gap-3">
        <button
          className="px-3 py-2 bg-blue-600 text-white rounded disabled:opacity-60"
          onClick={() => syncMutation.mutate()}
          disabled={loading}
        >
          Sync users
        </button>
        <button
          className="px-3 py-2 bg-slate-100 text-slate-900 rounded disabled:opacity-60"
          onClick={reloadCounts}
          disabled={loading}
        >
          Reload counts
        </button>
      </div>
      <div className="text-sm text-slate-600">{message ?? 'Ready'}</div>
    </div>
  );
}
