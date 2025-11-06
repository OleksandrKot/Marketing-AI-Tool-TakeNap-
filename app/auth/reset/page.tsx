'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'done' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // When the user arrives from the Supabase recovery link, the URL contains
    // tokens either in the query or the hash. Call getSessionFromUrl to
    // parse tokens and set session in the client SDK.
    (async () => {
      try {
        // Some supabase-js versions expose getSessionFromUrl, but others don't.
        // For compatibility we'll manually parse tokens from the URL (hash or
        // query) and call setSession on the client. Supabase recovery links
        // typically include access_token and refresh_token in the URL fragment.

        function parseTokenString(str: string) {
          const params = new URLSearchParams(str.replace(/^#?\/?\?/, ''));
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');
          const type = params.get('type');
          return { access_token, refresh_token, type };
        }

        // Try fragment first (hash), then search
        const hash = window.location.hash ? window.location.hash.replace(/^#/, '') : '';
        const query = window.location.search ? window.location.search.replace(/^\?/, '') : '';
        const fromHash = hash
          ? parseTokenString(hash)
          : { access_token: null, refresh_token: null, type: null };
        const fromQuery = query
          ? parseTokenString(query)
          : { access_token: null, refresh_token: null, type: null };

        const tokens = fromHash.access_token ? fromHash : fromQuery;

        if (!tokens.access_token) {
          setError(
            'No recovery token found in the URL. Make sure you clicked the reset link from your email.'
          );
          setStatus('error');
          return;
        }

        // Set the session in the client so subsequent calls (updateUser) work.
        // Different supabase-js versions expose different auth helpers. Safely
        // detect and call setSession if available without using `any`.
        const authClient = supabase.auth as unknown as {
          setSession?: (s: {
            access_token?: string | null;
            refresh_token?: string | null;
          }) => Promise<unknown>;
        };

        if (typeof authClient.setSession === 'function') {
          const setResult: unknown = await authClient.setSession({
            access_token: tokens.access_token ?? null,
            refresh_token: tokens.refresh_token ?? null,
          });

          // setSession may return different shapes; inspect safely for an error
          const setErr = (() => {
            if (!setResult || typeof setResult !== 'object') return undefined;
            const r = setResult as Record<string, unknown>;
            if (r.error) return r.error;
            if (r.data && typeof r.data === 'object') {
              const d = r.data as Record<string, unknown>;
              return d.error;
            }
            return undefined;
          })();

          if (setErr) {
            // prefer structured logging but don't block the flow — user can still
            // submit a new password server-side if needed
            console.warn('setSession error:', setErr);
          }
        }

        // Clean the URL to remove tokens
        try {
          const url = new URL(window.location.href);
          url.hash = '';
          url.search = '';
          window.history.replaceState({}, document.title, url.toString());
        } catch (e) {
          // ignore
        }

        // If setSession succeeded, the user is authenticated and can set a new password
        setStatus('ready');
      } catch (error: unknown) {
        console.error('Failed to parse recovery link:', error);
        setError(getErrorMessage(error));
        setStatus('error');
      }
    })();
  }, []);

  function getErrorMessage(err: unknown): string {
    if (!err) return 'Unknown error';
    if (typeof err === 'string') return err;
    if (err instanceof Error) return err.message;
    if (typeof err === 'object' && err !== null) {
      const rec = err as Record<string, unknown>;
      if (typeof rec.message === 'string') return rec.message;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setSubmitting(true);
    try {
      // updateUser uses the current session (set by getSessionFromUrl) to set the password
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message || String(error));
      } else {
        setStatus('done');
      }
    } catch (error: unknown) {
      setError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow p-6 border border-slate-100">
        <h1 className="text-lg font-semibold mb-4">Reset your password</h1>

        {status === 'loading' && <div className="text-slate-600">Processing recovery link...</div>}

        {status === 'error' && (
          <div>
            <div className="text-red-600 mb-4">
              {error || 'An error occurred while processing the reset link.'}
            </div>
            <div className="text-sm text-slate-700">
              If the link looks old or invalid, request a new password reset from the login modal.
            </div>
            <div className="mt-4">
              <Link href="/" className="text-blue-600 underline">
                Return to home
              </Link>
            </div>
          </div>
        )}

        {status === 'ready' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-sm text-slate-600">
              Please enter a new password for your account.
            </div>
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-10 bg-blue-600 text-white rounded-xl"
            >
              {submitting ? 'Saving...' : 'Set new password'}
            </button>
          </form>
        )}

        {status === 'done' && (
          <div className="space-y-4">
            <div className="text-green-600">
              Your password has been updated. You are now signed in.
            </div>
            <div className="text-sm text-slate-700">You can now continue to the app.</div>
            <div className="mt-4">
              <Link href="/" className="text-blue-600 underline">
                Go to app
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
