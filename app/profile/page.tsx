'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/core/supabase';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function ProfilePage() {
  type AuthUser = {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown>;
  } | null;
  type Profile = { nickname?: string | null; display_name?: string | null } | null;

  function getStringField(obj: unknown, key: string): string | null {
    if (!obj || typeof obj !== 'object') return null;
    const rec = obj as Record<string, unknown>;
    const v = rec[key];
    return typeof v === 'string' ? v : null;
  }

  function getErrorMessage(err: unknown): string {
    if (!err) return 'Unknown error';
    if (typeof err === 'string') return err;
    if (err instanceof Error) return err.message;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }

  const [user, setUser] = useState<AuthUser>(null);
  const [nickname, setNickname] = useState('');
  const [editNickname, setEditNickname] = useState('');
  // removed unused dbDisplayName state
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [changing, setChanging] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwMessage, setPwMessage] = useState('');
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (!mounted) return;
      setUser(u);
      if (u) {
        let profile: Profile = null;
        try {
          const res = await supabase
            .from('profiles')
            .select('nickname, display_name')
            .eq('id', u.id)
            .single();
          profile = res.data as Profile;
        } catch (e) {
          // profiles table may not exist or be accessible; fallback to auth metadata
          profile = null;
        }

        const profileNick = getStringField(profile, 'nickname') || '';
        const profileDisplay = getStringField(profile, 'display_name') || '';
        const authDisplay = getStringField(u?.user_metadata, 'display_name') || '';

        // Determine what to show: prefer profile.nickname, then profile.display_name, then auth user metadata
        const current = profileNick || profileDisplay || authDisplay || '';
        setNickname(current);

        // Prefill input with nickname for convenience; fallback to profile.display_name or auth metadata
        setEditNickname(profileNick || profileDisplay || authDisplay || '');

        // Show DB display_name primarily from profiles table; if absent, show auth metadata as fallback
        // previously stored DB display name removed (unused)
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSave() {
    if (!user) return;
    setLoading(true);
    setMessage('');
    try {
      // Only save if changed
      if (editNickname.trim() === '') {
        setMessage('Nickname cannot be empty');
        setLoading(false);
        return;
      }

      if (editNickname.trim() === nickname.trim()) {
        setMessage('No changes to save');
        setLoading(false);
        return;
      }
      let metaError: unknown = null;
      try {
        const { error } = await supabase.auth.updateUser({
          data: { display_name: editNickname },
        });
        if (error) metaError = error;

        // Refresh auth user from client
        const { data: userData } = await supabase.auth.getUser();
        const authUser = userData.user as AuthUser;
        const authMetaValue = getStringField(authUser?.user_metadata, 'display_name') || null;

        let refreshedProfile: Profile = null;
        try {
          const { data } = await supabase
            .from('profiles')
            .select('nickname, display_name')
            .eq('id', user.id)
            .single();
          refreshedProfile = data as Profile;
        } catch (e: unknown) {
          refreshedProfile = null;
        }

        const tableNameValue =
          getStringField(refreshedProfile, 'display_name') ||
          getStringField(refreshedProfile, 'nickname') ||
          null;

        const finalName = tableNameValue || authMetaValue || editNickname;
        setNickname(finalName);
        setEditNickname(finalName);
        // dbDisplayName removed (unused)
        localStorage.setItem('nickname', finalName);

        if (metaError) {
          setMessage(`Saved to data; but update returned error: ${getErrorMessage(metaError)}`);
        } else if (tableNameValue && authMetaValue && tableNameValue === authMetaValue) {
          setMessage('Saved and verified');
        } else if (authMetaValue) {
          setMessage('Saved data');
        } else {
          setMessage('Saved');
        }
      } catch (err: unknown) {
        console.error('auth update error', err);
        setMessage(`Error saving profile: ${getErrorMessage(err)}`);
        return;
      }
    } catch (err) {
      console.error(err);
      setMessage('Error saving profile');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    localStorage.removeItem('nickname');
    router.push('/');
  }

  async function handleChangePassword() {
    setPwMessage('');
    if (!newPassword || newPassword.length < 6) {
      setPwMessage('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMessage('Passwords do not match');
      return;
    }
    setChanging(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        console.error('Password change failed', error);
        setPwMessage(error.message || 'Failed to change password');
      } else {
        setPwMessage('Password updated');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (e) {
      console.error(e);
      setPwMessage('Failed to change password');
    } finally {
      setChanging(false);
    }
  }

  if (!user) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push('/')}
            aria-label="Back to home"
            className="text-slate-600 hover:text-slate-800 flex items-center gap-2"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm">Back</span>
          </button>
          <h1 className="text-2xl font-semibold">Profile</h1>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
          <p className="text-slate-600">You are not signed in.</p>
          <div className="mt-4">
            <Button onClick={() => router.push('/')}>Go to Home</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/')}
          aria-label="Back to home"
          className="text-slate-600 hover:text-slate-800 flex items-center gap-2"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm">Back</span>
        </button>
        <h1 className="text-2xl font-semibold">Profile</h1>
      </div>

      <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
        <p className="text-sm text-slate-500">Email</p>
        <p className="mb-4 font-medium">{user.email}</p>

        <label htmlFor="edit-nickname" className="text-sm text-slate-500">
          Nickname
        </label>
        <p className="mb-1 font-medium">{nickname}</p>
        <div className="flex gap-3 mt-2">
          <input
            id="edit-nickname"
            value={editNickname}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditNickname(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSave();
              }
            }}
            className="flex-1 px-3 py-2 border rounded-xl"
            placeholder="Nickname"
          />
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </div>
        {message && (
          <p
            className={`text-sm mt-3 ${
              /error|cannot|failed/i.test(message) ? 'text-red-500' : 'text-slate-600'
            }`}
          >
            {message}
          </p>
        )}

        <div className="mt-6">
          <Button variant="ghost" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>

        <div className="mt-6 border-t pt-6">
          <h3 className="text-sm font-semibold mb-2">Change password</h3>
          <p className="text-sm text-slate-500 mb-3">
            Enter a new password to update your account password.
          </p>
          <div className="flex flex-col gap-2">
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="px-3 py-2 border rounded-xl"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="px-3 py-2 border rounded-xl"
            />
            <div className="flex items-center gap-3">
              <Button onClick={handleChangePassword} disabled={changing}>
                {changing ? 'Updating...' : 'Update password'}
              </Button>
            </div>
            {pwMessage && <div className="text-sm text-slate-600 mt-2">{pwMessage}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
