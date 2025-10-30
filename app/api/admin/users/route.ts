import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    // Use admin API to list users
    // Newer supabase-js exposes auth.admin.listUsers()
    // Fallback: query auth.users directly
    let users: any = null

    if (supabase.auth && (supabase.auth as any).admin && typeof (supabase.auth as any).admin.listUsers === "function") {
      const res = await (supabase.auth as any).admin.listUsers({ perPage: 200 })
      if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 })
      users = res.data?.users || res.data || []
    } else {
      const { data, error } = await supabase.from("auth.users").select("id, email, raw_user_meta_data, user_metadata")
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      users = data || []
    }

    const mapped = (users || []).map((u: any) => ({ id: u.id, email: u.email, display_name: (u.user_metadata && u.user_metadata.display_name) || (u.raw_user_meta_data && u.raw_user_meta_data.display_name) || null }))

    return NextResponse.json({ users: mapped })
  } catch (e: any) {
    console.error("admin users list error", e)
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
