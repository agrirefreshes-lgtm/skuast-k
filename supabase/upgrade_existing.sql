-- Upgrade an EXISTING project to the current schema.
-- Supabase Dashboard → SQL Editor → run this entire file once.
-- Fresh projects should run schema.sql instead.

create extension if not exists pgcrypto;

-- FIX-2: admin_profiles me is_active column
-- false = admin ka access temporarily suspended (sign-in block)
alter table public.admin_profiles
  add column if not exists is_active boolean not null default true;

alter table public.certificates
  add column if not exists uploaded_certificate_no text;
create index if not exists idx_certs_uploaded
  on public.certificates (uploaded_certificate_no);

-- Apply the same public-read / authenticated-write policies as fresh installs.
alter table public.admin_profiles enable row level security;
alter table public.events enable row level security;
alter table public.certificates enable row level security;

revoke insert, update, delete on public.events from public, anon;
revoke insert, update, delete on public.certificates from public, anon;
grant select on public.events to anon;
grant all on public.events to authenticated;
grant select on public.certificates to anon;
grant all on public.certificates to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;

drop policy if exists "public read events" on public.events;
drop policy if exists "authenticated read events" on public.events;
create policy "public read events"
  on public.events for select
  to anon
  using (is_published = true);
create policy "authenticated read events"
  on public.events for select
  to authenticated
  using (true);
drop policy if exists "open write events" on public.events;
drop policy if exists "authenticated write events" on public.events;
create policy "authenticated write events"
  on public.events for all
  to authenticated
  using (true) with check (true);
revoke insert, update, delete on public.events from public, anon;

drop policy if exists "public read certificates" on public.certificates;
drop policy if exists "authenticated read certificates" on public.certificates;
create policy "public read certificates"
  on public.certificates for select
  to anon
  using (true);
create policy "authenticated read certificates"
  on public.certificates for select
  to authenticated
  using (true);
drop policy if exists "open write certificates" on public.certificates;
drop policy if exists "authenticated write certificates" on public.certificates;
create policy "authenticated write certificates"
  on public.certificates for all
  to authenticated
  using (true) with check (true);
revoke insert, update, delete on public.certificates from public, anon;

drop policy if exists "open update templates" on storage.objects;
drop policy if exists "open delete templates" on storage.objects;
drop policy if exists "authenticated upload templates" on storage.objects;
drop policy if exists "authenticated update templates" on storage.objects;
drop policy if exists "authenticated delete templates" on storage.objects;
drop policy if exists "public read templates" on storage.objects;
create policy "public read templates"
  on storage.objects for select
  using (bucket_id = 'templates');
create policy "authenticated upload templates"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'templates');
create policy "authenticated update templates"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'templates') with check (bucket_id = 'templates');
create policy "authenticated delete templates"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'templates');

-- Profile writes must stay server/database-only. A self-update policy is
-- insufficient because it still allows changing the caller's role.
alter table public.admin_profiles enable row level security;
drop policy if exists "public read admin_profiles" on public.admin_profiles;
drop policy if exists "open insert admin_profiles" on public.admin_profiles;
drop policy if exists "open update admin_profiles" on public.admin_profiles;
drop policy if exists "self update admin_profiles" on public.admin_profiles;
drop policy if exists "authenticated read admin_profiles" on public.admin_profiles;
create policy "authenticated read admin_profiles"
  on public.admin_profiles for select
  to authenticated
  using (true);
revoke all on public.admin_profiles from public, anon;
revoke insert, update, delete on public.admin_profiles from authenticated;
grant select on public.admin_profiles to authenticated;

-- Admin Auth users must be created through the server-side Auth Admin API,
-- never by inserting directly into Supabase's internal auth tables.
drop function if exists public.create_department_admin(text, text, text);

-- FIX-3: SuperAdmin → suspend / restore department admin
create or replace function public.set_admin_access(
  p_admin_id uuid,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_caller uuid := auth.uid();
  v_is_super boolean;
begin
  v_is_super := v_caller is not null and exists (
    select 1 from public.admin_profiles
    where id = v_caller and role = 'super_admin' and is_active = true
  );

  if not v_is_super then
    raise exception 'Only the Super Admin can change admin access';
  end if;

  if p_admin_id = v_caller then
    raise exception 'You cannot suspend your own account';
  end if;

  update public.admin_profiles
    set is_active = p_active
  where id = p_admin_id and role = 'admin';

  if not found then
    raise exception 'Department admin not found';
  end if;

  -- Best-effort: active sessions turant revoke (suspend = immediate logout).
  -- Kuch Supabase versions me ye tables alag hain — isliye fail-soft.
  begin
    delete from auth.refresh_tokens where user_id = p_admin_id;
  exception when others then null;
  end;
  begin
    delete from auth.sessions where user_id = p_admin_id;
  exception when others then null;
  end;

  return jsonb_build_object('id', p_admin_id, 'is_active', p_active);
end;
$$;

-- FIX-4: SuperAdmin → permanently remove department admin
-- auth.users delete → admin_profiles (ON DELETE CASCADE) apne aap chala jata hai.
-- Events/certificates safe rehte hain (created_by → NULL set hota hai).
create or replace function public.remove_department_admin(
  p_admin_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_caller uuid := auth.uid();
  v_is_super boolean;
  v_email text;
begin
  v_is_super := v_caller is not null and exists (
    select 1 from public.admin_profiles
    where id = v_caller and role = 'super_admin' and is_active = true
  );

  if not v_is_super then
    raise exception 'Only the Super Admin can remove admin accounts';
  end if;

  if p_admin_id = v_caller then
    raise exception 'You cannot remove your own account';
  end if;

  select email into v_email
    from public.admin_profiles
   where id = p_admin_id and role = 'admin';

  if v_email is null then
    raise exception 'Department admin not found';
  end if;

  -- Sessions/refresh tokens bhi saaf (fail-soft)
  begin
    delete from auth.refresh_tokens where user_id = p_admin_id;
  exception when others then null;
  end;
  begin
    delete from auth.sessions where user_id = p_admin_id;
  exception when others then null;
  end;

  -- Login account hi delete (admin_profiles cascade)
  delete from auth.users where id = p_admin_id;

  return jsonb_build_object('id', p_admin_id, 'email', v_email, 'removed', true);
end;
$$;

-- =====================================================================
-- FIX-5: REPAIR — admin accounts missing their email identity row.
-- Restrict the repair to existing department-admin profiles; this does not
-- reset passwords and cannot repair an incorrect password hash.
insert into auth.identities (
  provider_id, user_id, identity_data, provider,
  created_at, updated_at
)
select u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now()
from auth.users u
join public.admin_profiles ap on ap.id = u.id and ap.role = 'admin'
where u.email is not null
  and not exists (
    select 1 from auth.identities i
    where i.user_id = u.id and i.provider = 'email'
  );

-- SECURITY DEFINER admin RPCs must not be executable by anon or PUBLIC.
revoke all on function public.set_admin_access(uuid, boolean) from public, anon, authenticated;
revoke all on function public.remove_department_admin(uuid) from public, anon, authenticated;
grant execute on function public.set_admin_access(uuid, boolean) to authenticated;
grant execute on function public.remove_department_admin(uuid) to authenticated;

-- =====================================================================
-- VERIFY (optional):
--   select email, role, is_active from public.admin_profiles order by created_at;
--   select proname, prosecdef from pg_proc
--     where proname in ('set_admin_access','remove_department_admin');
-- Verify public reads, admin login, and Super Admin suspend/remove actions.
-- =====================================================================
