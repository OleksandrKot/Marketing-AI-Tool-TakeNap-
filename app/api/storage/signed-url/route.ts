import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/core/supabase';

export async function POST(req: NextRequest) {
  try {
    const { path } = await req.json();
    const BUCKET = 'creatives'; // Your only bucket

    if (!path) return NextResponse.json({ error: 'No path' }, { status: 400 });

    const cleanPath = path.trim().replace(/^\/+/, '');

    console.log(`[STORAGE] Signing: bucket="${BUCKET}" path="${cleanPath}"`);

    const supabase = createServerSupabaseClient();

    // Use service_role to bypass RLS (if client is created correctly)
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(cleanPath, 3600);

    if (error || !data) {
      console.error(`[STORAGE ERROR] Supabase: ${error?.message} | Path: ${cleanPath}`);
      return NextResponse.json({ error: error?.message || 'Not found' }, { status: 500 });
    }

    return NextResponse.json({ url: data.signedUrl });
  } catch (e) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
