import { createServerSupabaseClient } from '@/lib/core/supabase';
import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const bucketParam = url.searchParams.get('bucket');
    const path = url.searchParams.get('path');

    if (!bucketParam || !path) {
      return NextResponse.json({ error: 'Missing bucket or path' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const buckets = bucketParam
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean);

    const guessContentType = (p: string) => {
      const ext = p.split('.').pop()?.toLowerCase() || '';
      return ext === 'png'
        ? 'image/png'
        : ext === 'webp'
        ? 'image/webp'
        : ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : ext === 'gif'
        ? 'image/gif'
        : ext === 'mp4'
        ? 'video/mp4'
        : 'application/octet-stream';
    };

    const tryDownload = async (
      bucket: string,
      p: string
    ): Promise<{ buf: ArrayBuffer; contentType: string } | null> => {
      // First attempt: exact path
      const attempt = await supabase.storage.from(bucket).download(p);
      if (!attempt.error && attempt.data) {
        const buf = await (attempt.data as Blob).arrayBuffer();
        return { buf, contentType: guessContentType(p) };
      }

      const err = attempt.error as unknown as { status?: number; message?: string };
      console.error('Storage proxy download error', {
        bucket,
        path: p,
        status: err?.status,
        message: err?.message,
      });

      // Fallback: try to resolve unknown extension by listing directory
      // Expect paths like "ads/{id}/{id}.ext" or "ads/{id}/cards/{i}.ext"
      const parts = p.split('/');
      if (parts.length >= 3) {
        const fileName = parts.pop() as string; // e.g., "123456.jpeg"
        const dir = parts.join('/');
        const base = fileName.includes('.') ? fileName.split('.')[0] : fileName;

        const listRes = await supabase.storage.from(bucket).list(dir, { limit: 100 });
        if (!listRes.error && Array.isArray(listRes.data)) {
          // Find a file that matches the base name with any known image/video extension
          const candidate = listRes.data.find((f) => {
            const name = f.name || '';
            return (
              name === `${base}.jpeg` ||
              name === `${base}.jpg` ||
              name === `${base}.png` ||
              name === `${base}.webp` ||
              name === `${base}.gif` ||
              name === `${base}.mp4`
            );
          });
          if (candidate) {
            const resolvedPath = `${dir}/${candidate.name}`;
            const resolved = await supabase.storage.from(bucket).download(resolvedPath);
            if (!resolved.error && resolved.data) {
              const buf = await (resolved.data as Blob).arrayBuffer();
              return { buf, contentType: guessContentType(resolvedPath) };
            }
          }
        }
      }

      return null;
    };

    // Try all provided buckets until one succeeds
    for (const b of buckets) {
      const res = await tryDownload(b, path);
      if (res) {
        return new Response(res.buf, {
          status: 200,
          headers: {
            'Content-Type': res.contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      }
    }

    // Legacy fallback: if path is ads/{id}/{id}.ext and not found, try {id}.ext at bucket root with all known extensions
    const legacyMatch = path.match(/^ads\/(\d+)\/\1\./);
    if (legacyMatch) {
      const id = legacyMatch[1];
      const extensions = ['jpeg', 'jpg', 'png', 'webp', 'gif', 'mp4'];
      for (const b of buckets) {
        for (const ext of extensions) {
          const legacyPath = `${id}.${ext}`;
          const res = await tryDownload(b, legacyPath);
          if (res) {
            return new Response(res.buf, {
              status: 200,
              headers: {
                'Content-Type': res.contentType,
                'Cache-Control': 'public, max-age=31536000, immutable',
              },
            });
          }
        }
      }
    }

    return NextResponse.json(
      { error: 'Failed to download object from any bucket' },
      { status: 404 }
    );
  } catch (err) {
    console.error('Storage proxy unexpected error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
