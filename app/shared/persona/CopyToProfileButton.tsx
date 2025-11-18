'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { log } from '@/lib/logger';

export default function CopyToProfileButton({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);

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
        alert('Please sign in to copy this persona to your profile');
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
        alert('Persona copied to your profile');
      } else if (j?.error) {
        alert('Failed: ' + j.error);
      } else {
        alert('Failed to copy persona');
      }
    } catch (e) {
      log.error('copy failed', e);
      alert('Failed to copy persona');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6">
      <Button onClick={handleCopy} disabled={loading} className="bg-blue-600 text-white">
        {loading ? 'Copying...' : 'Copy to my profile'}
      </Button>
    </div>
  );
}
