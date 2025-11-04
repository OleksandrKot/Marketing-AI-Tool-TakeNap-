import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("[supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Auth will not work until these are set.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Створюємо клієнт Supabase для використання на стороні сервера
export const createServerSupabaseClient = () => {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  console.log("🔧 Supabase URL:", url ? "✅ Set" : "❌ Missing")
  console.log("🔧 Supabase Key:", key ? "✅ Set" : "❌ Missing")
  if (!url || !key) {
    console.error("❌ Missing Supabase environment variables! Returning a mock client for build/export.")

    // Minimal mock supabase client used during static export / local dev when
    // service keys are not available. It implements the small subset of the
    // supabase API used across the app (chainable .from(...).select()/insert()/order()/range()/eq()/in()/overlaps()/gte()/not()/single()).
    const fakeAds = [
      {
        id: 1,
        created_at: new Date().toISOString(),
        ad_archive_id: "FAKE123",
        page_name: "Lovescape - Dating App",
        text: "Fake ad text",
        caption: "Fake caption",
        cta_text: "Download",
        cta_type: "INSTALL_MOBILE_APP",
        display_format: "VIDEO",
        link_url: "https://example.com",
        title: "Fake Creative",
        video_hd_url: null,
        video_preview_image_url: "/placeholder.svg",
        publisher_platform: "Facebook",
        audio_script: null,
        video_script: "00:00 - Fake script",
        meta_ad_url: null,
        image_url: "/placeholder.svg",
        image_description: null,
        tags: ["demo"],
      },
    ]

    class MockQuery {
      table: string
      _single = false
      _insertPayload: any = null
      _filters: Array<any> = []
      _limit: number | null = null

      constructor(table: string) {
        this.table = table
      }

      select(_sel?: any) {
        return this
      }
      order() { return this }
      range() { return this }
      eq(field: string, val: any) { this._filters.push({ op: 'eq', field, val }); return this }
      gte(field: string, val: any) { this._filters.push({ op: 'gte', field, val }); return this }
      in(field: string, vals: any[]) { this._filters.push({ op: 'in', field, vals }); return this }
      overlaps(field: string, vals: any[]) { this._filters.push({ op: 'overlaps', field, vals }); return this }
      not() { return this }
      limit(n: number) { this._limit = n; return this }
      async insert(payload: any) { this._insertPayload = payload; return this }
      single() { this._single = true; return this }

      // allow awaiting the query directly: return shape similar to supabase client
      then(resolve: any, _reject?: any) {
        let data: any = []
        if (this.table === 'ads_library') {
          data = fakeAds.slice()
          // apply simple filters
          for (const f of this._filters) {
            if (f.op === 'eq') data = data.filter((d: any) => d[f.field] === f.val)
            if (f.op === 'in') data = data.filter((d: any) => f.vals.includes(d[f.field]))
            if (f.op === 'overlaps') data = data.filter((d: any) => Array.isArray(d[f.field]) && d[f.field].some((t: any) => f.vals.includes(t)))
            if (f.op === 'gte') data = data.filter((d: any) => new Date(d[f.field]) >= new Date(f.val))
          }
        }

        if (this._insertPayload) {
          const toInsert = Array.isArray(this._insertPayload) ? this._insertPayload[0] : this._insertPayload
          const newRow = { id: Date.now(), ...toInsert }
          data = newRow
        }

        const result = this._single ? { data: Array.isArray(data) ? data[0] || null : data, error: null } : { data, error: null, count: Array.isArray(data) ? data.length : null }
        // resolve as Promise
        return Promise.resolve(result).then(resolve)
      }
    }

    const mockSupabase: any = {
      from: (table: string) => new MockQuery(table),
      // minimal auth.admin.mock
      auth: {
        admin: {
          listUsers: async (opts?: any) => ({ data: { users: [] }, error: null }),
        },
      },
    }

    return mockSupabase
  }

  return createClient(url, key)
}

// Створюємо клієнт Supabase для використання на стороні клієнта
export const createClientSupabaseClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    console.error("❌ Missing public Supabase environment variables!")
    throw new Error("Missing public Supabase environment variables")
  }

  return createClient(url, key)
}
