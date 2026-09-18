import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gjmmdmaliqjtqkkbifvx.supabase.co';
const supabaseAnonKey = 'sb_publishable_ou6vgoTXKJMzBfmFWYY15w_52gV4gYk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);