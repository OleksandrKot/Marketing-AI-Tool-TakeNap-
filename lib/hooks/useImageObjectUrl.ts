import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

/**
 * Fetch an image as a Blob and return an object URL.
 * Benefits:
 * - Uses React Query caching to avoid re-downloading the same image repeatedly
 * - Allows prefetching images before they enter the viewport
 */
export function useImageObjectUrl(src?: string | null) {
  const enabled = Boolean(src);

  const query = useQuery({
    queryKey: ['image-blob', src],
    queryFn: async () => {
      if (!src) return null as Blob | null;
      const res = await fetch(src);
      if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
      const blob = await res.blob();
      return blob;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 2 * 60 * 1000, // 2 minutes (short-lived object URLs)
    retry: 1,
  });

  const objectUrl = useMemo(() => {
    const blob = query.data;
    if (!blob) return undefined;
    try {
      const url = URL.createObjectURL(blob);
      return url;
    } catch {
      return undefined;
    }
  }, [query.data]);

  // Revoke object URL when unmounting or when blob changes
  useEffect(() => {
    return () => {
      try {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      } catch {
        /* noop */
      }
    };
  }, [objectUrl]);

  return { objectUrl, isLoading: query.isLoading, error: query.error } as const;
}

export default useImageObjectUrl;
