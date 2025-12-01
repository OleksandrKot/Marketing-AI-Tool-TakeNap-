export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { runPhashWorkerOnce } from '@/scripts/phashWorker.mjs'; // adjust path if needed

export async function GET(request: NextRequest) {
  try {
    // --- Auth check using CRON_SECRET ---
    const authHeader = request.headers.get('authorization') || '';
    const expected = `Bearer ${process.env.CRON_SECRET || ''}`;
    const authorized = !!process.env.CRON_SECRET && authHeader === expected;

    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // --- Run phash worker (single-pass, serverless-safe) ---
    try {
      await runPhashWorkerOnce();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('phash worker failed:', errMsg);
      return NextResponse.json(
        {
          error: 'phash worker failed',
          details: errMsg,
        },
        { status: 500 }
      );
    }

    // --- Success response ---
    return NextResponse.json(
      { ok: true, message: 'phash worker completed catchup pass' },
      { status: 200 }
    );
  } catch (err) {
    console.error('Cron route fatal error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
