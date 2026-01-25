'use client';

import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, RotateCcw } from 'lucide-react';
import type { Ad } from '@/lib/core/types';

interface Props {
  ad: Ad;
}

export default function ContentControls({ ad }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const isVideo = ad.display_format === 'VIDEO';
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

  async function downloadFromUrl(url: string, filename: string) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('fetch failed');
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download failed', err);
      throw err;
    }
  }

  const handleDownloadPreview = useCallback(async () => {
    if (!ad.ad_archive_id) return;
    setIsLoading(true);
    try {
      const path = ad.storage_path || `business-unknown/${ad.ad_archive_id}.jpeg`;
      const url = await fetchSignedUrl('creatives', path);
      if (!url) return;
      await downloadFromUrl(url, `${ad.title + ad.ad_archive_id || 'preview'}.jpeg`);
    } catch (_) {
      // ignored
    } finally {
      setIsLoading(false);
    }
  }, [ad.ad_archive_id, ad.title]);

  const handleDownloadVideo = useCallback(async () => {
    if (!ad.ad_archive_id) return;
    setIsLoading(true);
    try {
      const path =
        ad.video_storage_path || ad.storage_path || `business-unknown/${ad.ad_archive_id}.mp4`;
      const url = await fetchSignedUrl('creatives', path);
      if (!url) return;
      await downloadFromUrl(url, `${ad.title + ad.ad_archive_id || 'video'}.mp4`);
    } catch (_) {
      // ignored
    } finally {
      setIsLoading(false);
    }
  }, [ad.ad_archive_id, ad.title]);

  const handleDownloadImage = useCallback(async () => {
    if (!ad.ad_archive_id) return;
    setIsLoading(true);
    try {
      const path = ad.storage_path || `business-unknown/${ad.ad_archive_id}.jpeg`;
      const url = await fetchSignedUrl('creatives', path);
      if (!url) return;
      await downloadFromUrl(url, `${ad.title + ad.ad_archive_id || 'image'}.jpeg`);
    } catch (_) {
      // ignored
    } finally {
      setIsLoading(false);
    }
  }, [ad.ad_archive_id, ad.title]);

  const handleRestartVideo = useCallback(() => {
    const video = document.querySelector('video') as HTMLVideoElement | null;
    if (video) {
      video.currentTime = 0;
      video.play();
    }
  }, []);

  return (
    <div className="flex gap-4">
      {isVideo && ad.ad_archive_id && (
        <Button
          onClick={handleRestartVideo}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl h-11 transition-all duration-200"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Restart Video
        </Button>
      )}

      {isVideo ? (
        <>
          <Button
            variant="outline"
            onClick={handleDownloadPreview}
            disabled={isLoading}
            className="border-blue-600 text-blue-600 hover:bg-blue-50 font-medium rounded-xl h-11 transition-all duration-200 bg-transparent"
          >
            <Download className="h-4 w-4 mr-2" />
            {isLoading ? 'Downloading...' : 'Download preview'}
          </Button>

          <Button
            variant="outline"
            onClick={handleDownloadVideo}
            disabled={isLoading}
            className="border-blue-600 text-blue-600 hover:bg-blue-50 font-medium rounded-xl h-11 transition-all duration-200 bg-transparent"
          >
            <Download className="h-4 w-4 mr-2" />
            {isLoading ? 'Downloading...' : 'Download video'}
          </Button>
        </>
      ) : (
        <Button
          variant="outline"
          onClick={handleDownloadImage}
          disabled={isLoading}
          className="border-blue-600 text-blue-600 hover:bg-blue-50 font-medium rounded-xl h-11 transition-all duration-200 bg-transparent"
        >
          <Download className="h-4 w-4 mr-2" />
          {isLoading ? 'Downloading...' : 'Download image'}
        </Button>
      )}
    </div>
  );
}
