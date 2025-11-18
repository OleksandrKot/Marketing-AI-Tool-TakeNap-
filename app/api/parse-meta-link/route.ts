import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { detectProductFromUrl, getWebhookUrl } from '@/lib/product-webhooks';

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  try {
    return String(e);
  } catch {
    return 'Unknown error';
  }
}

// API для парсингу Meta Ad Library посилань
export async function POST(request: NextRequest) {
  try {
    const {
      metaLink,
      creativeType = 'all',
      limit = 10,
      user_id = null,
      job_id = null,
    } = await request.json();

    if (!metaLink || !metaLink.includes('facebook.com/ads/library')) {
      return NextResponse.json({ error: 'Invalid Meta Ad Library link' }, { status: 400 });
    }

    // 🎯 Перевіряємо чи є такий тип креативу
    if (!['all', 'video', 'image'].includes(creativeType)) {
      return NextResponse.json({ error: 'Invalid creative type' }, { status: 400 });
    }

    // 🔍 Визначаємо продукт по URL (необов'язково)
    const { productKey, productName, pageId } = detectProductFromUrl(metaLink);

    // 🎯 Обираємо webhook: перевага загальному (щоб не залежати від page_id)
    const envDefault = process.env.MAKE_WEBHOOK_ALL;
    const productWebhook = productKey ? getWebhookUrl(productKey, creativeType) : null;
    // Якщо немає env — підстрахуємось існуючим Replika webhook'ом
    const replikaFallbackMap: Record<string, string | undefined> = {
      all: (await import('@/lib/product-webhooks')).PRODUCT_WEBHOOKS.replika?.webhooks.all,
      video: (await import('@/lib/product-webhooks')).PRODUCT_WEBHOOKS.replika?.webhooks.video,
      image: (await import('@/lib/product-webhooks')).PRODUCT_WEBHOOKS.replika?.webhooks.image,
    };
    const webhookUrl = envDefault || productWebhook || replikaFallbackMap[creativeType];

    if (!webhookUrl) {
      return NextResponse.json(
        {
          error: 'Webhook not configured',
          message: `No webhook configured for ${
            productName || 'unknown product'
          } (${creativeType}). Provide env MAKE_WEBHOOK_ALL/VIDEO/IMAGE or add a mapping.`,
        },
        { status: 500 }
      );
    }

    console.log(`🎯 Product: ${productName || 'Unknown'} (${productKey || '-'})`);
    console.log(`🎯 Creative Type: ${creativeType}`);
    console.log(`🎯 Webhook URL: ${webhookUrl}`);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-make-apikey': process.env.MAKE_API_KEY || '',
      },
      body: JSON.stringify({
        action: 'parse_meta_link',
        meta_link: metaLink,
        creative_type: creativeType,
        limit: limit,
        user_id: user_id,
        job_id: job_id,
        product_key: productKey,
        product_name: productName,
        page_id: pageId,
        timestamp: new Date().toISOString(),
        source: 'creative-library-website',
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send to Make.com (${productName} - ${creativeType})`);
    }

    return NextResponse.json({
      success: true,
      message: `Link sent for processing`,
      productName: productName,
      productKey: productKey,
      creativeType: creativeType,
      status: 'processing',
      webhookUrl: webhookUrl, // Для дебагу (можна прибрати в продакшені)
    });
  } catch (error: unknown) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
