import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/core/supabase';

const DEFAULT_EXTS = ['jpeg', 'jpg', 'png'];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      bucket,
      base,
      exts = DEFAULT_EXTS,
      expires = 60,
    } = body as { bucket?: string; base?: string; exts?: string[]; expires?: number };

    if (!bucket || !base) {
      return NextResponse.json({ error: 'Missing bucket or base' }, { status: 400 });
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Server misconfiguration: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set' },
        { status: 500 }
      );
    }

    const supabase = createServerSupabaseClient();

    // Try extensions in order and return the first signed URL found.
    for (const ext of exts) {
      const path = `${base}.${ext}`;
      try {
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expires);
        if (error) {
          // If the object is not found, supabase may return an error — continue to next ext
          let msg = '';
          if (error && typeof error === 'object' && 'message' in error) {
            // convert to unknown first then to a record to satisfy TS
            msg = String((error as unknown as Record<string, unknown>).message);
          }
          if (/no resource with given identifier/i.test(String(msg))) {
            continue;
          }
          // For other errors, surface them to help debugging
          console.error('[signed-url/find] supabase error for', path, error);
          continue;
        }

        if (data?.signedUrl) {
          return NextResponse.json({ url: data.signedUrl, path });
        }
      } catch (e) {
        console.error('[signed-url/find] unexpected error for', path, e);
        // continue to next ext
      }
    }

    // Nothing found
    return NextResponse.json({ url: null, tried: exts.map((e) => `${base}.${e}`) });
  } catch (e) {
    console.error('[signed-url/find] unexpected error', e);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
