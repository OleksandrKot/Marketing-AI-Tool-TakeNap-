"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export default function AuthForm({ onAuth }: { onAuth?: (user: any) => void }) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState("");
  const emailRef = useRef<HTMLInputElement | null>(null);
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    if (tab === "login") setNickname("");
  }, [tab]);

  // Autofocus email input on mount to help keyboard users
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    if (tab === "login") {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else {
        setSuccess("Logged in!");
        // Fetch user profile (nickname)
        const user = data.user;
        let profile = null;
        if (user) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("nickname")
            .eq("id", user.id)
            .single();
          profile = profileData;
        }
          // If profile nickname exists but auth user metadata does not match, try to update auth metadata
          if (user && profile?.nickname) {
            try {
              const currentDisplay = (user as any).user_metadata?.display_name || (user as any).user_metadata?.nickname
              if (currentDisplay !== profile.nickname) {
                await supabase.auth.updateUser({ data: { display_name: profile.nickname } })
              }
            } catch (e) {
              // ignore
            }
          }

          if (onAuth) onAuth({ ...user, nickname: profile?.nickname });
        if (profile?.nickname) localStorage.setItem("nickname", profile.nickname);
      }
    } else {
      // Register user - include display_name in auth user metadata
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else {
        // Don't auto-sign-in. Show explicit confirmation notice and keep modal open
        setSuccess("Registration successful — check your email to confirm your account.");
        setNeedsConfirmation(true);
        setRegisteredEmail(email);
        // Store nickname locally so we can persist it after confirmation if needed
        if (nickname) localStorage.setItem("nickname", nickname);
      }
    }
    setLoading(false);
  }

  async function handleResend() {
    if (!registeredEmail) return;
    setResendLoading(true);
    setError("");
    setSuccess("");
    try {
      // Call server endpoint that uses the service role key to attempt resend reliably.
      const r = await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: registeredEmail, password }),
      })
      const payload = await r.json()
      if (!r.ok) {
        setError(payload?.error || "Failed to resend confirmation")
      } else {
        setSuccess("Confirmation email resent. Check your inbox.")
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-8 bg-white rounded-3xl p-8 relative">
      <div className="flex mb-6">
        <button
          className={`border border-black-500 flex-1 py-2 font-semibold rounded-l-xl ${tab === 'login' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}
          onClick={() => setTab('login')}
        >
          Login
        </button>
        <button
          className={`flex-1 py-2 font-semibold rounded-r-xl ${tab === 'register' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}
          onClick={() => setTab('register')}
        >
          Register
        </button>
      </div>
      {needsConfirmation ? (
        <div className="space-y-4">
          <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-lg">
            <p className="text-sm text-slate-700">We sent a confirmation email to <strong>{registeredEmail}</strong>. Please confirm your email before signing in.</p>
            <p className="text-sm text-slate-500 mt-2">If you didn't receive the email, click "Resend confirmation".</p>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleResend} disabled={resendLoading} className="flex-1">
              {resendLoading ? "Sending..." : "Resend confirmation"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                // User claims they already confirmed; switch to login tab so they can sign in manually.
                setNeedsConfirmation(false);
                setTab("login");
                setSuccess("You can now log in after confirming your email.");
              }}
              className="flex-1"
            >
              I already confirmed
            </Button>
          </div>

          {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
          {success && <div className="text-green-600 text-sm mt-2">{success}</div>}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            ref={emailRef}
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {tab === "register" && (
            <input
              type="text"
              required
              placeholder="Nickname"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
          <Button type="submit" className="w-full h-10 bg-blue-600 hover:bg-blue-400 text-white rounded-xl" disabled={loading}>
            {loading ? "Please wait..." : tab === "login" ? "Login" : "Register"}
          </Button>
          {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
          {success && <div className="text-green-600 text-sm mt-2">{success}</div>}
        </form>
      )}
    </div>
  );
}
