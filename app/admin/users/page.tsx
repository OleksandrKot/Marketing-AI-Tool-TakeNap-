'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type AdminUser = {
  id: string;
  email: string;
  created_at: string;
  is_admin?: boolean;
  is_blocked?: boolean;
};

export default function AdminUsersPage() {
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const stored =
      typeof window !== 'undefined' ? window.sessionStorage.getItem('adminSecret') : null;
    if (stored) setSecret(stored);
  }, []);

  function handleSecretChange(v: string) {
    setSecret(v);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('adminSecret', v);
    }
  }

  async function load() {
    if (!secret) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'x-admin-secret': secret },
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Failed to load users');
      const rawUsers = (payload?.users || []) as Array<{
        id?: string;
        email?: string;
        created_at?: string;
      }>;
      const mapped: AdminUser[] = rawUsers.map((u) => ({
        id: u.id || '',
        email: u.email || '',
        created_at: u.created_at || '',
      }));
      setUsers(mapped);
    } catch (e) {
      setError((e as Error).message || 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function post(url: string, body?: unknown) {
    if (!secret) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'x-admin-secret': secret,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Request failed');
      await load();
    } catch (e) {
      setError((e as Error).message || 'Error');
    } finally {
      setLoading(false);
    }
  }

  const filtered = users.filter((u) =>
    search.trim() ? u.email.toLowerCase().includes(search.trim().toLowerCase()) : true
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Users</h1>
          <p className="text-sm text-slate-600 mt-1">
            Overview of all auth users, with admin and block flags.
          </p>
        </div>
        <div className="flex flex-col items-stretch md:items-end gap-2">
          <div className="flex items-center gap-2">
            <Input
              type="password"
              value={secret}
              onChange={(e) => handleSecretChange(e.target.value)}
              placeholder="Admin secret"
              className="w-48"
            />
            <Button onClick={load} disabled={!secret || loading} size="sm">
              {loading ? 'Loading...' : 'Load'}
            </Button>
          </div>
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
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="grid grid-cols-[2fr,1.5fr,1fr,auto] gap-3 px-4 py-2 text-xs font-semibold text-slate-500 border-b border-slate-200">
          <div>Email</div>
          <div>Created at</div>
          <div>Status</div>
          <div className="text-right">Actions</div>
        </div>
        {filtered.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">No users loaded.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((u) => (
              <div
                key={u.id}
                className="grid grid-cols-[2fr,1.5fr,1fr,auto] gap-3 px-4 py-3 text-sm items-center"
              >
                <div className="font-medium text-slate-900 truncate">{u.email}</div>
                <div className="text-xs text-slate-600">
                  {u.created_at ? format(new Date(u.created_at), 'yyyy-MM-dd HH:mm') : '—'}
                </div>
                <div className="flex items-center gap-1">
                  {u.is_admin ? (
                    <Badge variant="default">admin</Badge>
                  ) : (
                    <Badge variant="outline">user</Badge>
                  )}
                  {u.is_blocked ? (
                    <Badge variant="outline" className="border-red-500 text-red-600">
                      blocked
                    </Badge>
                  ) : null}
                </div>
                <div className="flex justify-end gap-2">
                  {u.is_admin ? (
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={loading}
                      onClick={() => post('/api/admins/remove-by-email', { email: u.email })}
                    >
                      Remove admin
                    </Button>
                  ) : (
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={loading}
                      onClick={() => post('/api/admins/add', { email: u.email })}
                    >
                      Make admin
                    </Button>
                  )}
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={loading}
                    onClick={() => post(`/api/admins/user/${encodeURIComponent(u.id)}/block`)}
                  >
                    Block
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={loading}
                    onClick={() => post(`/api/admins/user/${encodeURIComponent(u.id)}/delete`)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
