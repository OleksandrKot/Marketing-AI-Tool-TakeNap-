import { NextResponse } from 'next/server';
import { listAccessProfiles } from '@/lib/access/profiles';

export async function GET() {
  try {
    const profiles = await listAccessProfiles();
    return NextResponse.json({ ok: true, data: profiles });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Unknown error' }, { status: 500 });
  }
}
