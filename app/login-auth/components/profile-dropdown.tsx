'use client';

import { useState, useEffect } from 'react';
import { User, LogOut, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import dynamic from 'next/dynamic';
const LoginModal = dynamic(() => import('@/app/login-auth/LoginModal'), {
  ssr: false,
  loading: () => null,
});
import { supabase } from '@/lib/core/supabase';

export function ProfileDropdown() {
  const [user, setUser] = useState<{ email: string; nickname?: string } | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [nickname, setNickname] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  async function resolveIsAdminByEmail(email: string | null | undefined): Promise<boolean> {
    if (!email) return false;
    try {
      const check = await fetch(
        `/api/admins/check?email=${encodeURIComponent(email.toLowerCase())}`
      );
      const p = await check.json();
      if (check.ok && p?.is_admin) return true;
    } catch {
      // ignore
    }
    return false;
  }

  function getDisplayNameFromUser(u: unknown): string | undefined {
    if (!u || typeof u !== 'object') return undefined;
    const meta = (u as Record<string, unknown>)['user_metadata'];
    if (!meta || typeof meta !== 'object') return undefined;
    const m = meta as Record<string, unknown>;
    if (typeof m.display_name === 'string') return m.display_name;
    if (typeof m.nickname === 'string') return m.nickname;
    return undefined;
  }

  // On mount, try to load current user from Supabase
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const u = data?.user;
        if (mounted && u) {
          // Prefer display name from auth user metadata
          const metaName = getDisplayNameFromUser(u) || undefined;
          if (metaName) {
            setUser({ email: u.email || '', nickname: metaName });
            setNickname(metaName);
            localStorage.setItem('nickname', metaName);
            // Check admin status for this user by email (user_admins.email)
            const admin = await resolveIsAdminByEmail(u.email || '');
            if (admin) setIsAdmin(true);
          } else {
            // Fallback to cached nickname if available
            const cached = localStorage.getItem('nickname');
            if (cached) {
              setUser({ email: u.email || '', nickname: cached });
              setNickname(cached);
            } else {
              // Try to read from profiles table as a last resort
              try {
                const { data: profileData } = await supabase
                  .from('profiles')
                  .select('nickname')
                  .eq('id', u.id)
                  .single();
                if (profileData?.nickname) {
                  setUser({ email: u.email || '', nickname: profileData.nickname });
                  setNickname(profileData.nickname);
                  localStorage.setItem('nickname', profileData.nickname);
                  const admin = await resolveIsAdminByEmail(u.email || '');
                  if (admin) setIsAdmin(true);
                } else {
                  setUser({ email: u.email || '', nickname: undefined });
                }
              } catch (e) {
                setUser({ email: u.email || '', nickname: undefined });
              }
            }
          }
        }
      } catch (e) {
        // ignore
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, []);

  const handleLogout = async () => {
    setUser(null);
    setNickname('');
    localStorage.removeItem('nickname');
    // Sign out on Supabase as well
    try {
      await supabase.auth.signOut();
    } catch (e) {}
  };

  const router = useRouter();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl h-11 transition-all duration-200 hover:shadow-md hover:shadow-blue-500/25 w-full lg:w-auto">
            <User className="h-4 w-4 mr-2" />
            {nickname ? nickname : 'My Profile'}
            {isAdmin ? (
              <Badge variant="destructive" className="ml-2">
                ADMIN
              </Badge>
            ) : null}
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="bg-white border-slate-200 text-slate-800 rounded-xl shadow-lg w-64"
          align="start"
        >
          {user ? (
            <>
              <div className="px-3 py-2">
                <p className="text-sm text-slate-500 font-medium">Signed in as</p>
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {nickname ? nickname : user.email}
                </p>
              </div>
              <DropdownMenuSeparator className="bg-slate-200" />
              {isAdmin && (
                <DropdownMenuItem
                  onClick={() => router.push('/admin')}
                  className="hover:bg-slate-100 cursor-pointer text-blue-600 font-medium"
                >
                  Admin panel
                  <Badge variant="destructive" className="ml-2">
                    ADMIN
                  </Badge>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={handleLogout}
                className="hover:bg-red-50 text-red-600 hover:text-red-700 cursor-pointer"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </DropdownMenuItem>

              {/* Main menu items */}
              <DropdownMenuItem
                onClick={() => router.push('/profile')}
                className="hover:bg-slate-100 cursor-pointer"
              >
                My Profile
              </DropdownMenuItem>

              {/* WIP items placed below Logout as requested (navigate to WIP stub pages; show tooltip) */}
              <DropdownMenuSeparator className="bg-slate-200 mt-1" />
              <DropdownMenuItem
                onClick={() => router.push('/wip/my-adaptations')}
                title="Coming soon"
                className="hover:bg-slate-100 cursor-pointer text-slate-700"
              >
                My Adaptations{' '}
                <span className="ml-2 text-xs font-medium bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                  WIP
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push('/personas-settings')}
                title="Coming soon"
                className="hover:bg-slate-100 cursor-pointer text-slate-700"
              >
                Personas settings
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem
                onClick={() => setShowLogin(true)}
                className="hover:bg-blue-50 text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                Sign In
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setShowLogin(true)}
                className="hover:bg-blue-50 text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                Register
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onAuth={async (userData: unknown) => {
            // Be defensive about the shape of userData. Supabase/auth flows may return
            // { user } or a flat user object. Normalize accordingly.
            try {
              let email = '';
              let nicknameFromData: string | undefined = undefined;
              let userId: string | undefined = undefined;

              if (!userData) {
                // nothing to do
              } else if (typeof userData === 'object' && userData !== null && 'user' in userData) {
                const ud = userData as Record<string, unknown>;
                const innerUser = ud['user'] as Record<string, unknown> | undefined;
                email =
                  (innerUser && typeof innerUser['email'] === 'string'
                    ? (innerUser['email'] as string)
                    : '') || (typeof ud['email'] === 'string' ? (ud['email'] as string) : '');
                userId = innerUser
                  ? String(innerUser['id'] || innerUser['sub'] || '')
                  : typeof ud['id'] === 'string'
                  ? (ud['id'] as string)
                  : undefined;
                nicknameFromData =
                  (typeof ud['nickname'] === 'string' ? (ud['nickname'] as string) : undefined) ||
                  getDisplayNameFromUser(innerUser) ||
                  undefined;
              } else if (typeof userData === 'object' && userData !== null) {
                const ud = userData as Record<string, unknown>;
                email = typeof ud['email'] === 'string' ? (ud['email'] as string) : '';
                userId = typeof ud['id'] === 'string' ? (ud['id'] as string) : undefined;
                nicknameFromData =
                  typeof ud['nickname'] === 'string' ? (ud['nickname'] as string) : undefined;
              }

              // Prefer nickname from the auth response, then localStorage, then DB lookup
              if (nicknameFromData) {
                setNickname(nicknameFromData);
                localStorage.setItem('nickname', nicknameFromData);
              } else {
                const cached = localStorage.getItem('nickname');
                if (cached) {
                  setNickname(cached);
                } else if (userId) {
                  try {
                    const profileResp = await supabase
                      .from('profiles')
                      .select('nickname')
                      .eq('id', userId)
                      .single();
                    const profileData = (
                      profileResp as unknown as { data?: { nickname?: string | null } | null }
                    ).data;
                    if (profileData && profileData.nickname) {
                      setNickname(profileData.nickname);
                      localStorage.setItem('nickname', profileData.nickname);
                      nicknameFromData = profileData.nickname;
                    }
                  } catch (e) {
                    // ignore
                  }
                }
              }

              setUser({
                email,
                nickname: nicknameFromData || localStorage.getItem('nickname') || undefined,
              });

              // After successful auth, resolve admin flag from user_admins.email
              const admin = await resolveIsAdminByEmail(email);
              setIsAdmin(admin);
            } finally {
              setShowLogin(false);
            }
          }}
        />
      )}
    </>
  );
}
