'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

type AccessSettings = {
  auto_approve_new_users: boolean;
  is_beta_mode: boolean;
  max_approved_users: number | null;
  allowed_domains: string[] | null;
  blocked_domains: string[] | null;
  notify_on_new_pending: boolean;
  notify_on_approve: boolean;
  notify_on_block: boolean;
};

export default function AdminSettingsPage() {
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AccessSettings | null>(null);
  const [allowedInput, setAllowedInput] = useState('');
  const [blockedInput, setBlockedInput] = useState('');

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

  async function loadSettings() {
    if (!secret) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/access-settings', {
        headers: { 'x-admin-secret': secret },
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Failed to load settings');
      const data = payload?.data as AccessSettings;
      setSettings(data);
      setAllowedInput((data.allowed_domains || []).join('\n'));
      setBlockedInput((data.blocked_domains || []).join('\n'));
    } catch (e) {
      setError((e as Error).message || 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    if (!secret || !settings) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        ...settings,
        allowed_domains: allowedInput
          .split(/\r?\n/)
          .map((d) => d.trim().toLowerCase())
          .filter(Boolean),
        blocked_domains: blockedInput
          .split(/\r?\n/)
          .map((d) => d.trim().toLowerCase())
          .filter(Boolean),
      };
      const res = await fetch('/api/admin/access-settings', {
        method: 'POST',
        headers: {
          'x-admin-secret': secret,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Failed to save settings');
      const data = payload?.data as AccessSettings;
      setSettings(data);
      setAllowedInput((data.allowed_domains || []).join('\n'));
      setBlockedInput((data.blocked_domains || []).join('\n'));
    } catch (e) {
      setError((e as Error).message || 'Error');
    } finally {
      setSaving(false);
    }
  }

  const autoApprove = settings?.auto_approve_new_users ?? false;
  const betaMode = settings?.is_beta_mode ?? false;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Settings</h1>
          <p className="text-sm text-slate-600 mt-1">
            Access rules and notifications for the marketing AI tool.
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
            <Button size="sm" onClick={loadSettings} disabled={!secret || loading}>
              {loading ? 'Loading...' : 'Load'}
            </Button>
          </div>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </div>
      </div>

      {settings && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Access defaults</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">Auto-approve new users</p>
                <p className="text-xs text-slate-500">
                  If enabled, new users will be granted approved status automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setSettings((prev) =>
                    prev ? { ...prev, auto_approve_new_users: !prev.auto_approve_new_users } : prev
                  )
                }
                className={[
                  'relative inline-flex h-6 w-11 items-center rounded-full border transition-colors',
                  autoApprove ? 'bg-blue-600 border-blue-600' : 'bg-slate-200 border-slate-200',
                ].join(' ')}
              >
                <span
                  className={[
                    'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                    autoApprove ? 'translate-x-5' : 'translate-x-1',
                  ].join(' ')}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">Beta mode (manual approval)</p>
                <p className="text-xs text-slate-500">
                  If enabled, all new users go to pending, even when auto-approve is on.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setSettings((prev) =>
                    prev ? { ...prev, is_beta_mode: !prev.is_beta_mode } : prev
                  )
                }
                className={[
                  'relative inline-flex h-6 w-11 items-center rounded-full border transition-colors',
                  betaMode ? 'bg-blue-600 border-blue-600' : 'bg-slate-200 border-slate-200',
                ].join(' ')}
              >
                <span
                  className={[
                    'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                    betaMode ? 'translate-x-5' : 'translate-x-1',
                  ].join(' ')}
                />
              </button>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900 mb-1">Allowed email domains</p>
                <p className="text-xs text-slate-500 mb-2">
                  One domain per line (e.g. <code>company.com</code>). Leave empty to allow all.
                </p>
                <Textarea
                  rows={5}
                  value={allowedInput}
                  onChange={(e) => setAllowedInput(e.target.value)}
                  placeholder={'company.com\npartner.io'}
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900 mb-1">Blocked email domains</p>
                <p className="text-xs text-slate-500 mb-2">
                  One domain per line. These domains will always be blocked.
                </p>
                <Textarea
                  rows={5}
                  value={blockedInput}
                  onChange={(e) => setBlockedInput(e.target.value)}
                  placeholder={'spam.com\nthrowaway.mail'}
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={settings.notify_on_new_pending}
                  onChange={(e) =>
                    setSettings((prev) =>
                      prev ? { ...prev, notify_on_new_pending: e.target.checked } : prev
                    )
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
                Notify admins on new pending user
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={settings.notify_on_approve}
                  onChange={(e) =>
                    setSettings((prev) =>
                      prev ? { ...prev, notify_on_approve: e.target.checked } : prev
                    )
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
                Notify user on approval
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={settings.notify_on_block}
                  onChange={(e) =>
                    setSettings((prev) =>
                      prev ? { ...prev, notify_on_block: e.target.checked } : prev
                    )
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
                Notify user on block / deny
              </label>
            </div>
          </section>

          <div className="flex justify-end">
            <Button onClick={saveSettings} disabled={!secret || saving}>
              {saving ? 'Saving...' : 'Save settings'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
