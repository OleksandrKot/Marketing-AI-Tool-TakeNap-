"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

type Props = {
  onAuth?: (user: any) => void;
  defaultTab?: "login" | "register";
  tab?: "login" | "register"; // optional controlled tab
  onTabChange?: (t: "login" | "register") => void; // optional tab change handler
  hideTabs?: boolean; // allow parent to render tabs externally
  noWrapper?: boolean; // render only form without outer card wrapper
};

export default function AuthForm({ onAuth, defaultTab = "login", tab: controlledTab, onTabChange, hideTabs, noWrapper }: Props) {
  const [tab, setTabState] = useState<"login" | "register">(controlledTab ?? defaultTab);
  const setTab = (t: "login" | "register") => {
    if (onTabChange) onTabChange(t);
    if (controlledTab === undefined) setTabState(t);
  };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const emailRef = useRef<HTMLInputElement | null>(null);
  const [emailExists, setEmailExists] = useState<boolean | null>(null)
  const [checkingEmail, setCheckingEmail] = useState(false)
  const [checkError, setCheckError] = useState<string | null>(null)
  const debounceRef = useRef<number | null>(null)

  // keep internal tab in sync when controlled
  useEffect(() => {
    if (controlledTab) setTabState(controlledTab);
  }, [controlledTab]);

  useEffect(() => {
    if (tab === "login") setNickname("");
  }, [tab]);

  useEffect(() => {
    // focus email when mounted
    emailRef.current?.focus();
  }, []);

  // Debounced inline email existence check (only for register tab)
  useEffect(() => {
    // clear previous debounce
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    setEmailExists(null)
    setCheckError(null)

    if (tab !== 'register') return
    const val = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
    if (!val) return

    setCheckingEmail(true)
    // debounce 500ms
    debounceRef.current = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check?email=${encodeURIComponent(val)}`)
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}))
          setCheckError(payload?.error || `Check failed (${res.status})`)
          setEmailExists(null)
        } else {
          const payload = await res.json()
          setEmailExists(!!payload?.exists)
        }
      } catch (e: any) {
        setCheckError(String(e?.message || e))
        setEmailExists(null)
      } finally {
        setCheckingEmail(false)
      }
    }, 500)

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [email, tab])

  function validate() {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please provide a valid email address");
      return false;
    }
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters");
      return false;
    }
    if (tab === "register" && !nickname) {
      setError("Please provide a nickname");
      return false;
    }
    return true;
  }

  const [resetSending, setResetSending] = useState(false)
  const [resetMessage, setResetMessage] = useState<string | null>(null)

  async function handleSendReset() {
    setResetMessage(null)
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setResetMessage('Please enter a valid email to reset password')
      return
    }
    setResetSending(true)
    try {
      // Redirect to an in-app reset handler that will complete the recovery flow
      const resetUrl = `${window.location.origin}/auth/reset`
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: resetUrl })
      if (error) {
        setResetMessage(error.message || 'Failed to send reset email')
      } else {
        setResetMessage('Password reset email sent — check your inbox')
      }
    } catch (e: any) {
      console.error('reset password failed', e)
      setResetMessage('Failed to send reset email')
    } finally {
      setResetSending(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (!validate()) return;

      if (tab === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        setSuccess("Logged in");
        const user = data.user;
        let profile: any = null;
        // First prefer display_name from auth user metadata
        const authDisplay = (user as any)?.user_metadata?.display_name || null;
        let display: string | null = authDisplay;

        // If no display in auth metadata, try to load from profiles table
        if (!display && user) {
          try {
            const { data: profileData, error: profileError } = await supabase
              .from("profiles")
              .select("nickname, display_name")
              .eq("id", user.id)
              .single();
            if (profileError) {
              // Table might not exist or network failed — don't block login
              console.warn("Could not load profile:", profileError.message || profileError);
            } else {
              profile = profileData;
              display = profile.display_name || profile.nickname || display;
            }
          } catch (fetchErr: any) {
            console.warn("Profile fetch failed:", fetchErr?.message || fetchErr);
          }
        }

        // If profile has display_name but auth metadata doesn't, try to sync auth metadata (non-blocking)
        try {
          if (profile?.display_name && authDisplay !== profile.display_name) {
            try {
              await supabase.auth.updateUser({ data: { display_name: profile.display_name } });
            } catch (e) {
              console.warn('Failed to sync auth metadata display_name:', e);
            }
          }
        } catch (e) {
          // ignore
        }

        const resultUser: any = { ...user };
        if (display) {
          // Provide unified fields for consumers
          resultUser.display_name = display;
          resultUser.nickname = display;
          localStorage.setItem("nickname", display);
        }
        if (onAuth) onAuth(resultUser);
      } else {
        // Check if the email is already registered via the admin users endpoint.
        // This endpoint uses the service-role key on the server to list users.
        try {
          const res = await fetch(`/api/auth/check?email=${encodeURIComponent(email)}`)
          if (res.ok) {
            const payload = await res.json()
            const exists = !!payload?.exists
            if (exists) {
              setError('An account with this email already exists. Please sign in or reset your password.')
              setLoading(false)
              return
            }
          }
        } catch (e) {
          // If the check endpoint is unreachable, fall back to attempting sign-up and let Supabase return the error.
          console.warn('Could not check existing users before sign-up:', e)
        }

        const { data, error } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: {
            data: {
              display_name: nickname,
            },
          },
        });

        // If Supabase returned an error (e.g., user already exists), show it and keep modal open
        if (error) {
          const msg = error?.message || String(error)
          // Friendly message for already-registered case
          if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("exists")) {
            setError("An account with this email already exists. Please sign in or reset your password.")
          } else {
            setError(msg)
          }
          setLoading(false)
          return
        }

        // No error: show the registration started message. Do not call onAuth unless a session was created
        setSuccess("Registration started — please check your email to confirm");
        const user = data.user;
        const signupAuthDisplay = (user as any)?.user_metadata?.display_name || nickname || null;
        if (user && signupAuthDisplay) {
          try {
            const { error: upsertError } = await supabase.from("profiles").upsert({ id: user.id, nickname: signupAuthDisplay, display_name: signupAuthDisplay });
            if (upsertError) console.warn("Could not save nickname to profiles table:", upsertError.message || upsertError);
            else localStorage.setItem("nickname", signupAuthDisplay);
            try {
              await supabase.auth.updateUser({ data: { display_name: signupAuthDisplay } });
            } catch (metaErr) {
              console.warn('Could not update auth user metadata display_name:', metaErr);
            }
          } catch (upsertErr: any) {
            console.warn("Profiles upsert failed:", upsertErr?.message || upsertErr);
          }
        }

        // If signUp created a session (immediate login), call onAuth. Otherwise keep modal open so user can see instructions.
        const hasSession = (data as any)?.session != null
        if (hasSession && onAuth) {
          const resultUserSignup: any = { ...(data.user || {}) }
          if (signupAuthDisplay) {
            resultUserSignup.display_name = signupAuthDisplay;
            resultUserSignup.nickname = signupAuthDisplay;
          }
          onAuth(resultUserSignup)
        }
      }
    } catch (err: any) {
      const msg = err?.message || String(err) || "Something went wrong"
      // Improve network error message for clarity
      if (msg.toLowerCase().includes("failed to fetch") || msg.toLowerCase().includes("networkerror") || msg.toLowerCase().includes("internet")) {
        setError("Network error: please check your internet connection and try again.")
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false);
    }
  }

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="sr-only" htmlFor="auth-email">Email</label>
      <input
        id="auth-email"
        ref={emailRef}
        type="email"
        required
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {/* Inline email existence feedback for register */}
      {tab === 'register' && (
        <div className="mt-2 text-sm">
          {checkingEmail && <div className="text-slate-500">Checking email...</div>}
          {checkError && <div className="text-yellow-700">Could not verify email: {checkError}</div>}
          {emailExists === true && (
            <div className="text-red-600">
              An account with this email already exists.{' '}
              <button type="button" className="text-blue-600 underline ml-1" onClick={() => setTab('login')}>Sign in</button>
            </div>
          )}
          {emailExists === false && <div className="text-green-600">Email is available</div>}
        </div>
      )}

      <div className="relative">
        <label className="sr-only" htmlFor="auth-password">Password</label>
        <input
          id="auth-password"
          type={showPassword ? "text" : "password"}
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={() => setShowPassword((s) => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-slate-500"
          aria-pressed={showPassword}
        >
          {showPassword ? "Hide" : "Show"}
        </button>
      </div>

      {/* Forgot password (login tab) */}
      {tab === 'login' && (
        <div className="text-right text-sm mt-1">
          <button type="button" className="text-blue-600 hover:underline" onClick={handleSendReset} disabled={resetSending}>
            {resetSending ? 'Sending...' : 'Forgot password?'}
          </button>
          {resetMessage && <div className="text-sm text-slate-600 mt-1">{resetMessage}</div>}
        </div>
      )}

      {tab === "register" && (
        <>
          <label className="sr-only" htmlFor="auth-nickname">Nickname</label>
          <input
            id="auth-nickname"
            type="text"
            required
            placeholder="Nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </>
      )}

      <Button type="submit" className="w-full h-10" disabled={loading}>
        {loading ? "Please wait..." : tab === "login" ? "Login" : "Register"}
      </Button>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          className="text-blue-600 hover:underline"
          onClick={() => setTab(tab === "login" ? "register" : "login")}
        >
          {tab === "login" ? "Create account" : "Have an account? Sign in"}
        </button>
      </div>

      {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
      {success && <div className="text-green-600 text-sm mt-2">{success}</div>}
    </form>
  );

  if (noWrapper) return form;

  return (
    <div className="max-w-md mx-auto mt-6 bg-white rounded-2xl shadow-lg p-6 border border-slate-100">
      {!hideTabs && (
        <div className="flex mb-4" role="tablist" aria-label="Authentication tabs">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "login"}
            className={`flex-1 py-2 font-semibold rounded-l-xl ${tab === "login" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}
            onClick={() => setTab("login")}
          >
            Login
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "register"}
            className={`flex-1 py-2 font-semibold rounded-r-xl ${tab === "register" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}
            onClick={() => setTab("register")}
          >
            Register
          </button>
        </div>
      )}

      {form}
    </div>
  );
}
