import { createClient } from '@supabase/supabase-js';

// Supabase configuration
// For production: use VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables
// For local development/testing: use fallback values (documented for testing only)

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// In Node.js test environment, use fallback values for testing
// In browser/Vite: use environment variables injected by Vite
// Note: process.env only available in Node.js, not in browser TypeScript
let supabaseUrl: string;
let supabaseAnonKey: string;

if (isBrowser) {
  // Browser/Vite environment - import.meta.env is available
  supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://gjmmdmaliqjtqkkbifvx.supabase.co';
  supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_ou6vgoTXKJMzBfmFWYY15w_52gV4gYk';
} else {
  // Node.js test environment - use globals.process or fallback
  const proc = (globalThis as any)?.process;
  supabaseUrl = proc?.env?.VITE_SUPABASE_URL || 'https://gjmmdmaliqjtqkkbifvx.supabase.co';
  supabaseAnonKey = proc?.env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_ou6vgoTXKJMzBfmFWYY15w_52gV4gYk';
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Security middleware - log configuration on startup (dev only)
if (isBrowser && (import.meta as any).env?.DEV) {
  console.log('[Supabase] API URL configured:', supabaseUrl);
  console.log('[Supabase] Key prefix:', supabaseAnonKey.substring(0, 10) + '...');
} else if (!isBrowser) {
  console.log('[Supabase] Node.js test mode - using environment variables');
}
