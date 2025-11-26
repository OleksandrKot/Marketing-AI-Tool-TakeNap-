import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/core/supabase';

// Serverless-friendly phash check/processor. When deployed on Vercel we cannot spawn
// detached child processes; in that case the endpoint will process a small batch
// of missing rows inline (bounded) and return a summary. When not on Vercel the
// previous behavior of spawning a detached worker is preserved for self-hosted runs.

let workerRunning = false;

async function streamToBuffer(stream: unknown) {
  if (!stream) throw new Error('No stream');
  if (Buffer.isBuffer(stream)) return stream;

  const s = stream as Record<string, unknown>;

  if (typeof s.arrayBuffer === 'function') {
    const ab = await (s.arrayBuffer as () => Promise<ArrayBuffer>)();
    return Buffer.from(ab);
  }

  // Node.js Readable
  if (s.readable === true || typeof s.on === 'function') {
    return await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      try {
        const onFn = s.on as ((ev: string, cb: (c: unknown) => void) => void) | undefined;
        if (typeof onFn === 'function') {
          // collect data
          onFn.call(s, 'data', (c: unknown) => {
            if (Buffer.isBuffer(c)) chunks.push(c);
            else if (typeof c === 'string') chunks.push(Buffer.from(c));
            else if (c instanceof Uint8Array) chunks.push(Buffer.from(c));
            else chunks.push(Buffer.from(String(c)));
          });
          onFn.call(s, 'end', () => resolve(Buffer.concat(chunks)));
          onFn.call(s, 'error', reject as (err?: unknown) => void);
        } else {
          reject(new Error('Stream does not expose on()'));
        }
      } catch (err) {
        reject(err as Error);
      }
    });
  }

  const reader =
    typeof (s.getReader as unknown) === 'function'
      ? (
          s.getReader as unknown as () => { read: () => Promise<{ done: boolean; value: unknown }> }
        )()
      : typeof (s.body?.getReader as unknown) === 'function'
      ? (
          s.body!.getReader as unknown as () => {
            read: () => Promise<{ done: boolean; value: unknown }>;
          }
        )()
      : null;
  if (reader && typeof reader.read === 'function') {
    const chunks: Buffer[] = [];
    while (true) {
      // eslint-disable-next-line no-await-in-loop
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.isBuffer(value) ? value : Buffer.from(value));
    }
    return Buffer.concat(chunks);
  }
  throw new Error('Unsupported stream type');
}

async function calcPHashFromBuffer(buffer: Buffer) {
  const sharpMod = (await import('sharp')).default ?? (await import('sharp'));
  const img = sharpMod(buffer).resize(8, 8, { fit: 'fill' }).removeAlpha().grayscale();
  const { data } = await img.raw().toBuffer({ resolveWithObject: true });

  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  const avg = sum / data.length;

  let bits = '';
  for (let i = 0; i < data.length; i++) bits += data[i] > avg ? '1' : '0';

  const hex = BigInt('0b' + bits)
    .toString(16)
    .padStart(bits.length / 4, '0');
  return hex;
}

export async function GET() {
  try {
    const client = createServerSupabaseClient();

    // Count missing
    const head = await client
      .from('ads_library')
      .select('id', { count: 'exact', head: true })
      .is('creative_hash', null);
    const missing = typeof head.count === 'number' ? head.count : 0;

    // If running on Vercel (serverless) process a small bounded batch inline.
    const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';
    if (isVercel) {
      if (missing === 0) return NextResponse.json({ ok: true, missing, processed: 0 });

      const BATCH = 5;
      const { data, error } = await client
        .from('ads_library')
        .select('id, ad_archive_id')
        .is('creative_hash', null)
        .limit(BATCH);

      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

      let processed = 0;
      for (const row of (data || []) as Array<Record<string, unknown>>) {
        try {
          const id = row.id;
          const adId = row.ad_archive_id;
          if (!id || !adId) continue;

          // Try storage buckets defined in env
          const BUCKET_PHOTO = process.env.NEXT_PUBLIC_AD_BUCKET_PHOTO;
          const BUCKET_VIDEO = process.env.NEXT_PUBLIC_AD_BUCKET_VIDEO_PREVIEW;

          let buffer: Buffer | null = null;
          if (BUCKET_PHOTO) {
            try {
              const dl = await client.storage.from(BUCKET_PHOTO).download(`${adId}.jpeg`);
              if (!dl.error && dl.data) buffer = await streamToBuffer(dl.data as unknown);
            } catch (e) {
              /* ignore */
            }
          }

          if (!buffer && BUCKET_VIDEO) {
            try {
              const dl = await client.storage.from(BUCKET_VIDEO).download(`${adId}.jpeg`);
              if (!dl.error && dl.data) buffer = await streamToBuffer(dl.data as unknown);
            } catch (e) {
              /* ignore */
            }
          }

          if (
            !buffer &&
            process.env.NEXT_PUBLIC_SUPABASE_URL &&
            process.env.NEXT_PUBLIC_AD_BUCKET_PHOTO
          ) {
            try {
              const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL.replace(
                /\/$/,
                ''
              )}/storage/v1/object/public/${process.env.NEXT_PUBLIC_AD_BUCKET_PHOTO}/${adId}.jpeg`;
              const r = await fetch(publicUrl);
              if (r.ok) buffer = await streamToBuffer(r.body ?? r);
            } catch (e) {
              /* ignore */
            }
          }

          if (!buffer) continue;

          const ph = await calcPHashFromBuffer(buffer);
          if (!ph) continue;

          const up = await client.from('ads_library').update({ creative_hash: ph }).eq('id', id);
          if (!up.error) processed += 1;
        } catch (e) {
          // continue on errors per-row
        }
      }

      return NextResponse.json({ ok: true, missing, processed });
    }

    // Not on Vercel — spawn detached worker once per process lifecycle.
    if (missing > 0 && !workerRunning) {
      try {
        const { spawn } = await import('child_process');
        const child = spawn(process.execPath || 'node', ['scripts/phashWorker.mjs'], {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();
        workerRunning = true;

        // Clear the lock after 10 minutes
        setTimeout(() => {
          workerRunning = false;
        }, 10 * 60 * 1000);
      } catch (e) {
        console.error('Failed to spawn phash worker', e);
      }
    }

    return NextResponse.json({ ok: true, missing });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Unknown error' }, { status: 500 });
  }
}
