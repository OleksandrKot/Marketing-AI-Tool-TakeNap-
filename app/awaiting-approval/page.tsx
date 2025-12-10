'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/core/supabase';

export default function AwaitingApprovalPage() {
  const search = useSearchParams();
  const router = useRouter();
  const email = search.get('email') || '';
  const [checking, setChecking] = useState(true);
  const [approved, setApproved] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function check() {
      setChecking(true);
      try {
        // If an email query param exists, use it. Otherwise try to get signed-in user.
        let emailToCheck = email;
        if (!emailToCheck) {
          const { data } = await supabase.auth.getSession();
          const sessionData = (data as unknown) || (await supabase.auth.getSession()).data;
          const user =
            (sessionData as Record<string, unknown> | undefined)?.user ??
            (await supabase.auth.getUser()).data?.user ??
            null;
          const emailVal = (user && (user as Record<string, unknown>)['email']) as
            | string
            | undefined;
          emailToCheck = emailVal || '';
          setUserEmail(emailToCheck || null);
        } else {
          setUserEmail(email);
        }

        if (!emailToCheck) {
          setApproved(null);
          setChecking(false);
          return;
        }

        const res = await fetch(
          `/api/access-requests/check?email=${encodeURIComponent(emailToCheck)}`
        );
        const pj = await res.json();
        if (res.ok) {
          setApproved(Boolean(pj?.approved));
          // If approved, navigate to root so user can access site
          if (pj?.approved) {
            router.push('/');
            return;
          }
        } else {
          setApproved(false);
        }
      } catch (e) {
        setApproved(false);
      } finally {
        setChecking(false);
      }
    }
    check();
  }, [email, router]);

  const handleRequestAccess = async () => {
    try {
      const res = await fetch('/api/access-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setMessage(payload?.error || 'Failed to send request');
      } else {
        setMessage('Request submitted. Redirecting to status page...');
        router.push(`/awaiting-approval?email=${encodeURIComponent(email)}`);
      }
    } catch (e) {
      setMessage('Failed to send request');
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/');
    } catch (e) {
      // ignore
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-xl w-full bg-white rounded-2xl p-8 border border-slate-200 text-center">
        <h2 className="text-2xl font-semibold mb-3">Awaiting approval</h2>
        <p className="text-sm text-slate-600 mb-4">
          {checking
            ? 'Checking approval status…'
            : approved
            ? 'Your account has been approved — redirecting…'
            : `Your account (${
                userEmail || email || 'this email'
              }) is awaiting approval by an administrator.`}
        </p>

        {!checking && approved === false && (
          <>
            <div className="flex gap-3 justify-center mb-4">
              <button
                type="button"
                onClick={() => handleRequestAccess()}
                className="px-4 py-2 bg-blue-600 text-white rounded"
              >
                Request access
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleSignOut();
                }}
                className="px-4 py-2 bg-red-600 text-white rounded"
              >
                Sign out
              </button>
            </div>
            <p className="text-xs text-slate-500">
              If you already requested access, approval may take a moment.
            </p>
          </>
        )}

        {!checking && approved === null && <div className="text-sm text-slate-500">{message}</div>}
      </div>
    </div>
  );
}
