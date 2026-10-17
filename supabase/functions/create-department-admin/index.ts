// supabase/functions/create-department-admin/index.ts
//
// PERMANENT FIX: department admin creation via official Auth Admin API.
// Kyon: direct auth.users SQL inserts me hashing / auth.identities rows
// chhoot jaate hain (bane hue admins login nahi kar paate — "Invalid
// University Email or Password!"). GoTrue ka admin.createUser() ye sab
// server-side handle karta hai, aur future ke auth-schema changes par bhi
// nahi tootega (raw SQL toot jata hai).
//
// Caller check: platform verify_jwt ke baad, yahan dobara super-admin
// verify hota hai (admin_profiles row OR superadmin-pattern email).
//
// Deploy (2 options):
//   A) Dashboard (sabse aasaan — koi secret setup nahi chahiye):
//      Supabase Dashboard → Edge Functions → New Function → naam:
//      create-department-admin → ye poori file paste karo → Deploy.
//      (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY platform khud inject karta hai.)
//   B) CLI: supabase link --project-ref <ref> && supabase functions deploy
//      create-department-admin   (config.toml me verify_jwt = true rakho)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: 'Server misconfigured (service key missing)' }, 500);
  }

  try {
    // 1) Caller kaun hai — user JWT verify karo
    const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'Missing authorization. Please sign in again.' }, 401);

    const db = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: callerData, error: callerErr } = await db.auth.getUser(jwt);
    const caller = callerData?.user;
    if (callerErr || !caller) {
      return json({ error: 'Invalid session. Please sign in again.' }, 401);
    }

    // 2) Sirf Super Admin aage badhe (dashboard ke isSuper rule se match)
    const { data: callerProfile } = await db
      .from('admin_profiles')
      .select('role')
      .eq('id', caller.id)
      .maybeSingle();
    const callerEmail = (caller.email || '').toLowerCase();
    const isSuper =
      callerProfile?.role === 'super_admin' || callerEmail.includes('superadmin');
    if (!isSuper) {
      return json({ error: 'Only the Super Admin can create department admins' }, 403);
    }

    // 3) Input validate
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? '').trim().toLowerCase();
    const password = String(body?.password ?? '').trim();
    const department = String(body?.department ?? '').trim() || 'Academic Department';
    if (!email || !email.includes('@')) {
      return json({ error: 'Valid official email is required' }, 400);
    }
    if (!password || password.length < 6) {
      return json({ error: 'Password must be at least 6 characters' }, 400);
    }

    // 4) Official Auth Admin API — hashing + identities GoTrue khud banata hai
    const { data: created, error: createErr } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { department },
    });
    if (createErr || !created?.user) {
      const raw = String(createErr?.message || '').toLowerCase();
      const status = (createErr as { status?: number } | null)?.status;
      if (
        raw.includes('already') ||
        raw.includes('exists') ||
        raw.includes('registered') ||
        status === 409 ||
        status === 422
      ) {
        return json({ error: `Login account with email ${email} already exists` }, 409);
      }
      return json({ error: createErr?.message || 'Could not create the login account' }, 400);
    }

    // 5) Profile row; fail ho to auth user wapas hatao (orphan account nahi)
    const { error: profErr } = await db.from('admin_profiles').upsert(
      { id: created.user.id, email, role: 'admin', department, is_active: true },
      { onConflict: 'id' }
    );
    if (profErr) {
      try {
        await db.auth.admin.deleteUser(created.user.id);
      } catch {
        /* best effort rollback */
      }
      return json({ error: profErr.message || 'Could not save the admin profile' }, 500);
    }

    return json({ id: created.user.id, email }, 200);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unexpected error';
    return json({ error: msg }, 500);
  }
});
