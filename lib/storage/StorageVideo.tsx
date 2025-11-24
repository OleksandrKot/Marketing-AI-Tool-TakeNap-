'use client';

import React, { useEffect, useState } from 'react';
import type { Ad } from '@/lib/core/types';

interface Props {
  ad: Ad;
  className?: string;
  onLoaded?: () => void;
}

export default function StorageVideo({ ad, className, onLoaded }: Props) {
  const isVideo = ad.display_format === 'VIDEO';
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [posterSrc, setPosterSrc] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchSignedUrl(bucket: string, path: string) {
      try {
        const res = await fetch('/api/storage/signed-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bucket, path, expires: 60 }),
        });
        const j = await res.json().catch(() => null);
        if (!j || typeof j !== 'object') return null;
        const rec = j as Record<string, unknown>;
        const u = rec.url;
        return typeof u === 'string' ? u : null;
      } catch (_e) {
        return null;
      }
    }

    async function load() {
      if (!ad.ad_archive_id || !isVideo) {
        setVideoSrc(null);
        setPosterSrc(null);
        return;
      }

      const [v, p] = await Promise.all([
        fetchSignedUrl('test8public', `${ad.ad_archive_id}.mp4`),
        fetchSignedUrl('test10public_preview', `${ad.ad_archive_id}.jpeg`),
      ]);

      if (mounted) {
        setVideoSrc(v);
        setPosterSrc(p);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [ad.ad_archive_id, isVideo]);

  return (
    <div className={className ?? 'relative w-full h-full'}>
      {isVideo ? (
        videoSrc ? (
          <div className="flex items-center justify-center h-full">
            <video
              src={videoSrc}
              poster={posterSrc ?? undefined}
              controls
              preload="metadata"
              className="max-h-full max-w-full object-contain relative z-10"
              onLoadedData={() => {
                onLoaded?.();
              }}
            >
              <track kind="captions" srcLang="en" src="" />
            </video>
          </div>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center z-10">
            <p className="text-slate-500">Video not available</p>
          </div>
        )
      ) : null}
    </div>
  );
}
