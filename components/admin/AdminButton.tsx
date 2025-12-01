'use client';
import { useState } from 'react';
import ModalWrapper from '@/components/modals/ModalWrapper';

type AccessRequest = {
  id: string;
  email: string;
  status: string;
  created_at: string;
};

type UserRow = {
  id: string;
  email: string;
  created_at: string;
  is_admin?: boolean;
  is_blocked?: boolean;
};

export default function AdminButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<Array<AccessRequest | UserRow> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string>('');

  async function loadRequests() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/access-requests');
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Failed to fetch');
      setRequests((payload && payload.data) || []);
    } catch (e) {
      setError((e as Error).message || 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function doAction(id: string, action: 'approve' | 'reject') {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/access-requests/${encodeURIComponent(id)}/${action}`, {
        method: 'POST',
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Action failed');
      // reload
      await loadRequests();
    } catch (e) {
      setError((e as Error).message || 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function makeAdmin(email: string) {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/admins/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Failed to make admin');
      setSuccess('Made admin: ' + (payload?.data?.email || email));
      await loadRequests();
    } catch (e) {
      const msg = (e as Error).message || 'Error';
      if (msg.includes('ON CONFLICT') || msg.includes('no unique or exclusion constraint')) {
        setError(
          'DB upsert failed: missing UNIQUE constraint on `user_admins.email`. Run the migration to add UNIQUE(email) or run the provided SQL script.'
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function removeAdminByEmail(email: string) {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/admins/remove-by-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Failed to remove admin');
      setSuccess('Removed admin: ' + email);
      await loadRequests();
    } catch (e) {
      const msg = (e as Error).message || 'Error';
      setError(msg.includes('ON CONFLICT') ? 'Database error: ' + msg : msg);
    } finally {
      setLoading(false);
    }
  }

  async function syncUsers() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/admins/sync', {
        method: 'POST',
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Sync failed');
      setSuccess(`Sync done: attempted=${payload.attempted}, updated=${payload.updated}`);
      await loadRequests();
    } catch (e) {
      setError((e as Error).message || 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function loadAllUsers() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/admins/users');
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Failed to fetch users');
      setRequests(payload.data || []);
    } catch (e) {
      setError((e as Error).message || 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function deleteUser(id: string) {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admins/user/${encodeURIComponent(id)}/delete`, {
        method: 'POST',
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Delete failed');
      setSuccess('Deleted user');
      await loadAllUsers();
    } catch (e) {
      setError((e as Error).message || 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function blockUser(id: string) {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admins/user/${encodeURIComponent(id)}/block`, {
        method: 'POST',
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Block failed');
      setSuccess('User blocked');
      await loadAllUsers();
    } catch (e) {
      setError((e as Error).message || 'Error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((s) => !s)}
        title="Admin"
        className="fixed top-4 right-4 z-50 bg-black text-white px-3 py-1 rounded-md text-sm"
      >
        Admin
      </button>

      <ModalWrapper isOpen={open} onClose={() => setOpen(false)} panelClassName="w-full max-w-2xl">
        <div className="bg-white rounded-lg p-6 w-full">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Access Requests (Admin)</h3>
            <div className="flex gap-2">
              <button onClick={() => setOpen(false)} className="text-sm text-slate-600">
                Close
              </button>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex gap-2">
              <button
                onClick={loadRequests}
                disabled={loading}
                className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
              >
                {loading ? 'Loading...' : 'Load Requests'}
              </button>
              <button
                onClick={loadAllUsers}
                disabled={loading}
                className="bg-teal-600 text-white px-3 py-1 rounded text-sm"
              >
                {loading ? 'Loading...' : 'Load Users'}
              </button>
              <button
                onClick={syncUsers}
                disabled={loading}
                className="bg-emerald-600 text-white px-3 py-1 rounded text-sm"
              >
                {loading ? 'Syncing...' : 'Sync users'}
              </button>
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="admin-email" className="text-sm">
              Email (make/remove admin)
            </label>
            <input
              id="admin-email"
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="user@example.com"
              className="ml-2 border px-2 py-1 rounded"
            />
            <button
              onClick={() => makeAdmin(adminEmail)}
              disabled={loading || !adminEmail}
              className="ml-2 bg-indigo-600 text-white px-3 py-1 rounded text-sm"
            >
              Make Admin
            </button>
            <button
              onClick={() => removeAdminByEmail(adminEmail)}
              disabled={loading || !adminEmail}
              className="ml-2 bg-slate-400 text-white px-3 py-1 rounded text-sm"
            >
              Remove Admin
            </button>
          </div>

          {error ? <div className="text-red-600 mb-2">{error}</div> : null}
          {success ? <div className="text-green-600 mb-2">{success}</div> : null}

          <div className="space-y-3 max-h-72 overflow-auto">
            {requests && requests.length > 0 ? (
              // If first item has a status property, treat as AccessRequest
              'status' in requests[0] ? (
                requests.map((r) => {
                  const req = r as AccessRequest;
                  return (
                    <div
                      key={req.id}
                      className="p-3 border rounded flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium">{req.email}</div>
                        <div className="text-sm text-slate-500">
                          {req.status} — {new Date(req.created_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => doAction(req.id, 'approve')}
                          className="px-3 py-1 bg-green-600 text-white rounded text-sm"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => doAction(req.id, 'reject')}
                          className="px-3 py-1 bg-red-600 text-white rounded text-sm"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => makeAdmin(req.email)}
                          className="px-3 py-1 bg-indigo-600 text-white rounded text-sm"
                        >
                          Make Admin
                        </button>
                        <button
                          onClick={() => removeAdminByEmail(req.email)}
                          className="px-3 py-1 bg-slate-400 text-white rounded text-sm"
                        >
                          Remove Admin
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                // Otherwise, treat as UserRow list
                <div className="mt-4">
                  <h4 className="text-sm font-semibold mb-2">Users</h4>
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {requests.map((u) => {
                      const user = u as UserRow;
                      return (
                        <div
                          key={user.id}
                          className="p-2 border rounded flex items-center justify-between"
                        >
                          <div>
                            <div className="font-medium">{user.email}</div>
                            <div className="text-sm text-slate-500">
                              {new Date(user.created_at).toLocaleString()}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => makeAdmin(user.email)}
                              className="px-2 py-1 bg-indigo-600 text-white rounded text-sm"
                            >
                              Make Admin
                            </button>
                            <button
                              onClick={() => removeAdminByEmail(user.email)}
                              className="px-2 py-1 bg-slate-400 text-white rounded text-sm"
                            >
                              Remove Admin
                            </button>
                            <button
                              onClick={() => blockUser(user.id)}
                              className="px-2 py-1 bg-yellow-600 text-white rounded text-sm"
                            >
                              Block
                            </button>
                            <button
                              onClick={() => deleteUser(user.id)}
                              className="px-2 py-1 bg-red-600 text-white rounded text-sm"
                            >
                              Delete
                            </button>
                            {user.is_admin ? (
                              <span className="ml-2 text-xs font-semibold bg-red-600 text-white px-2 py-0.5 rounded">
                                ADMIN
                              </span>
                            ) : null}
                            {user.is_blocked ? (
                              <span className="ml-2 text-xs font-semibold bg-gray-600 text-white px-2 py-0.5 rounded">
                                BLOCKED
                              </span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            ) : (
              <div className="text-sm text-slate-600">
                No requests loaded. You can create an admin by email above.
              </div>
            )}
          </div>
        </div>
      </ModalWrapper>
    </>
  );
}
