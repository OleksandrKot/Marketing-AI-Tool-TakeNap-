import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/core/supabase';

// POST /api/adaptations/generate
// body: { user_id?: string, creative_id?: string, file_name?: string, file_base64?: string, user_prompt: object }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      user_id: userId,
      creative_id: creativeId,
      file_name: fileName,
      file_base64: fileBase64,
      user_prompt: userPrompt,
    } = body as {
      user_id?: string;
      creative_id?: string;
      file_name?: string;
      file_base64?: string;
      user_prompt: unknown;
    };

    if (!userPrompt) {
      return NextResponse.json({ error: 'Missing user_prompt' }, { status: 400 });
    }

    const makeUrl = process.env.MAKE_GENERATE_URL || process.env.MAKE_WEBHOOK_URL;
    if (!makeUrl) {
      return NextResponse.json(
        { error: 'Make webhook URL not configured (MAKE_GENERATE_URL)' },
        { status: 500 }
      );
    }

    // Build payload for Make.com
    const makePayload = {
      type: 'generate_visual_prompt',
      payload: {
        file_name: fileName || 'creative.jpg',
        file_base64: fileBase64 || null,
        user_prompt: userPrompt,
        creative_id: creativeId || null,
      },
    };

    // Send to Make.com (using global fetch available in Node/Next runtime)
    const resp = await fetch(makeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makePayload),
    });

    const makeResponseText = await resp.text();
    let makeResponseJson: unknown = null;
    try {
      makeResponseJson = makeResponseText ? JSON.parse(makeResponseText) : null;
    } catch (e) {
      makeResponseJson = { text: makeResponseText };
    }

    // Persist into Supabase adaptive_designs table
    try {
      const supabase = createServerSupabaseClient();

      const insertPayload = {
        user_id: userId || null,
        creative_id: creativeId || null,
        file_name: fileName || null,
        payload: userPrompt || null,
        make_response: makeResponseJson,
      } as Record<string, unknown>;

      const { data, error } = await supabase
        .from('adaptive_designs')
        .insert([insertPayload])
        .select()
        .single();

      if (error) {
        console.error('[adaptations/generate] Failed to insert adaptive_designs record', error);
      }

      return NextResponse.json({ success: true, make_result: makeResponseJson, record: data });
    } catch (dbErr) {
      console.error('[adaptations/generate] DB error', dbErr);
      return NextResponse.json({ success: false, make_result: makeResponseJson }, { status: 500 });
    }
  } catch (e) {
    console.error('[adaptations/generate] Unexpected error', e);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
