'use client';

import React, { useEffect, useState } from 'react';
import type { Ad } from '@/lib/core/types';

interface Props {
  ad: Ad;
  className?: string;
  onLoaded?: () => void;
}

// Cache signed URLs to avoid repeated API calls
const urlCache = new Map<string, { url: string; expires: number }>();

export default function StorageVideo({ ad, className, onLoaded }: Props) {
  const isVideo = ad.display_format === 'VIDEO' || ad.display_format === 'DCO';
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [posterSrc, setPosterSrc] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Call onLoaded when video is ready or fails to load
  useEffect(() => {
    if (isLoaded) {
      onLoaded?.();
    }
  }, [isLoaded, onLoaded]);

  // Timeout to mark as loaded if video doesn't load within 5 seconds
  useEffect(() => {
    if (videoSrc === null) return;

    const timeout = setTimeout(() => {
      if (!isLoaded) {
        console.warn('[StorageVideo] Timeout waiting for video to load, marking as loaded');
        setIsLoaded(true);
      }
    }, 5000);

    return () => clearTimeout(timeout);
  }, [videoSrc, isLoaded]);

  // Mark as loaded when no video available
  useEffect(() => {
    if (videoSrc === '' && !isLoaded) {
      console.log('[StorageVideo] No video available, marking as loaded');
      setIsLoaded(true);
    }
  }, [videoSrc, isLoaded]);

  useEffect(() => {
    let mounted = true;
    async function fetchSignedUrl(bucket: string, path: string) {
      // Check cache first
      const cacheKey = `${bucket}:${path}`;
      const cached = urlCache.get(cacheKey);
      if (cached && cached.expires > Date.now()) {
        return cached.url;
      }

      try {
        const res = await fetch('/api/storage/signed-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bucket, path, expires: 3600 }), // 1 hour instead of 60 seconds
        });
        const j = await res.json().catch(() => null);
        if (!j || typeof j !== 'object') return null;
        const rec = j as Record<string, unknown>;
        const u = rec.url;
        if (typeof u === 'string') {
          // Cache for 50 minutes (before expiration)
          urlCache.set(cacheKey, { url: u, expires: Date.now() + 50 * 60 * 1000 });
          return u;
        }
        return null;
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
                console.log('[StorageVideo] Video loaded');
                setIsLoaded(true);
              }}
              onCanPlay={() => {
                console.log('[StorageVideo] Video can play');
                setIsLoaded(true);
              }}
              onError={(e) => {
                console.error('[StorageVideo] Video load error:', videoSrc, e);
                setIsLoaded(true); // Mark as loaded even on error
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
              onLoad={() => setIsLoaded(true)}
              onError={() => setIsLoaded(true)}
            />
          </div>
        ) : videoSrc === '' ? (
          // No video available - mark as loaded immediately
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
