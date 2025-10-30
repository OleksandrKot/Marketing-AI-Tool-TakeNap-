"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "done" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // When the user arrives from the Supabase recovery link, the URL contains
    // tokens either in the query or the hash. Call getSessionFromUrl to
    // parse tokens and set session in the client SDK.
    (async () => {
      try {
        // Some supabase-js versions expose getSessionFromUrl, but others don't.
        // For compatibility we'll manually parse tokens from the URL (hash or
        // query) and call setSession on the client. Supabase recovery links
        // typically include access_token and refresh_token in the URL fragment.

        function parseTokenString(str: string) {
          const params = new URLSearchParams(str.replace(/^#?\/?\?/, ""));
          const access_token = params.get("access_token");
          const refresh_token = params.get("refresh_token");
          const type = params.get("type");
          return { access_token, refresh_token, type };
        }

        // Try fragment first (hash), then search
        const hash = window.location.hash ? window.location.hash.replace(/^#/, "") : "";
        const query = window.location.search ? window.location.search.replace(/^\?/, "") : "";
        const fromHash = hash ? parseTokenString(hash) : { access_token: null, refresh_token: null, type: null };
        const fromQuery = query ? parseTokenString(query) : { access_token: null, refresh_token: null, type: null };

        const tokens = fromHash.access_token ? fromHash : fromQuery;

        if (!tokens.access_token) {
          setError("No recovery token found in the URL. Make sure you clicked the reset link from your email.");
          setStatus("error");
          return;
        }

        // Set the session in the client so subsequent calls (updateUser) work.
        // Use any casts to avoid type problems across supabase-js versions.
        const setResult = await (supabase.auth as any).setSession({ access_token: tokens.access_token, refresh_token: tokens.refresh_token });
        // setSession may return { data, error } or { error }
        const setErr = setResult?.error || (setResult?.data && setResult?.data?.error);
        if (setErr) {
          console.warn("setSession error:", setErr);
          // still continue to show the form — user may still be able to update using the token server-side
        }

        // Clean the URL to remove tokens
        try {
          const url = new URL(window.location.href);
          url.hash = "";
          url.search = "";
          window.history.replaceState({}, document.title, url.toString());
        } catch (e) {
          // ignore
        }

        // If setSession succeeded, the user is authenticated and can set a new password
        setStatus("ready");
      } catch (e: any) {
        console.error("Failed to parse recovery link:", e);
        setError(String(e?.message || e));
        setStatus("error");
      }
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setSubmitting(true);
    try {
      // updateUser uses the current session (set by getSessionFromUrl) to set the password
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message || String(error));
      } else {
        setStatus("done");
      }
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow p-6 border border-slate-100">
        <h1 className="text-lg font-semibold mb-4">Reset your password</h1>

        {status === "loading" && <div className="text-slate-600">Processing recovery link...</div>}

        {status === "error" && (
          <div>
            <div className="text-red-600 mb-4">{error || "An error occurred while processing the reset link."}</div>
            <div className="text-sm text-slate-700">If the link looks old or invalid, request a new password reset from the login modal.</div>
            <div className="mt-4">
              <Link href="/" className="text-blue-600 underline">Return to home</Link>
            </div>
          </div>
        )}

        {status === "ready" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-sm text-slate-600">Please enter a new password for your account.</div>
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <button type="submit" disabled={submitting} className="w-full h-10 bg-blue-600 text-white rounded-xl">
              {submitting ? "Saving..." : "Set new password"}
            </button>
          </form>
        )}

        {status === "done" && (
          <div className="space-y-4">
            <div className="text-green-600">Your password has been updated. You are now signed in.</div>
            <div className="text-sm text-slate-700">You can now continue to the app.</div>
            <div className="mt-4">
              <Link href="/" className="text-blue-600 underline">Go to app</Link>
            </div>
          </div>
        )}

        <div className="mt-4 text-xs text-slate-500">
          Note: Make sure <strong>/auth/reset</strong> (the URL on this site) is added to the "Redirect URLs" in your Supabase project's Authentication settings. Otherwise the link may not redirect back to your site.
        </div>
      </div>
    </div>
  );
}
