import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

const VERBOSE = process.env.STORAGE_SIGNED_DEBUG === '1';

export async function POST(req: NextRequest) {
  const start = Date.now();

  try {
    const body = await req.json();
    const {
      bucket,
      path,
      expires = 60,
    } = body as { bucket?: string; path?: string; expires?: number };

    if (VERBOSE) console.log('[signed-url] request body:', { bucket, path, expires });

    if (!bucket || !path) {
      if (VERBOSE) console.warn('[signed-url] missing bucket or path');
      return NextResponse.json({ error: 'Missing bucket or path' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    if (VERBOSE) {
      const hasUrl = !!process.env.SUPABASE_URL;
      const hasKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
      console.log(
        `[signed-url] env: SUPABASE_URL=${hasUrl ? 'set' : 'missing'}, SUPABASE_SERVICE_ROLE_KEY=${
          hasKey ? 'set' : 'missing'
        }`
      );
    }

    // Fail fast with a clear error when server-side env vars are missing
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[signed-url] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server env');
      return NextResponse.json(
        { error: 'Server misconfiguration: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set' },
        { status: 500 }
      );
    }

    // createSignedUrl returns { data: { signedUrl }, error }
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expires);

    if (VERBOSE) console.log('[signed-url] supabase response:', { data, error });

    if (error || !data) {
      console.error('[signed-url] Error creating signed URL:', error?.message || error);
      // Return the Supabase error message when available to help debugging (it's safe to expose here in dev)
      const msg = error?.message || 'Failed to create signed URL';
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const duration = Date.now() - start;
    if (VERBOSE)
      console.log(
        `[signed-url] created signed url (len=${String(data.signedUrl).length}) in ${duration}ms`
      );

    return NextResponse.json({ url: data.signedUrl });
  } catch (e) {
    console.error('[signed-url] Unexpected error in signed-url route:', e);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
