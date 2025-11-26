'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/core/supabase';

export default function AuthContentGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function check() {
      // allow request-access page to render without gating
      if (pathname === '/request-access') {
        if (mounted) {
          setAllowed(true);
          setChecking(false);
        }
        return;
      }

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

        // If the user is signed in, allow rendering the app (user explicitly requested
        // to sign in). We still perform admin/approval checks for informational purposes
        // but do not block rendering based on them.
        if (mounted) {
          setAllowed(true);
          setChecking(false);
        }

        // perform checks in background to update any monitoring or UX (not blocking)
        (async () => {
          try {
            const uid = ((user as Record<string, unknown>)?.['id'] as string | undefined) || '';
            const email =
              ((user as Record<string, unknown>)?.['email'] as string | undefined) || '';
            try {
              const res = await fetch(`/api/admins/check?user_id=${encodeURIComponent(uid)}`);
              if (res.ok) {
                await res.json();
                // we don't setAllowed here; AuthContentGate already allowed the user
              }
            } catch (e) {
              // ignore
            }

            try {
              await fetch(`/api/access-requests/check?email=${encodeURIComponent(email)}`);
            } catch (e) {
              // ignore
            }
          } catch (e) {
            // ignore
          }
        })();
      } catch (e) {
        if (mounted) {
          setAllowed(false);
          setChecking(false);
        }
      }
    }

    check();
    // subscribe to auth state changes so we re-check when the user signs in/out
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      check();
    });

    return () => {
      mounted = false;
      try {
        listener?.subscription?.unsubscribe?.();
      } catch (e) {
        // ignore
      }
    };
  }, [pathname]);

  // While checking or not allowed, do not render children to avoid loading main UI.
  if (checking || !allowed) return null;

  return <>{children}</>;
}
