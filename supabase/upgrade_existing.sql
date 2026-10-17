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

-- Apply active-role and event-ownership policies from the fresh schema.
alter table public.admin_profiles enable row level security;
alter table public.events enable row level security;
alter table public.certificates enable row level security;

create or replace function public.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.admin_profiles ap
    where ap.id = auth.uid() and ap.is_active = true
      and ap.role in ('admin', 'super_admin')
  );
$$;

create or replace function public.is_active_super_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.admin_profiles ap
    where ap.id = auth.uid() and ap.is_active = true
      and ap.role = 'super_admin'
  );
$$;

create or replace function public.can_manage_event(p_event_id text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.is_active_admin() and exists (
    select 1 from public.events e
    where e.id = p_event_id
      and (e.created_by = auth.uid() or public.is_active_super_admin())
  );
$$;

create or replace function public.can_manage_template_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.is_active_admin() and exists (
    select 1 from public.events e
    where (
      position('/templates/' || p_name in e.template_url) > 0
      or left(p_name, length(e.id) + 1) = e.id || '-'
      or left(p_name, length(e.id) + 1) = e.id || '/'
    )
      and (e.created_by = auth.uid() or public.is_active_super_admin())
  );
$$;

revoke all on function public.is_active_admin() from public, anon;
revoke all on function public.is_active_super_admin() from public, anon;
revoke all on function public.can_manage_event(text) from public, anon;
revoke all on function public.can_manage_template_object(text) from public, anon;
grant execute on function public.is_active_admin() to authenticated;
grant execute on function public.is_active_super_admin() to authenticated;
grant execute on function public.can_manage_event(text) to authenticated;
grant execute on function public.can_manage_template_object(text) to authenticated;

revoke all on public.events from public, anon, authenticated;
grant select on public.events to anon, authenticated;
grant insert, update, delete on public.events to authenticated;
revoke all on public.certificates from public, anon, authenticated;
grant select, insert, update, delete on public.certificates to authenticated;
grant select on storage.objects to anon, authenticated;
grant insert, update, delete on storage.objects to authenticated;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where (schemaname = 'public' and tablename in ('admin_profiles', 'events', 'certificates'))
      or (
        schemaname = 'storage' and tablename = 'objects'
        and (
          policyname ilike '%template%'
          or coalesce(qual, '') ilike '%templates%'
          or coalesce(with_check, '') ilike '%templates%'
        )
      )
  loop
    execute format('drop policy %I on %I.%I', policy_record.policyname, policy_record.schemaname, policy_record.tablename);
  end loop;
end $$;

drop policy if exists "public read events" on public.events;
drop policy if exists "authenticated read events" on public.events;
drop policy if exists "open write events" on public.events;
drop policy if exists "authenticated write events" on public.events;
drop policy if exists "active admins insert owned events" on public.events;
drop policy if exists "active admins update owned events" on public.events;
drop policy if exists "active admins delete owned events" on public.events;
create policy "public read events"
  on public.events for select
  to anon
  using (is_published = true);
create policy "authenticated read events"
  on public.events for select
  to authenticated
  using (public.is_active_admin() and (created_by = auth.uid() or public.is_active_super_admin()));
create policy "active admins insert owned events"
  on public.events for insert
  to authenticated
  with check (public.is_active_admin() and created_by = auth.uid());
create policy "active admins update owned events"
  on public.events for update
  to authenticated
  using (public.can_manage_event(id))
  with check (public.is_active_admin() and (created_by = auth.uid() or public.is_active_super_admin()));
create policy "active admins delete owned events"
  on public.events for delete
  to authenticated
  using (public.can_manage_event(id));

drop policy if exists "public read certificates" on public.certificates;
drop policy if exists "authenticated read certificates" on public.certificates;
drop policy if exists "open write certificates" on public.certificates;
drop policy if exists "authenticated write certificates" on public.certificates;
drop policy if exists "active admins insert owned certificates" on public.certificates;
drop policy if exists "active admins update owned certificates" on public.certificates;
drop policy if exists "active admins delete owned certificates" on public.certificates;
create policy "authenticated read certificates"
  on public.certificates for select
  to authenticated
  using (public.can_manage_event(event_id));
create policy "active admins insert owned certificates"
  on public.certificates for insert
  to authenticated
  with check (public.can_manage_event(event_id) and created_by = auth.uid());
create policy "active admins update owned certificates"
  on public.certificates for update
  to authenticated
  using (public.can_manage_event(event_id))
  with check (
    public.can_manage_event(event_id) and
    (created_by = auth.uid() or public.is_active_super_admin())
  );
create policy "active admins delete owned certificates"
  on public.certificates for delete
  to authenticated
  using (public.can_manage_event(event_id));

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
  with check (bucket_id = 'templates' and public.can_manage_template_object(name));
create policy "authenticated update templates"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'templates' and public.can_manage_template_object(name))
  with check (bucket_id = 'templates' and public.can_manage_template_object(name));
create policy "authenticated delete templates"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'templates' and public.can_manage_template_object(name));

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
  using (id = auth.uid() or public.is_active_super_admin());
revoke all on public.admin_profiles from public, anon;
revoke insert, update, delete on public.admin_profiles from authenticated;
grant select on public.admin_profiles to authenticated;

-- Admin Auth users must be created through the server-side Auth Admin API,
-- never by inserting directly into Supabase's internal auth tables.
drop function if exists public.create_department_admin(text, text, text);
drop function if exists public.create_department_admin(text, text);
drop function if exists public.set_admin_access(uuid, boolean);
drop function if exists public.remove_department_admin(uuid);

-- =====================================================================
-- VERIFY (optional):
--   select email, role, is_active from public.admin_profiles order by created_at;
--   select proname, prosecdef from pg_proc
--     where proname in ('set_admin_access','remove_department_admin');
-- Verify public reads, admin login, and Super Admin suspend/remove actions.
-- =====================================================================
