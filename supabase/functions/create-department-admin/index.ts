import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const appOrigin = 'https://agrirefreshes-lgtm.github.io';
const allowedOrigins = new Set([
  appOrigin,
  'http://localhost:5173',
  'http://localhost:4173',
]);

const headersFor = (request: Request): HeadersInit => {
  const requestOrigin = request.headers.get('origin');
  return {
    'Access-Control-Allow-Origin':
      requestOrigin && allowedOrigins.has(requestOrigin) ? requestOrigin : appOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    Vary: 'Origin',
  };
};

const json = (request: Request, body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: headersFor(request) });

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: headersFor(request) });
  }
  if (request.method !== 'POST') {
    return json(request, { error: 'Method not allowed' }, 405);
  }
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Admin creation function is missing Supabase server credentials.');
    return json(request, { error: 'Admin account service is not configured.' }, 500);
  }

  try {
    const authorization = request.headers.get('authorization');
    const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) {
      return json(request, { error: 'Sign in again before creating an admin.' }, 401);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: callerData, error: callerError } = await supabase.auth.getUser(accessToken);
    if (callerError || !callerData.user) {
      return json(request, { error: 'Your session is invalid or expired. Sign in again.' }, 401);
    }

    const { data: callerProfile, error: profileLookupError } = await supabase
      .from('admin_profiles')
      .select('role, is_active')
      .eq('id', callerData.user.id)
      .maybeSingle();
    if (profileLookupError) {
      console.error('Could not verify admin creator profile:', profileLookupError.message);
      return json(request, { error: 'Could not verify your administrator access.' }, 500);
    }
    if (callerProfile?.role !== 'super_admin' || callerProfile.is_active !== true) {
      return json(request, { error: 'Only an active Super Admin can create department admins.' }, 403);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json(request, { error: 'Request body must be valid JSON.' }, 400);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json(request, { error: 'Invalid admin account details.' }, 400);
    }

    const input = body as Record<string, unknown>;
    if (
      typeof input.email !== 'string' ||
      typeof input.password !== 'string' ||
      (input.department !== undefined && typeof input.department !== 'string')
    ) {
      return json(request, { error: 'Email, password, and department must be text values.' }, 400);
    }
    const email = input.email.trim().toLowerCase();
    const password = input.password;
    const department =
      (typeof input.department === 'string' ? input.department.trim() : '') ||
      'Academic Department';

    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return json(request, { error: 'A valid email address is required.' }, 400);
    }
    if (password.length < 6) {
      return json(request, { error: 'Password must be at least 6 characters.' }, 400);
    }
    if (department.length > 160) {
      return json(request, { error: 'Department name must be 160 characters or fewer.' }, 400);
    }

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { department },
    });
    if (createError || !created.user) {
      if (
        createError?.status === 409 ||
        /already|exists|registered/i.test(createError?.message ?? '')
      ) {
        return json(request, { error: 'A login account with this email already exists.' }, 409);
      }
      console.error('Supabase Auth could not create department admin:', createError?.message);
      return json(request, { error: createError?.message || 'Could not create the login account.' }, 400);
    }

    const { error: profileInsertError } = await supabase.from('admin_profiles').insert({
      id: created.user.id,
      email,
      role: 'admin',
      department,
      is_active: true,
    });
    if (profileInsertError) {
      const { error: rollbackError } = await supabase.auth.admin.deleteUser(created.user.id);
      if (rollbackError) {
        console.error('Admin profile insert and Auth rollback both failed:', {
          profileError: profileInsertError.message,
          rollbackError: rollbackError.message,
        });
        return json(
          request,
          { error: 'Account creation was incomplete and automatic cleanup failed. Contact support before retrying.' },
          500,
        );
      }
      console.error('Admin profile insert failed; Auth user was rolled back:', profileInsertError.message);
      return json(request, { error: 'Could not save the admin profile. The incomplete account was removed.' }, 500);
    }

    return json(request, { id: created.user.id, email });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    console.error('Unexpected department-admin creation error:', message);
    return json(request, { error: 'Unexpected account service error. Please try again.' }, 500);
  }
});
