'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/core/supabase';

type AdminContextValue = {
  isAdmin: boolean | null;
  loading: boolean;
  email: string | null;
};

const AdminContext = createContext<AdminContextValue>({
  isAdmin: null,
  loading: true,
  email: null,
});

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchStatus() {
      try {
        if (!mounted) return;
        setLoading(true);
        const { data } = await supabase.auth.getUser();
        const user = (data as unknown as { user?: { id?: string; email?: string } })?.user ?? null;
        const userId = user?.id || '';
        const userEmail = user?.email || null;
        if (mounted) setEmail(userEmail);

        if (!userId && !userEmail) {
          if (mounted) {
            setIsAdmin(false);
            setLoading(false);
          }
          return;
        }

        // call server check with both params
        try {
          const url =
            '/api/admins/check?' +
            (userId ? 'user_id=' + encodeURIComponent(userId) : '') +
            (userEmail ? '&email=' + encodeURIComponent(String(userEmail).toLowerCase()) : '');
          const res = await fetch(url);
          const payload = await res.json();
          if (mounted) setIsAdmin(Boolean(payload?.is_admin));
        } catch (e) {
          if (mounted) setIsAdmin(false);
        }
      } catch (e) {
        if (mounted) setIsAdmin(false);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchStatus();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      // re-run check when auth state changes (login/logout)
      fetchStatus();
    });

    return () => {
      mounted = false;
      try {
        listener?.subscription?.unsubscribe?.();
      } catch (e) {}
    };
  }, []);

  return (
    <AdminContext.Provider value={{ isAdmin, loading, email }}>{children}</AdminContext.Provider>
  );
}

export function useAdmin() {
  return useContext(AdminContext);
}

export default AdminProvider;
