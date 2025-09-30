import { createClient } from "@supabase/supabase-js"

// Створюємо клієнт Supabase для використання на стороні сервера
export const createServerSupabaseClient = () => {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  console.log("🔧 Supabase URL:", url ? "✅ Set" : "❌ Missing")
  console.log("🔧 Supabase Key:", key ? "✅ Set" : "❌ Missing")

  if (!url || !key) {
    console.error("❌ Missing Supabase environment variables!")
    throw new Error("Missing Supabase environment variables")
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
