'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import ConfirmModal from '@/components/modals/confirm-modal';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/core/supabase';
import { log } from '@/lib/core/logger';

export default function CopyToProfileButton({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [warnOpen, setWarnOpen] = useState(false);
  const [warnMsg, setWarnMsg] = useState<string | undefined>(undefined);
  const [warnTitle, setWarnTitle] = useState<string | undefined>(undefined);
  const [showLogin, setShowLogin] = useState(false);

  const LoginModal = dynamic(() => import('@/app/login-auth/LoginModal'), {
    ssr: false,
    loading: () => null,
  });

  const handleCopy = async () => {
    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      let accessToken: string | null = null;
      const sd = sessionData as unknown;
      if (sd && typeof sd === 'object') {
        const sdObj = sd as Record<string, unknown>;
        const sess = sdObj['session'];
        if (sess && typeof sess === 'object') {
          const at = (sess as Record<string, unknown>)['access_token'];
          if (typeof at === 'string') accessToken = at;
        }
      }
      if (!accessToken) {
        // open login modal so user can sign in
        setShowLogin(true);
        setLoading(false);
        return;
      }

      const res = await fetch('/api/personas/copy-shared', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ token }),
      });

      const j = await res.json();
      if (res.ok && j?.success) {
        setWarnTitle('Success');
        setWarnMsg('Persona copied to your profile');
        setWarnOpen(true);
      } else if (j?.error) {
        setWarnTitle('Copy failed');
        setWarnMsg('Failed: ' + j.error);
        setWarnOpen(true);
      } else {
        setWarnTitle('Copy failed');
        setWarnMsg('Failed to copy persona');
        setWarnOpen(true);
      }
    } catch (e) {
      log.error('copy failed', e);
      setWarnTitle('Copy failed');
      setWarnMsg('Failed to copy persona');
      setWarnOpen(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6">
      <Button onClick={handleCopy} disabled={loading} className="bg-blue-600 text-white">
        {loading ? 'Copying...' : 'Copy to my profile'}
      </Button>
      {showLogin ? <LoginModal onClose={() => setShowLogin(false)} /> : null}
      <ConfirmModal
        isOpen={warnOpen}
        title={warnTitle}
        message={warnMsg}
        confirmLabel="OK"
        cancelLabel=""
        onConfirm={() => setWarnOpen(false)}
        onCancel={() => setWarnOpen(false)}
      />
    </div>
  );
}
