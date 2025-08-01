import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { adUrl } = await request.json(); 
    const makeWebhookUrl = process.env.MAKE_WEBHOOK_URL; 

    const makeResponse = await fetch(makeWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ adUrl }), 
    });

    if (!makeResponse.ok) {
      throw new Error(`Make.com webhook failed with status: ${makeResponse.status}`);
    }

    return NextResponse.json({ success: true, message: "Analysis started." });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}