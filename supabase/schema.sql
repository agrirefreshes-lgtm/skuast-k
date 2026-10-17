-- SKUAST-K Certificate System — Fresh Supabase Schema (RUN ONCE)
-- Supabase Dashboard → SQL Editor → New Query → paste FULL file → Run
-- =====================================================================
-- Creates: admin_profiles, events, certificates, storage bucket
--          templates/, RLS policies (anon-key app compatible),
--          role-aware row-level security and template storage policies
-- Browser uses the public anon key; RLS policies restrict public access.
-- Never put a service-role key in the frontend.
-- =====================================================================

-- 0. Extensions
create extension if not exists "pgcrypto";

-- 1. Admin profiles (id = auth.users.id)
create table if not exists public.admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  role text not null default 'admin'
    check (role in ('super_admin', 'admin')),
  department text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. Events (one bucket per event; layout JSONB me live-render hota hai)
create table if not exists public.events (
  id text primary key,
  name text not null,
  slug text unique not null,
  cert_prefix text not null default '',
  template_url text not null default '',
  fields jsonb not null default '[]'::jsonb,
  batches jsonb not null default '[]'::jsonb,
  primary_auth_field text not null default '',
  security_auth_field text not null default '',
  qr_config jsonb not null default '{}'::jsonb,
  cert_no_config jsonb not null default '{}'::jsonb,
  is_download_enabled boolean not null default true,
  is_published boolean not null default false,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_events_slug on public.events (slug);
create index if not exists idx_events_published
  on public.events (is_published, created_at desc);

-- 3. Certificates (Cert-No = certPrefix + 00001..99999, globally unique)
create table if not exists public.certificates (
  certificate_no text primary key,
  event_id text not null references public.events(id) on delete cascade,
  event_name text not null default '',
  batch_id text not null default '',
  issue_date date not null default current_date,
  uploaded_certificate_no text,
  status text not null default 'verified'
    check (status in ('verified', 'cancelled')),
  data jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_certs_event
  on public.certificates (event_id, created_at);
create index if not exists idx_certs_batch on public.certificates (batch_id);
create index if not exists idx_certs_uploaded
  on public.certificates (uploaded_certificate_no);
-- 4. Role-aware access control
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

revoke all on public.admin_profiles from public, anon;
grant select on public.admin_profiles to authenticated;
revoke insert, update, delete on public.admin_profiles from authenticated;
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

drop policy if exists "public read admin_profiles" on public.admin_profiles;
drop policy if exists "open insert admin_profiles" on public.admin_profiles;
drop policy if exists "open update admin_profiles" on public.admin_profiles;
drop policy if exists "self update admin_profiles" on public.admin_profiles;
drop policy if exists "authenticated read admin_profiles" on public.admin_profiles;
create policy "authenticated read admin_profiles"
  on public.admin_profiles for select
  to authenticated
  using (id = auth.uid() or public.is_active_super_admin());

drop policy if exists "public read events" on public.events;
drop policy if exists "authenticated read events" on public.events;
create policy "public read events"
  on public.events for select
  to anon
  using (is_published = true);
create policy "authenticated read events"
  on public.events for select
  to authenticated
  using (public.is_active_admin() and (created_by = auth.uid() or public.is_active_super_admin()));
drop policy if exists "open write events" on public.events;
drop policy if exists "authenticated write events" on public.events;
drop policy if exists "active admins insert owned events" on public.events;
drop policy if exists "active admins update owned events" on public.events;
drop policy if exists "active admins delete owned events" on public.events;
create policy "active admins insert owned events"
  on public.events for insert
  to authenticated
  with check (public.is_active_admin() and created_by = auth.uid());
create policy "active admins update owned events"
  on public.events for update
  to authenticated
  using (public.can_manage_event(id))
  with check (
    public.is_active_admin() and
    (created_by = auth.uid() or public.is_active_super_admin())
  );
create policy "active admins delete owned events"
  on public.events for delete
  to authenticated
  using (public.can_manage_event(id));

drop policy if exists "public read certificates" on public.certificates;
drop policy if exists "authenticated read certificates" on public.certificates;
create policy "authenticated read certificates"
  on public.certificates for select
  to authenticated
  using (public.can_manage_event(event_id));
drop policy if exists "open write certificates" on public.certificates;
drop policy if exists "authenticated write certificates" on public.certificates;
drop policy if exists "active admins insert owned certificates" on public.certificates;
drop policy if exists "active admins update owned certificates" on public.certificates;
drop policy if exists "active admins delete owned certificates" on public.certificates;
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

-- 5. Storage bucket templates/ (certificate blank formats)
insert into storage.buckets (id, name, public)
values ('templates', 'templates', true)
on conflict (id) do update set public = true;

drop policy if exists "public read templates" on storage.objects;
drop policy if exists "authenticated upload templates" on storage.objects;
drop policy if exists "authenticated update templates" on storage.objects;
drop policy if exists "authenticated delete templates" on storage.objects;
create policy "public read templates"
  on storage.objects for select
  using (bucket_id = 'templates');

drop policy if exists "open upload templates" on storage.objects;
create policy "authenticated upload templates"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'templates' and public.can_manage_template_object(name));

drop policy if exists "open update templates" on storage.objects;
create policy "authenticated update templates"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'templates' and public.can_manage_template_object(name))
  with check (bucket_id = 'templates' and public.can_manage_template_object(name));

drop policy if exists "open delete templates" on storage.objects;
create policy "authenticated delete templates"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'templates' and public.can_manage_template_object(name));

-- 7. Pehla SuperAdmin kaise banayein (MANUAL, SQL me ek baar):
-- Step A: App me nahi — Supabase Dashboard → Authentication → Users
--         → Add user → Create new user (superadmin email + strong password).
-- Step B: Neeche apna email likhkar RUN karo:
--   insert into public.admin_profiles (id, email, role, department)
--   select id, email, 'super_admin', 'Central Administration'
--   from auth.users where email = 'APNA_SUPERADMIN_EMAIL_YAHAN@skuastkashmir.ac.in'
--   on conflict (id) do update
--     set role = 'super_admin', department = 'Central Administration';
-- Uske baad /admin par login karo — Admin Console khul jayega.

-- DONE. Verify: Table Editor me 3 tables + Storage me templates bucket.
