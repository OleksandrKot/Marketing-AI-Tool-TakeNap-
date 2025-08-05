import { createClient } from "@supabase/supabase-js"

// Створюємо клієнт Supabase для використання на стороні сервера
export const createServerSupabaseClient = () => {
  return createClient(process.env.SUPABASE_URL || "", process.env.SUPABASE_SERVICE_ROLE_KEY || "")
}

// Створюємо клієнт Supabase для використання на стороні клієнта
export const createClientSupabaseClient = () => {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "")
}
