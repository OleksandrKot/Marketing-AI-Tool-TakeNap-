import { createClient } from '@supabase/supabase-js';
import { log } from './logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  log.error(
    '[supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Auth will not work until these are set.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Create a Supabase client for server-side usage
export const createServerSupabaseClient = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  log.info('🔧 Supabase URL:', url ? '✅ Set' : '❌ Missing');
  log.info('🔧 Supabase Key:', key ? '✅ Set' : '❌ Missing');

  if (!url || !key) {
    log.error('❌ Missing Supabase environment variables!');
    throw new Error(
      'Missing server Supabase environment variables SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  return createClient(url, key);
};

// Create a Supabase client for client-side usage
export const createClientSupabaseClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    log.error('❌ Missing public Supabase environment variables!');
    throw new Error('Missing public Supabase environment variables');
  }

  return createClient(url, key);
};
