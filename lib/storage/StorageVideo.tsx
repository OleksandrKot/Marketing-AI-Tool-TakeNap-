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

      // For video use only video_storage_path (no fallback to storage_path)
      // For poster use storage_path
      const videoPath = ad.video_storage_path;
      const posterPath = ad.storage_path;

      console.log('[StorageVideo] Loading:', {
        ad_archive_id: ad.ad_archive_id,
        videoPath,
        posterPath,
      });

      const bucket = 'creatives';

      // If no video_storage_path - show only poster
      if (!videoPath) {
        console.warn(
          `[StorageVideo] No video_storage_path for ad ${ad.ad_archive_id}, showing poster only`
        );
        const poster = posterPath ? await fetchSignedUrl(bucket, posterPath) : null;
        if (mounted) {
          setVideoSrc(''); // Empty string = no video, show poster
          setPosterSrc(poster || '');
        }
        return;
      }

      const [v, p] = await Promise.all([
        fetchSignedUrl(bucket, videoPath),
        posterPath ? fetchSignedUrl(bucket, posterPath) : Promise.resolve(null),
      ]);

      console.log('[StorageVideo] URLs:', { video: v, poster: p });

      if (mounted) {
        setVideoSrc(v || '');
        setPosterSrc(p || '');
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
        videoSrc && videoSrc !== '' ? (
          <div className="flex items-center justify-center h-full">
            <video
              src={videoSrc}
              poster={posterSrc && posterSrc !== '' ? posterSrc : undefined}
              controls
              preload="metadata"
              className="max-h-full max-w-full object-contain relative z-10"
              onLoadedData={() => {
                onLoaded?.();
              }}
              onError={() => {
                console.error('[StorageVideo] Video load error:', videoSrc);
              }}
            >
              <track kind="captions" srcLang="en" src="" />
            </video>
          </div>
        ) : videoSrc === '' && posterSrc ? (
          // No video but has poster - show poster
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              src={posterSrc}
              alt="Video preview"
              className="max-h-full max-w-full object-contain"
              onLoad={() => onLoaded?.()}
            />
          </div>
        ) : videoSrc === '' ? (
          <div className="relative w-full h-full flex items-center justify-center z-10 bg-slate-50">
            <p className="text-slate-500">Video not available</p>
          </div>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center z-10">
            <div className="animate-pulse text-slate-400">Loading video...</div>
          </div>
        )
      ) : null}
    </div>
  );
}
