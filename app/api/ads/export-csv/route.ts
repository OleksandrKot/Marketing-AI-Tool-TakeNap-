import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/core/supabase';

export const dynamic = 'force-dynamic';

const CSV_DELIMITER = ';';

function csvEscape(val: unknown) {
  if (val === null || val === undefined) return '';

  if (typeof val === 'object') {
    val = JSON.stringify(val);
  }

  let s = String(val);

  s = s.replace(/\r\n/g, ' ').replace(/\n/g, ' ').replace(/\r/g, ' ');

  s = s.replace(/"/g, '""');

  return `"${s}"`;
}

/**
 * GET /api/ads/export-csv?job_id=<uuid>
 * Generates a CSV with a *fixed and stable* column order (similar to DB layout).
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const import_job_id = url.searchParams.get('job_id');

    // job_id is required
    if (!import_job_id) {
      return NextResponse.json({ error: 'import_job_id (job_id) is required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    /**
     * 1. Fetch creatives for this import session (import_job_id)
     */
    const { data: rows, error } = await supabase
      .from('ads_library')
      .select('*')
      .eq('import_job_id', import_job_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[CSV] Query error:', error);
      return NextResponse.json({ error: 'Failed to query database' }, { status: 502 });
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'No creatives found for this job_id' }, { status: 404 });
    }

    /**
     * 2. Fixed CSV column order (matches DB logical structure)
     * Add/remove columns depending on your ads_library schema
     */
    const columns = [
      // --- Core metadata ---
      'id',
      'import_job_id',
      'ad_archive_id',
      'created_at',
      'page_name',
      'publisher_platform',
      'tags',

      // --- Ad text / concept ---
      'title',
      'text',
      'caption',
      'hook',
      'topic',
      'concept',
      'character',
      'realisation',

      // --- CTA & links ---
      'cta_text',
      'cta_type',
      'link_url',
      'meta_ad_url',

      // --- Media ---
      'image_url',
      'image_description',
      'video_hd_url',
      'video_preview_image_url',
      'video_script',
      'audio_script',

      // --- AI adaptation scenarios ---
      'new_scenario',

      // --- Deduplication / tech fields ---
      'creative_hash',
      'duplicates_ad_text',
      'duplicates_links',
      'duplicates_preview_image',
    ];

    /**
     * 3. Generate CSV
     */
    const lines: string[] = [];

    // Header row
    lines.push(columns.map((c) => csvEscape(c)).join(CSV_DELIMITER));

    // Data rows
    for (const row of rows) {
      const rowRecord = row as Record<string, unknown>;
      const csvRow = columns.map((col) => csvEscape(rowRecord[col]));
      lines.push(csvRow.join(CSV_DELIMITER));
    }

    // Add UTF-8 BOM for Excel support
    const csv = '\uFEFF' + lines.join('\n');

    const date = new Date().toISOString().slice(0, 10);
    const filename = `creatives_export_${date}_${import_job_id.slice(0, 8)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('[CSV] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/ads/export-csv
 * Request JSON: { ids: string[] }
 * Returns CSV for provided IDs (preserves same column order as GET)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const ids = Array.isArray(body?.ids) ? body.ids : null;

    if (!ids || !ids.length) {
      return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    const { data: rows, error } = await supabase
      .from('ads_library')
      .select('*')
      .in('id', ids)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[CSV POST] Query error:', error);
      return NextResponse.json({ error: 'Failed to query database' }, { status: 502 });
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'No creatives found for provided ids' }, { status: 404 });
    }

    const columns = [
      // --- Core metadata ---
      'id',
      'import_job_id',
      'ad_archive_id',
      'created_at',
      'page_name',
      'publisher_platform',
      'tags',

      // --- Ad text / concept ---
      'title',
      'text',
      'caption',
      'hook',
      'topic',
      'concept',
      'character',
      'realisation',

      // --- CTA & links ---
      'cta_text',
      'cta_type',
      'link_url',
      'meta_ad_url',

      // --- Media ---
      'image_url',
      'image_description',
      'video_hd_url',
      'video_preview_image_url',
      'video_script',
      'audio_script',

      // --- AI adaptation scenarios ---
      'new_scenario',

      // --- Deduplication / tech fields ---
      'creative_hash',
      'duplicates_ad_text',
      'duplicates_links',
      'duplicates_preview_image',
    ];

    const lines: string[] = [];
    lines.push(columns.map((c) => csvEscape(c)).join(CSV_DELIMITER));

    for (const row of rows) {
      const rowRecord = row as Record<string, unknown>;
      const csvRow = columns.map((col) => csvEscape(rowRecord[col]));
      lines.push(csvRow.join(CSV_DELIMITER));
    }

    const csv = '\uFEFF' + lines.join('\n');

    const date = new Date().toISOString().slice(0, 10);
    const filename = `creatives_export_${date}_selected.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('[CSV POST] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
