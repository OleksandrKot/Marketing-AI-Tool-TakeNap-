'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '@/components/admin/AdminProvider';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/core/supabase';
import ModalWrapper from '@/components/modals/ModalWrapper';

const LoginModal = dynamic(() => import('@/app/login-auth/LoginModal'), {
  ssr: false,
  loading: () => null,
});

export default function AccessGate() {
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [adminStatus, setAdminStatus] = useState<string | null>(null);
  const [approvedStatus, setApprovedStatus] = useState<string | null>(null);
  const adminCtx = useAdmin();
  const doCheck = useCallback(async () => {
    let mounted = true;
    setChecking(true);
    setMessage(null);
    setAdminStatus(null);
    setApprovedStatus(null);
    try {
      const { data } = await supabase.auth.getSession();
      const sessionData = (data as unknown) || (await supabase.auth.getSession()).data;
      const user =
        (sessionData as Record<string, unknown> | undefined)?.user ??
        (await supabase.auth.getUser()).data?.user ??
        null;
      if (!user) {
        if (mounted) {
          setAllowed(false);
          setChecking(false);
        }
        return;
      }
      const userEmail = ((user as Record<string, unknown>)?.['email'] as string | undefined) || '';

      // If the user is signed in, allow access to the main app immediately.
      // We still fetch admin/approval info for display, but do not block rendering.
      if (mounted) {
        setAllowed(true);
        setChecking(false);
      }

      // Admin status is handled by the global AdminProvider; do not fetch here.

      try {
        const req = await fetch(
          `/api/access-requests/check?email=${encodeURIComponent(userEmail)}`
        );
        const rj = await req.json();
        if (req.ok) {
          if (mounted) setApprovedStatus(String(Boolean(rj?.approved)));
        }
      } catch (e) {
        if (mounted) setApprovedStatus('error');
      }
    } catch (e) {
      if (mounted) {
        setAllowed(false);
        setChecking(false);
      }
    }
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (adminCtx.loading) {
      setAdminStatus(null);
    } else if (adminCtx.isAdmin) {
      setAdminStatus('true');
    } else {
      setAdminStatus('false');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminCtx.isAdmin, adminCtx.loading]);

  useEffect(() => {
    doCheck();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      doCheck();
    });

    return () => {
      try {
        listener?.subscription?.unsubscribe?.();
      } catch (e) {
        // ignore
      }
    };
  }, [doCheck]);

  const handleRequestAccess = () => {
    // redirect to request-access page
    window.location.href = '/request-access';
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      window.location.reload();
    } catch (e) {
      // ignore
    }
  };

  // If allowed, render nothing so site is visible. Otherwise show modal overlay.
  const pathname = usePathname();

  // Do not block the request-access page itself so users can request access.
  if (pathname === '/request-access') return null;

  if (!checking && allowed) return null;

  const showModal = (checking || !allowed) && !showLogin;

  return (
    <>
      <ModalWrapper
        isOpen={showModal}
        // do not provide onClose to avoid accidentally closing the gate
        backdropClassName="fixed inset-0 z-[9999] flex items-center justify-center bg-white/95 backdrop-blur-md"
        panelClassName="bg-white rounded-2xl w-full max-w-xl p-6 relative z-[10001] pointer-events-auto"
      >
        {checking ? (
          <div className="flex flex-col items-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600 mb-4" />
            <div className="text-sm text-slate-600">Checking session and permissions…</div>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-semibold mb-3">Access required</h2>
            <p className="text-sm text-slate-600 mb-4">
              To continue you must be signed in and approved. If you already have an account, please
              sign in.
            </p>

            <div className="flex gap-3 mb-4">
              <button
                type="button"
                onClick={() => {
                  setMessage('Opening sign-in...');
                  setShowLogin(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded"
              >
                Sign in / Register
              </button>
              <button
                type="button"
                onClick={() => {
                  setMessage('Redirecting to access request page...');
                  handleRequestAccess();
                }}
                className="px-4 py-2 bg-slate-100 rounded"
              >
                Request access
              </button>
              <button
                type="button"
                onClick={async () => {
                  setMessage('Signing out...');
                  await handleSignOut();
                }}
                className="px-4 py-2 bg-red-600 text-white rounded"
              >
                Sign out
              </button>
            </div>
            {message ? <div className="text-sm text-red-600">{message}</div> : null}
            <div className="text-sm text-slate-500 mt-2">
              If you have requested access, it may take a moment to be approved.
            </div>
            {/* Show current admin/approval status for transparency */}
            <div className="text-xs text-slate-400 mt-3">
              <div>
                <strong>Admin:</strong>{' '}
                {adminStatus === null
                  ? 'Checking…'
                  : adminStatus === 'true'
                  ? 'Yes'
                  : adminStatus === 'false'
                  ? 'No'
                  : 'Error'}
              </div>
              <div>
                <strong>Approved:</strong>{' '}
                {approvedStatus === null
                  ? 'Checking…'
                  : approvedStatus === 'true'
                  ? 'Yes'
                  : approvedStatus === 'false'
                  ? 'No'
                  : 'Error'}
              </div>
            </div>
          </>
        )}
      </ModalWrapper>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  );
}
