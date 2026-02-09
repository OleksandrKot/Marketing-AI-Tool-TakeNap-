import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const target = url.searchParams.get('url');
    if (!target) {
      return NextResponse.json({ error: 'Missing url query parameter' }, { status: 400 });
    }

    // Validate basic safety: only allow http/https
    if (!/^https?:\/\//i.test(target)) {
      return NextResponse.json({ error: 'Invalid url scheme' }, { status: 400 });
    }

    const res = await fetch(target, { method: 'GET' });
    if (!res.ok) {
      return NextResponse.json({ error: `Failed to fetch image: ${res.status}` }, { status: 502 });
    }

    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    const buffer = await res.arrayBuffer();

    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        // allow client to cache proxied image briefly
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (e) {
    console.error('[images/proxy] error', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
