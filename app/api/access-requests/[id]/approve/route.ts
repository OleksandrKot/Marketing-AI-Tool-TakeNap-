import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/core/supabase';
import { sendApprovalEmail } from '@/lib/notifications/sendEmail';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const id = params.id;

  try {
    // allow client to pass who performed the action for auditing/debug
    let actedBy: string | null = null;
    try {
      const body = await req.json().catch(() => ({} as Record<string, unknown>));
      actedBy = (body?.acted_by_email || null) as string | null;
    } catch {
      // ignore
    }

    const client = createServerSupabaseClient();
    const resp = await client
      .from('access_requests')
      .update({ status: 'approved' })
      .eq('id', id)
      .select();
    if (resp.error) return NextResponse.json({ error: resp.error.message }, { status: 500 });
    const updated = resp.data?.[0] || null;

    // Check access settings to see if we should notify the user on approval
    let emailSendResult: unknown = null;
    try {
      const settingsResp = await client
        .from('access_settings')
        .select('notify_on_approve')
        .eq('id', 1)
        .single();
      const shouldNotify = !!settingsResp.data?.notify_on_approve;
      if (shouldNotify && updated?.email) {
        try {
          emailSendResult = await sendApprovalEmail(String(updated.email));
        } catch (e) {
          emailSendResult = { ok: false, reason: 'exception', error: (e as Error).message };
        }
      }
    } catch (e) {
      // ignore settings fetch errors
    }

    // Log admin action for debugging (server console)
    try {
      console.log(
        `Access request ${id} approved for ${updated?.email} by ${
          actedBy || 'unknown'
        }. emailSent=${JSON.stringify(emailSendResult)}`
      );
    } catch {
      // ignore logging errors
    }

    return NextResponse.json({ ok: true, data: updated, emailSent: emailSendResult });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Unknown error' }, { status: 500 });
  }
}
