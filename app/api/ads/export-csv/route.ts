import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/core/supabase';

export const dynamic = 'force-dynamic';

// Use semicolon as delimiter so Excel/Sheets in many EU locales
// display columns correctly instead of everything in one column.
const CSV_DELIMITER = ';';

/**
 * Escape value for CSV:
 * - Convert objects to JSON
 * - Replace line breaks with spaces (so each DB row = one CSV line)
 * - Escape double quotes
 * - Wrap everything in quotes
 */
function csvEscape(val: unknown) {
  if (val === null || val === undefined) return '';

  if (typeof val === 'object') {
    val = JSON.stringify(val);
  }

  // Convert value to string
  let s = String(val);

  // Remove line breaks inside the cell – otherwise CSV viewers
  // may think it's a new row and "merge" everything visually.
  s = s.replace(/\r\n/g, ' ').replace(/\n/g, ' ').replace(/\r/g, ' ');

  // Escape double quotes
  s = s.replace(/"/g, '""');

  // Wrap in quotes
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

    /**
     * 4. Filename: creatives_export_YYYY-MM-DD_<job>.csv
     */
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
