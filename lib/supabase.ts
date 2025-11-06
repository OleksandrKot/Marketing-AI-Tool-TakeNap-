import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Auth will not work until these are set.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Create a Supabase client for server-side usage
export const createServerSupabaseClient = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('🔧 Supabase URL:', url ? '✅ Set' : '❌ Missing');
  console.log('🔧 Supabase Key:', key ? '✅ Set' : '❌ Missing');

  if (!url || !key) {
    console.error('❌ Missing Supabase environment variables! Returning a stubbed client.');
    return createClient(url || '', key || '');
  }

  return createClient(url, key);
};

// Create a Supabase client for client-side usage
export const createClientSupabaseClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('❌ Missing public Supabase environment variables!');
    throw new Error('Missing public Supabase environment variables');
  }

  return createClient(url, key);
};
