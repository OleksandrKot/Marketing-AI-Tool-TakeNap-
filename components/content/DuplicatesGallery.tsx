'use client';

import React from 'react';
import StorageImage from '@/lib/StorageImage';

interface Props {
  duplicates?: string | null;
}

export default function DuplicatesGallery({ duplicates }: Props) {
  const imageArray =
    duplicates
      ?.split(';')
      .map((u) => u.trim())
      .filter((u) => u !== '') || [];

  if (imageArray.length === 0) return null;

  return (
    <div className="p-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {imageArray.map((url, index) => {
          const cleanUrl = url;

          // helper to fetch signed url for storage objects
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

          // If it's an absolute URL, render directly as a clickable link
          if (cleanUrl.startsWith('http')) {
            return (
              <div key={index} className="space-y-2">
                <a
                  href={cleanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative aspect-video bg-slate-100 rounded-lg overflow-hidden block hover:opacity-90 transition-opacity"
                >
                  <img
                    src={cleanUrl}
                    alt={`Duplicate ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </a>
                <p className="text-sm text-slate-700 line-clamp-2">Duplicate {index + 1}</p>
              </div>
            );
          }

          // Treat non-http values as storage paths: expected format "bucket/path/to/file.jpg"
          const cleaned = cleanUrl.replace(/^\/+/, '');
          const parts = cleaned.split('/').filter(Boolean);
          if (parts.length >= 2) {
            const bucket = parts.shift() as string;
            const path = parts.join('/');
            return (
              <div key={index} className="space-y-2">
                <button
                  type="button"
                  onClick={async () => {
                    const signed = await fetchSignedUrl(bucket, path);
                    if (signed) {
                      window.open(signed, '_blank', 'noopener');
                    } else {
                      // fallback: open storage preview route if available
                      alert('Unable to open duplicate preview');
                    }
                  }}
                  className="relative aspect-video bg-slate-100 rounded-lg overflow-hidden block hover:opacity-95 transition-opacity"
                >
                  <StorageImage
                    bucket={bucket}
                    path={path}
                    alt={`Duplicate ${index + 1}`}
                    className="w-full h-full object-cover"
                    fill={false}
                  />
                </button>
                <p className="text-sm text-slate-700 line-clamp-2">Duplicate {index + 1}</p>
              </div>
            );
          }

          // Fallback: render placeholder UI
          return (
            <div key={index} className="space-y-2">
              <div className="relative aspect-video bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center">
                <div className="text-center">
                  <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-2">
                    <svg
                      className="h-6 w-6 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <p className="text-xs text-slate-400">No preview</p>
                </div>
              </div>
              <p className="text-sm text-slate-700 line-clamp-2">Duplicate {index + 1}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
