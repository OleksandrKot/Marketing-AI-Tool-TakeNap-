import { type NextRequest, NextResponse } from "next/server"

// API для парсингу Meta Ad Library посилань
export async function POST(request: NextRequest) {
  try {
    const { metaLink } = await request.json()

    if (!metaLink || !metaLink.includes("facebook.com/ads/library")) {
      return NextResponse.json({ error: "Invalid Meta Ad Library link" }, { status: 400 })
    }

    // ВАШ РЕАЛЬНИЙ WEBHOOK URL СЮДИ:
    const makeWebhookUrl = "ВАШ_РЕАЛЬНИЙ_WEBHOOK_URL_СЮДИ"

    const response = await fetch(makeWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "parse_meta_link",
        meta_link: metaLink,
        timestamp: new Date().toISOString(),
        source: "creative-library-website",
      }),
    })

    if (!response.ok) {
      throw new Error("Failed to send to Make.com")
    }

    return NextResponse.json({
      success: true,
      message: "Link sent for processing",
      status: "processing",
    })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
