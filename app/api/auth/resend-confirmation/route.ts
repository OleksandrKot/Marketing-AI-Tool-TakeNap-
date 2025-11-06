import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createServerSupabaseClient } from '@/lib/supabase';

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  try {
    return String(e);
  } catch {
    return 'Unknown error';
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = (body?.email || '').toString().trim();
    const password = (body?.password || '').toString();

    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

    const supabase = createServerSupabaseClient();

    // Try to use server-side auth.signUp to trigger resend of confirmation for unconfirmed users.
    // This uses the service_role key so it can act even if the client is unauthenticated.

    try {
      const res = (await supabase.auth.signUp({ email, password })) as unknown;
      const resObj = res && typeof res === 'object' ? (res as Record<string, unknown>) : undefined;
      const maybeError = resObj && 'error' in resObj ? resObj['error'] : undefined;
      if (maybeError) {
        const errObj = maybeError as unknown;
        const errMsg =
          errObj && typeof errObj === 'object' && 'message' in (errObj as Record<string, unknown>)
            ? ((errObj as Record<string, unknown>)['message'] as string)
            : String(errObj);
        console.error('resend signUp error', maybeError);
        return NextResponse.json({ error: errMsg }, { status: 500 });
      }
      return NextResponse.json({ ok: true, data: res });
    } catch (e: unknown) {
      console.error('resend confirmation server error', e);
      return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
    }
  } catch (e: unknown) {
    console.error('resend-confirmation route error', e);
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
  }
}
