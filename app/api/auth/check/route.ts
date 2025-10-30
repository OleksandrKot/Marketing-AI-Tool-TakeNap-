import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const email = url.searchParams.get("email")
    if (!email) return NextResponse.json({ error: "email query required" }, { status: 400 })

    const supabase = createServerSupabaseClient()

    // Prefer the GoTrue admin API if available on the client library
    if (supabase.auth && (supabase.auth as any).admin && typeof (supabase.auth as any).admin.listUsers === "function") {
      try {
        const res = await (supabase.auth as any).admin.listUsers({ perPage: 200 })
        if (res.error) {
          console.error("admin.listUsers error", res.error)
          return NextResponse.json({ error: res.error.message || String(res.error) }, { status: 500 })
        }
        const all = res.data?.users || res.data || []
        const found = (all || []).find((u: any) => (u.email || "").toLowerCase() === email.toLowerCase())
        return NextResponse.json({ exists: !!found })
      } catch (e: any) {
        console.error("admin.listUsers failed", e)
        // fallthrough to REST admin endpoint
      }
    }

    // Fallback: call GoTrue Admin REST endpoint directly using service role key
    const supabaseUrl = process.env.SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars for auth check")
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 })
    }

    const adminUrl = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users?email=${encodeURIComponent(email)}`
    try {
      const r = await fetch(adminUrl, { headers: { Authorization: `Bearer ${serviceKey}` } })
      if (!r.ok) {
        const text = await r.text().catch(() => '')
        console.error("GoTrue admin users request failed", r.status, text)
        return NextResponse.json({ error: `Admin lookup failed: ${r.status}` }, { status: 500 })
      }
      const payload = await r.json()
      const exists = Array.isArray(payload) ? payload.length > 0 : false
      return NextResponse.json({ exists })
    } catch (e: any) {
      console.error("auth check REST error", e)
      return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
    }
  } catch (e: any) {
    console.error("auth check error", e)
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
