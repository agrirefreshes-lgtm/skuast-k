import { createClient } from '@supabase/supabase-js';

// Supabase configuration — sourced ONLY from environment variables.
// No hardcoded keys/URLs in source (the publishable key must never be
// committed). Provide them via a gitignored .env file locally, or via
// your host's environment variables in production (see .env.example).
//
//   VITE_SUPABASE_URL      e.g. https://xxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY the publishable (anon) key
//
// SECURITY NOTE: the publishable key is safe to expose in the browser
// bundle BY DESIGN — your data is protected by Row Level Security (see
// supabase/schema_secure_rls.sql). Never put a service_role / secret key
// in VITE_ variables or this file.

// Detect runtime so we can read env vars in the right way per environment.
const isBrowser = typeof window !== 'undefined';

const readEnv = (name: string): string | undefined => {
  if (isBrowser) {
    // Vite injects import.meta.env at build time
    return (import.meta as any).env?.[name];
  }
  // Node.js (tests): read from process if present
  const proc = (globalThis as any)?.process;
  return proc?.env?.[name];
};

const supabaseUrl = readEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = readEnv('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
  const where = isBrowser
    ? 'build-time import.meta.env'
    : 'process.env';
  throw new Error(
    `[Supabase] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in ${where}. ` +
      `Create a .env file from .env.example and set both values.`
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Dev-only sanity log (never logs the full key)
if (isBrowser && (import.meta as any).env?.DEV) {
  console.log('[Supabase] API URL configured:', supabaseUrl);
  console.log('[Supabase] Key prefix:', supabaseAnonKey.substring(0, 10) + '...');
} else if (!isBrowser) {
  console.log('[Supabase] Node.js test mode - using environment variables');
}
