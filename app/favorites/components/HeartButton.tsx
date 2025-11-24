'use client';

import React, { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import ModalLoading from '@/components/ui/modal-loading';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFavorites } from '@/lib/hooks/useFavorites';
import { supabase } from '@/lib/core/supabase';
const FavoritesModal = dynamic(() => import('./FavoritesModal').then((m) => m.default), {
  ssr: false,
  loading: () => <ModalLoading />,
});
const LoginModal = dynamic(() => import('@/app/login-auth/LoginModal'), {
  ssr: false,
  loading: () => null,
});

interface Props {
  creativeId: string;
}

export default function HeartButton({ creativeId }: Props) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const [showModal, setShowModal] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  // More robust auth check: prefer session (getSession), fallback to getUser
  const checkAuth = useCallback(async () => {
    try {
      const sessionRes = await supabase.auth.getSession();
      const sessionUser = sessionRes?.data?.session?.user;
      if (sessionUser) {
        setIsLoggedIn(true);
        return true;
      }

      // fallback to getUser
      const res = await supabase.auth.getUser();
      const user = res?.data?.user;
      setIsLoggedIn(!!user);
      return !!user;
    } catch (e) {
      setIsLoggedIn(false);
      return false;
    }
  }, []);

  // keep isLoggedIn in sync when component mounts (helps when user already signed in)
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const logged = await checkAuth();
        if (!mounted) return;
        setIsLoggedIn(logged);
      } catch (e) {
        if (!mounted) return;
        setIsLoggedIn(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [checkAuth]);

  // Subscribe to auth state changes for reactive updates (magic link, sign out, etc.)
  React.useEffect(() => {
    const res = supabase.auth.onAuthStateChange((event: string, session) => {
      try {
        const hasUser = !!session?.user;
        setIsLoggedIn(hasUser);
      } catch (e) {
        setIsLoggedIn(false);
      }
    });

    return () => {
      try {
        // supabase returns different shapes across versions. handle common shapes.
        const maybe = res as unknown;
        const possibleSub = (maybe as { data?: { subscription?: { unsubscribe?: () => void } } })
          ?.data?.subscription;
        if (possibleSub && typeof possibleSub.unsubscribe === 'function') {
          possibleSub.unsubscribe();
        } else {
          const maybeUnsub = (maybe as { unsubscribe?: () => void })?.unsubscribe;
          if (typeof maybeUnsub === 'function') maybeUnsub();
        }
      } catch (e) {
        // noop
      }
    };
  }, []);

  const onClick = useCallback(async () => {
    const logged = isLoggedIn === null ? await checkAuth() : !!isLoggedIn;
    if (!logged) {
      setShowLogin(true);
      return;
    }

    // logged-in users should see modal to pick folder/collection
    setShowModal(true);
  }, [isLoggedIn, checkAuth, toggleFavorite, creativeId]);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={onClick}
        className={`transition-colors ${
          isFavorite(creativeId)
            ? 'text-red-500 hover:text-red-600'
            : 'text-slate-400 hover:text-slate-600'
        }`}
        aria-label={isFavorite(creativeId) ? 'Remove from favorites' : 'Add to favorites'}
      >
        <Heart className={`h-5 w-5 ${isFavorite(creativeId) ? 'fill-current' : ''}`} />
      </Button>

      {/* auth badge removed — use global ProfileDropdown for profile controls */}

      {showModal && (
        <FavoritesModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          creativeId={creativeId}
        />
      )}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  );
}

export { HeartButton };
