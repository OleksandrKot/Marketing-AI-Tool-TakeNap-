import { type NextRequest, NextResponse } from "next/server"
import { detectProductFromUrl, getWebhookUrl } from "@/lib/product-webhooks"

// API для парсингу Meta Ad Library посилань
export async function POST(request: NextRequest) {
  try {
    const { metaLink, creativeType = "all" } = await request.json()

    if (!metaLink || !metaLink.includes("facebook.com/ads/library")) {
      return NextResponse.json({ error: "Invalid Meta Ad Library link" }, { status: 400 })
    }

    // 🎯 Перевіряємо чи є такий тип креативу
    if (!["all", "video", "image"].includes(creativeType)) {
      return NextResponse.json({ error: "Invalid creative type" }, { status: 400 })
    }

    // 🔍 Визначаємо продукт по URL
    const { productKey, productName, pageId } = detectProductFromUrl(metaLink)

    if (!productKey) {
      return NextResponse.json(
        {
          error: "Unknown product",
          message: `Could not identify product from URL. ${pageId ? `Page ID found: ${pageId}` : "No page ID found"}`,
        },
        { status: 400 },
      )
    }

    // 🎯 Вибираємо правильний webhook URL
    const webhookUrl = getWebhookUrl(productKey, creativeType)

    if (!webhookUrl) {
      return NextResponse.json(
        {
          error: "Webhook not configured",
          message: `No webhook configured for ${productName} (${creativeType})`,
        },
        { status: 500 },
      )
    }

    console.log(`🎯 Product: ${productName} (${productKey})`)
    console.log(`🎯 Creative Type: ${creativeType}`)
    console.log(`🎯 Webhook URL: ${webhookUrl}`)

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-make-apikey": process.env.MAKE_API_KEY || "",
      },
      body: JSON.stringify({
        action: "parse_meta_link",
        meta_link: metaLink,
        creative_type: creativeType,
        product_key: productKey,
        product_name: productName,
        page_id: pageId,
        timestamp: new Date().toISOString(),
        source: "creative-library-website",
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to send to Make.com (${productName} - ${creativeType})`)
    }

    return NextResponse.json({
      success: true,
      message: `Link sent for processing`,
      productName: productName,
      productKey: productKey,
      creativeType: creativeType,
      status: "processing",
      webhookUrl: webhookUrl, // Для дебагу (можна прибрати в продакшені)
    })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 })
  }
}
