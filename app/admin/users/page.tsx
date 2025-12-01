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
  not_registered?: boolean;
};

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admins/users');
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Failed to load users');
      const raw = (payload?.data || []) as Array<{
        id?: string;
        email?: string | null;
        created_at?: string | null;
        is_admin?: boolean;
        is_blocked?: boolean;
        not_registered?: boolean;
      }>;
      const mapped: AdminUser[] = raw.map((u) => ({
        id: u.id || '',
        email: u.email || '',
        created_at: u.created_at || '',
        is_admin: !!u.is_admin,
        is_blocked: !!u.is_blocked,
        not_registered: !!u.not_registered,
      }));
      setUsers(mapped);
    } catch (e) {
      setError((e as Error).message || 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function post(url: string, body?: unknown) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
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
                    <Badge variant="destructive">admin</Badge>
                  ) : (
                    <Badge variant="outline">user</Badge>
                  )}
                  {u.is_blocked ? (
                    <Badge variant="outline" className="border-red-500 text-red-600">
                      blocked
                    </Badge>
                  ) : null}
                  {u.not_registered ? (
                    <Badge variant="outline" className="border-yellow-400 text-yellow-700">
                      not registered
                    </Badge>
                  ) : null}
                </div>
                <div className="flex justify-end gap-2">
                  {u.is_admin ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loading}
                      onClick={() => post('/api/admins/remove-by-email', { email: u.email })}
                    >
                      Remove admin
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loading}
                      onClick={() => post('/api/admins/add', { email: u.email })}
                    >
                      Make admin
                    </Button>
                  )}

                  {/* Block */}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={loading}
                    onClick={() =>
                      u.id
                        ? post(`/api/admins/user/${encodeURIComponent(u.id)}/block`)
                        : post('/api/admins/block-by-email', { email: u.email })
                    }
                  >
                    Block
                  </Button>

                  {/* Delete */}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={loading}
                    onClick={() =>
                      u.id
                        ? post(`/api/admins/user/${encodeURIComponent(u.id)}/delete`)
                        : post('/api/admins/delete-by-email', { email: u.email })
                    }
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
