import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
import { createServerSupabaseClient } from "@/lib/supabase"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = (body?.email || "").toString().trim()
    const password = (body?.password || "").toString()

    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 })

    const supabase = createServerSupabaseClient()

    // Try to use server-side auth.signUp to trigger resend of confirmation for unconfirmed users.
    // This uses the service_role key so it can act even if the client is unauthenticated.
    try {
      const res = await supabase.auth.signUp({ email, password })
      if ((res as any).error) {
        console.error("resend signUp error", (res as any).error)
        return NextResponse.json({ error: (res as any).error?.message || String((res as any).error) }, { status: 500 })
      }
      return NextResponse.json({ ok: true, data: res })
    } catch (e: any) {
      console.error("resend confirmation server error", e)
      return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
    }
  } catch (e: any) {
    console.error("resend-confirmation route error", e)
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
