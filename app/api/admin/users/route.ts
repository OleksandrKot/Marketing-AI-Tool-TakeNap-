import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()

    // Optional email query param to filter a single user
    const email = request.nextUrl?.searchParams?.get("email") || null

    // Use admin API when possible; otherwise query auth.users directly
    let users: any[] = []

    if (email) {
      // If admin.listUsers exists, list and find by email
      if (supabase.auth && (supabase.auth as any).admin && typeof (supabase.auth as any).admin.listUsers === "function") {
        const res = await (supabase.auth as any).admin.listUsers({ perPage: 200 })
        if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 })
        const all = res.data?.users || res.data || []
        const found = (all || []).find((u: any) => (u.email || "").toLowerCase() === email.toLowerCase())
        if (found) users = [found]
      } else {
        // Fallback to GoTrue admin REST endpoint using service-role key to avoid PostgREST auth.users access
        const supabaseUrl = process.env.SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!supabaseUrl || !serviceKey) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
        const adminUrl = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users?email=${encodeURIComponent(email)}`
        try {
          const r = await fetch(adminUrl, { headers: { Authorization: `Bearer ${serviceKey}` } })
          if (!r.ok) {
            const text = await r.text().catch(() => '')
            console.error('GoTrue admin users request failed', r.status, text)
            return NextResponse.json({ error: `Admin lookup failed: ${r.status}` }, { status: 500 })
          }
          const payload = await r.json()
          users = Array.isArray(payload) ? payload : []
        } catch (e: any) {
          console.error('admin users REST error', e)
          return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
        }
      }
    } else {
      if (supabase.auth && (supabase.auth as any).admin && typeof (supabase.auth as any).admin.listUsers === "function") {
        const res = await (supabase.auth as any).admin.listUsers({ perPage: 200 })
        if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 })
        users = res.data?.users || res.data || []
      } else {
        // Fallback: use GoTrue admin REST to list users (may be paginated)
        const supabaseUrl = process.env.SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!supabaseUrl || !serviceKey) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
        const adminUrl = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users`
        try {
          const r = await fetch(adminUrl, { headers: { Authorization: `Bearer ${serviceKey}` } })
          if (!r.ok) {
            const text = await r.text().catch(() => '')
            console.error('GoTrue admin users list failed', r.status, text)
            return NextResponse.json({ error: `Admin list failed: ${r.status}` }, { status: 500 })
          }
          const payload = await r.json()
          users = Array.isArray(payload) ? payload : []
        } catch (e: any) {
          console.error('admin users REST error', e)
          return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
        }
      }
    }

    const mapped = (users || []).map((u: any) => ({ id: u.id, email: u.email, display_name: (u.user_metadata && u.user_metadata.display_name) || (u.raw_user_meta_data && u.raw_user_meta_data.display_name) || null }))

    return NextResponse.json({ users: mapped })
  } catch (e: any) {
    console.error("admin users list error", e)
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
