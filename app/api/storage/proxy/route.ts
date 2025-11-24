import { createServerSupabaseClient } from '@/lib/core/supabase';
import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const bucket = url.searchParams.get('bucket');
    const path = url.searchParams.get('path');

    if (!bucket || !path) {
      return NextResponse.json({ error: 'Missing bucket or path' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    // Use server key to download the object and stream it back to the client
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data) {
      console.error('Storage proxy download error', error);
      return NextResponse.json({ error: 'Failed to download object' }, { status: 502 });
    }

    // Convert response to ArrayBuffer then to Response with correct headers
    // Supabase storage.download should return a Blob-like object with arrayBuffer()
    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await (data as Blob).arrayBuffer();
    } catch (e) {
      console.error('Failed to convert downloaded object to ArrayBuffer', e);
      return NextResponse.json({ error: 'Unsupported download payload' }, { status: 502 });
    }

    // Guess content type from extension
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const contentType =
      ext === 'png'
        ? 'image/png'
        : ext === 'webp'
        ? 'image/webp'
        : ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : ext === 'gif'
        ? 'image/gif'
        : 'application/octet-stream';

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    console.error('Storage proxy unexpected error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
