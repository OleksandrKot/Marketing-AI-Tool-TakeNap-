'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { postJSON } from '@/lib/api/client';

export default function RequestAccessPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const requestMutation = useMutation<
    { ok?: boolean; error?: string },
    { message?: string },
    { email: string }
  >({
    mutationFn: (vars) => postJSON('/api/access-requests', vars),
    onMutate: () => {
      setLoading(true);
      setMessage(null);
    },
    onSuccess: (payload) => {
      if (payload?.error) {
        setMessage(payload.error || 'Failed to send request');
      } else {
        setMessage('Request submitted. Redirecting to status page...');
        router.push(`/awaiting-approval?email=${encodeURIComponent(email)}`);
      }
    },
    onError: (err) => {
      setMessage(err?.message || 'Network error');
    },
    onSettled: () => setLoading(false),
  });

  function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    requestMutation.mutate({ email });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="max-w-md w-full p-8 bg-white rounded-3xl shadow">
        <h1 className="text-2xl font-bold mb-4">Request access</h1>
        <p className="text-sm text-slate-600 mb-6">
          Enter your email and click the button to request access.
        </p>

        <form onSubmit={handleRequest} className="space-y-4">
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border rounded-xl"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-blue-600 text-white rounded-xl"
          >
            {loading ? 'Sending...' : "I'm here to use AI Marketing Tool"}
          </button>
        </form>

        {message ? <p className="text-sm mt-4">{message}</p> : null}
      </div>
    </div>
  );
}
