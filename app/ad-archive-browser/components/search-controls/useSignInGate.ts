'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/core/supabase';

type AsyncAction = () => void | Promise<void>;

export function useSignInGate() {
  const [showLogin, setShowLogin] = useState(false);
  const [showSignInTip, setShowSignInTip] = useState(false);
  const tipTimeoutRef = useRef<number | null>(null);

  const clearTipTimeout = useCallback(() => {
    if (tipTimeoutRef.current) {
      window.clearTimeout(tipTimeoutRef.current);
      tipTimeoutRef.current = null;
    }
  }, []);

  const revealTip = useCallback(() => {
    setShowSignInTip(true);
    clearTipTimeout();
    tipTimeoutRef.current = window.setTimeout(
      () => setShowSignInTip(false),
      2500
    ) as unknown as number;
  }, [clearTipTimeout]);

  useEffect(() => {
    return () => {
      clearTipTimeout();
    };
  }, [clearTipTimeout]);

  const requireLoginAndRun = useCallback(
    async (action?: AsyncAction) => {
      try {
        const { data } = await supabase.auth.getSession();
        const sessionUser = data.session?.user;
        if (!sessionUser) {
          setShowLogin(true);
          revealTip();
          return;
        }
      } catch (error) {
        console.debug('Session fetch failed', error);
        setShowLogin(true);
        revealTip();
        return;
      }

      await action?.();
    },
    [revealTip]
  );

  const closeLogin = useCallback(() => setShowLogin(false), []);

  return {
    requireLoginAndRun,
    showLogin,
    closeLogin,
    showSignInTip,
  };
}
