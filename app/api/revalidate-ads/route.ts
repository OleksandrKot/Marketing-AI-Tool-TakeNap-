import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { revalidatePath } from 'next/cache';

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  if (apiKey !== process.env.MAKE_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Revalidate home page to load new data from Supabase
    revalidatePath('/');

    return NextResponse.json({ revalidated: true, now: Date.now() });
  } catch (err) {
    return NextResponse.json(
      { revalidated: false, message: 'Error revalidating' },
      { status: 500 }
    );
  }
}
