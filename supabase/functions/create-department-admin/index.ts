import {
  authorizeSuperAdmin,
  jsonResponse,
  optionsResponse,
} from '../_shared/admin-auth.ts';

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return optionsResponse(request);
  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'Method not allowed.' }, 405);
  }

  try {
    const result = await authorizeSuperAdmin(request);
    if (result.error) return result.error;
    const { client, user: caller } = result.authorized;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(request, { error: 'Request body must be valid JSON.' }, 400);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return jsonResponse(request, { error: 'Invalid admin account details.' }, 400);
    }

    const input = body as Record<string, unknown>;
    if (
      typeof input.email !== 'string' ||
      typeof input.password !== 'string' ||
      (input.department !== undefined && typeof input.department !== 'string')
    ) {
      return jsonResponse(request, { error: 'Email, password, and department must be text values.' }, 400);
    }

    const email = input.email.trim().toLowerCase();
    const password = input.password;
    const department =
      (typeof input.department === 'string' ? input.department.trim() : '') ||
      'Academic Department';

    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse(request, { error: 'A valid email address is required.' }, 400);
    }
    if (password.length < 8) {
      return jsonResponse(request, { error: 'Password must be at least 8 characters.' }, 400);
    }
    if (department.length > 160) {
      return jsonResponse(request, { error: 'Department name must be 160 characters or fewer.' }, 400);
    }

    const { data: created, error: createError } = await client.auth.admin.createUser({
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
        return jsonResponse(request, { error: 'A login account with this email already exists.' }, 409);
      }
      console.error('Supabase Auth could not create department admin:', createError?.message);
      return jsonResponse(
        request,
        { error: createError?.message || 'Supabase Auth could not create the login account.' },
        400,
      );
    }

    const { error: profileError } = await client.from('admin_profiles').insert({
      id: created.user.id,
      email,
      role: 'admin',
      department,
      is_active: true,
    });
    if (profileError) {
      const { error: rollbackError } = await client.auth.admin.deleteUser(created.user.id);
      if (rollbackError) {
        console.error('Profile insert and Auth rollback both failed:', {
          profileError: profileError.message,
          rollbackError: rollbackError.message,
        });
        return jsonResponse(
          request,
          { error: 'Admin profile creation and account cleanup both failed. Contact support before retrying.' },
          500,
        );
      }
      console.error('Admin profile insert failed; Auth user was rolled back:', profileError.message);
      return jsonResponse(
        request,
        { error: 'Could not save the admin profile. The incomplete login account was removed.' },
        500,
      );
    }

    return jsonResponse(request, {
      ok: true,
      admin: {
        id: created.user.id,
        email,
        role: 'admin',
        department,
        is_active: true,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    console.error('Unexpected department-admin creation error:', message);
    return jsonResponse(request, { error: 'Unexpected account service error. Please try again.' }, 500);
  }
});
