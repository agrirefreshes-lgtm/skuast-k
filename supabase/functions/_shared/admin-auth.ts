import { createClient, type SupabaseClient, type User } from 'https://esm.sh/@supabase/supabase-js@2';

const appOrigin = 'https://agrirefreshes-lgtm.github.io';
const allowedOrigins = new Set([
  appOrigin,
  'http://localhost:5173',
  'http://localhost:4173',
]);

export const responseHeaders = (request: Request): HeadersInit => {
  const origin = request.headers.get('origin');
  return {
    'Access-Control-Allow-Origin':
      origin && allowedOrigins.has(origin) ? origin : appOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    Vary: 'Origin',
  };
};

export const jsonResponse = (
  request: Request,
  body: unknown,
  status = 200,
): Response => new Response(JSON.stringify(body), {
  status,
  headers: responseHeaders(request),
});

export const optionsResponse = (request: Request): Response =>
  new Response('ok', { headers: responseHeaders(request) });

export type AuthorizedSuperAdmin = {
  client: SupabaseClient;
  user: User;
};

export const authorizeSuperAdmin = async (
  request: Request,
): Promise<{ authorized: AuthorizedSuperAdmin; error: null } | { authorized: null; error: Response }> => {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) {
    console.error('Admin function is missing Supabase server credentials.');
    return {
      authorized: null,
      error: jsonResponse(request, { error: 'Admin account service is not configured.' }, 500),
    };
  }

  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return {
      authorized: null,
      error: jsonResponse(request, { error: 'Sign in again to continue.' }, 401),
    };
  }

  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    return {
      authorized: null,
      error: jsonResponse(request, { error: 'Your session is invalid or expired. Sign in again.' }, 401),
    };
  }

  const { data: profile, error: profileError } = await client
    .from('admin_profiles')
    .select('role, is_active')
    .eq('id', data.user.id)
    .maybeSingle();
  if (profileError) {
    console.error('Could not verify admin profile:', profileError.message);
    return {
      authorized: null,
      error: jsonResponse(request, { error: 'Could not verify administrator access.' }, 500),
    };
  }
  if (profile?.role !== 'super_admin' || profile.is_active !== true) {
    return {
      authorized: null,
      error: jsonResponse(request, { error: 'Only an active Super Admin can perform this action.' }, 403),
    };
  }

  return { authorized: { client, user: data.user }, error: null };
};
