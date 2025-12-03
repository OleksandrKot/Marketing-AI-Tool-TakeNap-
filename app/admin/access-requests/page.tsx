'use client';

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type AccessRequest = {
  id: string;
  email: string;
  status: string;
  created_at: string;
};

export default function AccessRequestsPage() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AccessRequest[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/access-requests');
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Failed to load requests');
      setItems(((payload?.data || []) as AccessRequest[]).filter((r) => r.status === 'pending'));
      setSelectedIds(new Set());
    } catch (e) {
      setError((e as Error).message || 'Error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doAction(id: string, action: 'approve' | 'reject') {
    setLoading(true);
    setError(null);
    try {
      // Try to include acting admin email for audit/debug
      let actedBy: string | null = null;
      try {
        const { data: sessionData } = await (
          await import('@/lib/core/supabase')
        ).supabase.auth.getSession();
        actedBy = (sessionData as unknown as Record<string, unknown>)?.session?.user?.email as
          | string
          | null;
      } catch {
        actedBy = null;
      }

      const res = await fetch(`/api/access-requests/${encodeURIComponent(id)}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acted_by_email: actedBy }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Failed to perform action');
      await load();

      if (payload?.emailSent) {
        const sent: unknown = payload.emailSent;
        if (sent && (sent as { ok?: boolean }).ok) {
          showToast({ message: 'Approved — notification email sent to user', type: 'success' });
        } else {
          showToast({ message: 'Approved — notification email could not be sent', type: 'error' });
          console.debug('emailSend result', sent);
        }
      } else {
        showToast({ message: 'Action performed', type: 'success' });
      }
    } catch (e) {
      setError((e as Error).message || 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function bulkAction(action: 'approve' | 'reject') {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setLoading(true);
    setError(null);
    try {
      await Promise.all(ids.map((id) => doAction(id, action)));
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const pending = items.filter((r) => r.status === 'pending');
    if (!q) return pending;
    return pending.filter((r) => r.email.toLowerCase().includes(q));
  }, [items, search]);

  const pendingCount = items.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Access requests</h1>
          <p className="text-sm text-slate-600 mt-1">
            Review and approve users who requested access to the tool.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Pending:&nbsp;
            <span className="font-semibold">{pendingCount}</span>
          </p>
        </div>
        <div className="flex flex-col items-stretch md:items-end gap-2">
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <Input
          placeholder="Search by email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600">
              Selected: <span className="font-semibold">{selectedIds.size}</span>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => bulkAction('approve')}
              disabled={loading}
            >
              Approve selected
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => bulkAction('reject')}
              disabled={loading}
            >
              Block selected
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="grid grid-cols-[auto,2fr,2fr,1fr,auto] gap-3 px-4 py-2 text-xs font-semibold text-slate-500 border-b border-slate-200">
          <div>
            <input
              type="checkbox"
              checked={selectedIds.size > 0 && selectedIds.size === filtered.length}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedIds(new Set(filtered.map((r) => r.id)));
                } else {
                  setSelectedIds(new Set());
                }
              }}
            />
          </div>
          <div>Email</div>
          <div>Requested at</div>
          <div>Status</div>
          <div className="text-right">Actions</div>
        </div>
        {filtered.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">No requests loaded.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((r) => {
              const checked = selectedIds.has(r.id);
              return (
                <div
                  key={r.id}
                  className="grid grid-cols-[auto,2fr,2fr,1fr,auto] gap-3 px-4 py-3 text-sm items-center"
                >
                  <div>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = new Set(selectedIds);
                        if (e.target.checked) next.add(r.id);
                        else next.delete(r.id);
                        setSelectedIds(next);
                      }}
                    />
                  </div>
                  <div className="font-medium text-slate-900 truncate">{r.email}</div>
                  <div className="text-xs text-slate-600">
                    {r.created_at ? format(new Date(r.created_at), 'yyyy-MM-dd HH:mm') : '—'}
                  </div>
                  <div>
                    <Badge
                      variant={
                        r.status === 'approved'
                          ? 'default'
                          : r.status === 'pending'
                          ? 'secondary'
                          : 'outline'
                      }
                    >
                      {r.status}
                    </Badge>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loading || r.status === 'approved'}
                      onClick={() => doAction(r.id, 'approve')}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loading || r.status === 'rejected'}
                      onClick={() => doAction(r.id, 'reject')}
                    >
                      Block
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
