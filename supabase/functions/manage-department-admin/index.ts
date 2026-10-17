import {
  authorizeSuperAdmin,
  jsonResponse,
  optionsResponse,
} from '../_shared/admin-auth.ts';

type Action = 'suspend' | 'restore' | 'remove';

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
      return jsonResponse(request, { error: 'Invalid admin management request.' }, 400);
    }

    const { action, adminId } = body as Record<string, unknown>;
    if (
      !['suspend', 'restore', 'remove'].includes(String(action)) ||
      typeof adminId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(adminId)
    ) {
      return jsonResponse(request, { error: 'Choose a valid department admin and action.' }, 400);
    }
    if (adminId === caller.id) {
      return jsonResponse(request, { error: 'You cannot change or remove your own Super Admin account.' }, 400);
    }

    const { data: target, error: targetError } = await client
      .from('admin_profiles')
      .select('id, email, role, is_active')
      .eq('id', adminId)
      .maybeSingle();
    if (targetError) {
      console.error('Could not load target admin profile:', targetError.message);
      return jsonResponse(request, { error: 'Could not load the selected admin account.' }, 500);
    }
    if (!target || target.role !== 'admin') {
      return jsonResponse(request, { error: 'Department admin not found.' }, 404);
    }

    if (action === 'remove') {
      const { data: ownedEvents, error: eventsError } = await client
        .from('events')
        .select('id')
        .eq('created_by', adminId);
      if (eventsError) {
        console.error('Could not transfer owned events before account removal:', eventsError.message);
        return jsonResponse(request, { error: 'Could not safely prepare this account for removal.' }, 500);
      }

      const eventIds = (ownedEvents ?? []).map((event) => event.id);
      if (eventIds.length > 0) {
        const { error: eventTransferError } = await client
          .from('events')
          .update({ created_by: caller.id })
          .in('id', eventIds);
        if (eventTransferError) {
          console.error('Could not transfer department events:', eventTransferError.message);
          return jsonResponse(request, { error: 'Could not transfer this admin’s events to the Super Admin.' }, 500);
        }
        const { error: certificateTransferError } = await client
          .from('certificates')
          .update({ created_by: caller.id })
          .in('event_id', eventIds);
        if (certificateTransferError) {
          console.error('Could not transfer certificates before account removal:', certificateTransferError.message);
          return jsonResponse(request, { error: 'Could not transfer this admin’s certificates to the Super Admin.' }, 500);
        }
      }

      const { error: deleteError } = await client.auth.admin.deleteUser(adminId);
      if (deleteError) {
        console.error('Supabase Auth could not remove department admin:', deleteError.message);
        return jsonResponse(request, { error: 'The department admin login could not be removed.' }, 500);
      }
      return jsonResponse(request, { ok: true, action, adminId, transferredEvents: eventIds.length });
    }

    const shouldBeActive = action === 'restore';
    const { error: authUpdateError } = await client.auth.admin.updateUserById(adminId, {
      ban_duration: shouldBeActive ? 'none' : '876000h',
    });
    if (authUpdateError) {
      console.error('Could not update department-admin Auth access:', authUpdateError.message);
      return jsonResponse(request, { error: 'The login access status could not be updated.' }, 500);
    }

    const { error: profileUpdateError } = await client
      .from('admin_profiles')
      .update({ is_active: shouldBeActive })
      .eq('id', adminId)
      .eq('role', 'admin');
    if (profileUpdateError) {
      const { error: rollbackError } = await client.auth.admin.updateUserById(adminId, {
        ban_duration: shouldBeActive ? '876000h' : 'none',
      });
      console.error('Admin profile access update failed:', {
        profileError: profileUpdateError.message,
        authRollbackError: rollbackError?.message,
      });
      return jsonResponse(request, { error: 'Login and admin-profile access could not be synchronized.' }, 500);
    }

    return jsonResponse(request, { ok: true, action, adminId, is_active: shouldBeActive });
  } catch (error: unknown) {
    console.error(
      'Unexpected department-admin management error:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return jsonResponse(request, { error: 'Unexpected admin management error. Please try again.' }, 500);
  }
});
