import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createServerSupabaseClient } from '@/lib/core/supabase';

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  try {
    return String(e);
  } catch {
    return 'Unknown error';
  }
}

type Body = {
  folderId: string;
  newOwnerId: string;
};

export async function POST(request: Request) {
  try {
    const body: Body = await request.json();
    const { folderId, newOwnerId } = body;

    if (!folderId || !newOwnerId) {
      return NextResponse.json({ error: 'folderId and newOwnerId are required' }, { status: 400 });
    }

    // Expect caller to include Authorization: Bearer <access_token>
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });
    }
    const token = authHeader.replace(/^Bearer\s+/i, '');

    const supabase = createServerSupabaseClient();

    // Verify token -> get user id of caller
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError) {
      console.error('auth.getUser failed', userError);
      return NextResponse.json({ error: userError.message || String(userError) }, { status: 401 });
    }

    const user = userData.user;
    if (!user?.id) {
      return NextResponse.json({ error: 'Invalid user token' }, { status: 401 });
    }

    // Ensure folder exists and caller is current owner
    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .select('owner')
      .eq('id', folderId)
      .single();
    if (folderError) {
      console.error('folder lookup failed', folderError);
      return NextResponse.json(
        { error: folderError.message || String(folderError) },
        { status: 500 }
      );
    }

    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    if (folder.owner !== user.id) {
      return NextResponse.json(
        { error: 'Only the current owner can transfer ownership' },
        { status: 403 }
      );
    }

    // Use service-role client (supabase) to perform the update; service role bypasses RLS
    const { data: updated, error: updateError } = await supabase
      .from('folders')
      .update({ owner: newOwnerId })
      .eq('id', folderId)
      .select()
      .single();

    if (updateError) {
      console.error('failed to update owner', updateError);
      return NextResponse.json(
        { error: updateError.message || String(updateError) },
        { status: 500 }
      );
    }

    return NextResponse.json({ folder: updated });
  } catch (e: unknown) {
    console.error('transfer ownership error', e);
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
  }
}
