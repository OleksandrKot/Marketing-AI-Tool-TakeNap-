import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/core/supabase';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const bucket = String(body['bucket'] || '');
    const path = String(body['path'] || '');
    if (!bucket || !path)
      return NextResponse.json({ error: 'Missing bucket or path' }, { status: 400 });

    const supabase = createServerSupabaseClient();

    // createSignedUrl expects file path relative to bucket
    const expiresIn = Number(body.expiresIn || 60 * 5);
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to sign' }, { status: 500 });
    }
    return NextResponse.json({ url: data?.signedUrl || null });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: Request) {
  // support simple GET with query params
  try {
    const url = new URL(req.url);
    const bucket = url.searchParams.get('bucket') || '';
    const path = url.searchParams.get('path') || '';
    if (!bucket || !path)
      return NextResponse.json({ error: 'Missing bucket or path' }, { status: 400 });

    const supabase = createServerSupabaseClient();
    const expiresIn = Number(url.searchParams.get('expiresIn') || String(60 * 5));
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
    if (error)
      return NextResponse.json({ error: error.message || 'Failed to sign' }, { status: 500 });
    return NextResponse.json({ url: data?.signedUrl || null });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
