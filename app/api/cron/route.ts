import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const auth = request.headers.get('authorization') || request.headers.get('Authorization');
    const expected = `Bearer ${process.env.CRON_SECRET}`;
    if (!process.env.CRON_SECRET || auth !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Build internal URL to invoke check-phash. On Vercel use VERCEL_URL.
    const host = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
    const target = host ? `${host}/api/ads/check-phash` : `/api/ads/check-phash`;

    // Forward the call to the internal endpoint, passing the same Authorization header.
    const resp = await fetch(target, {
      method: 'GET',
      headers: {
        Authorization: expected,
      },
    });

    const contentType = resp.headers.get('content-type') || 'application/json';
    const body = await resp.text();

    return new NextResponse(body, {
      status: resp.status,
      headers: { 'Content-Type': contentType },
    });
  } catch (err) {
    console.error('Cron route error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
