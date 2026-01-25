'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { getPublicImageUrl } from '@/lib/storage/helpers';
// Note: dynamically import storage-url-cache inside the effect to avoid
// static resolution issues in the TS build environment.

interface StorageImageProps {
  bucket: string;
  path: string; // relative path or filename inside bucket
  alt?: string;
  className?: string;
  fill?: boolean;
  sizes?: string;
  onLoad?: () => void;
}

export default function StorageImage({
  bucket,
  path,
  alt = '',
  className,
  fill,
  sizes,
  onLoad,
}: StorageImageProps) {
  // track load state if needed later
  const [, setLoaded] = useState(false);
  const [src, setSrc] = useState<string>('');

  const cleanPath = path.replace(/^\/+/, '');
  const storagePath = `${bucket}/${cleanPath}`;

  useEffect(() => {
    let mounted = true;

    async function fetchSigned() {
      try {
        console.log('[StorageImage] Fetching:', { bucket, path: cleanPath });

        // Check the in-memory cache first
        // Query the server helper to get a signed URL for the specific path.
        // This avoids importing the shared storage cache module which caused
        // TS resolution problems in some environments.
        const res = await fetch('/api/storage/signed-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bucket, path: cleanPath, expires: 60 }),
        });
        let j: unknown = null;
        try {
          j = await res.json();
        } catch (_e: unknown) {
          j = null;
        }
        function parseUrl(obj: unknown): string | null {
          if (!obj || typeof obj !== 'object') return null;
          const rec = obj as Record<string, unknown>;
          const u = rec.url;
          return typeof u === 'string' ? u : null;
        }
        const url = parseUrl(j);
        console.log('[StorageImage] URL result:', { url, ok: res.ok });

        if (!mounted) return;
        // If getSignedUrl returned null it usually means the object doesn't exist in storage;
        // in that case we don't set a storage URL so the parent component can fallback to
        // its own preview (or StorageImage will render a placeholder when src is empty).
        if (url) {
          setSrc(url);
        } else {
          // leave src empty to trigger placeholder
          setSrc('/placeholder.svg');
        }
      } catch (e) {
        console.error('[StorageImage] Error:', e);
        // fallback: public URL (may 403 if truly private)
        if (!mounted) return;
        const pub = getPublicImageUrl(storagePath);
        setSrc(pub || '/placeholder.svg');
      }
    }

    fetchSigned();

    return () => {
      mounted = false;
    };
  }, [bucket, cleanPath, storagePath]);

  // If src is an absolute URL (starts with http) render an <img/> so Next/Image domain whitelist is not required.
  const isExternal = src.startsWith('http');

  if (!src) {
    // still loading, render placeholder
    return (
      <div className="relative w-full h-full">
        <img
          src="/placeholder.svg"
          alt={alt}
          className={`${className || ''} object-fit`}
          sizes={sizes}
        />
      </div>
    );
  }

  if (isExternal) {
    return (
      <div className="relative w-full h-full">
        <img
          src={src}
          alt={alt}
          className={`${className || ''} object-fit`}
          onLoad={() => {
            setLoaded(true);
            try {
              onLoad?.();
            } catch (_e: unknown) {
              /* ignore */
            }
          }}
          sizes={sizes}
        />
      </div>
    );
  }

  // Local path — safe to use next/image
  return (
    <div className="relative">
      <Image
        src={src || '/placeholder.svg'}
        alt={alt}
        fill={!!fill}
        sizes={sizes}
        className={`${className || ''} object-fit`}
        onLoadingComplete={() => {
          setLoaded(true);
          try {
            onLoad?.();
          } catch (_e: unknown) {
            /* ignore */
          }
        }}
      />
    </div>
  );
}
