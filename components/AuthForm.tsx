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
        const { data, error } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: {
            data: {
              display_name: nickname
            }
          }
        });
        // remove stray debug alert
        if (error) throw error;
        setSuccess("Registration started — please check your email to confirm");
        const user = data.user;
        // Determine display name: prefer auth metadata (if set by provider), else the nickname user entered
        const signupAuthDisplay = (user as any)?.user_metadata?.display_name || nickname || null;
        if (user && signupAuthDisplay) {
          try {
            // Upsert both nickname and display_name to support different UI fields
            const { error: upsertError } = await supabase.from("profiles").upsert({ id: user.id, nickname: signupAuthDisplay, display_name: signupAuthDisplay });
            if (upsertError) console.warn("Could not save nickname to profiles table:", upsertError.message || upsertError);
            else localStorage.setItem("nickname", signupAuthDisplay);
            // Also ensure auth user metadata display_name is set (non-blocking)
            try {
              await supabase.auth.updateUser({ data: { display_name: signupAuthDisplay } });
            } catch (metaErr) {
              console.warn('Could not update auth user metadata display_name:', metaErr);
            }
          } catch (upsertErr: any) {
            console.warn("Profiles upsert failed:", upsertErr?.message || upsertErr);
          }
        }
        const resultUserSignup: any = { ...user };
        if (signupAuthDisplay) {
          resultUserSignup.display_name = signupAuthDisplay;
          resultUserSignup.nickname = signupAuthDisplay;
        }
        if (onAuth) onAuth(resultUserSignup);
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
