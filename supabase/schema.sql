-- SKUAST-K Certificate System — Fresh Supabase Schema (RUN ONCE)
-- Supabase Dashboard → SQL Editor → New Query → paste FULL file → Run
-- =====================================================================
-- Creates: admin_profiles, events, certificates, storage bucket
--          templates/, RLS policies (anon-key app compatible),
--          RPCs for suspending/removing department admins
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
-- 4. Row Level Security ON + anon-key compatible policies
-- (Public certificate/event reads are available through the anon key.
-- Admin profile writes are never granted to browser roles.)
alter table public.admin_profiles enable row level security;
alter table public.events enable row level security;
alter table public.certificates enable row level security;

-- 4a. TABLE GRANTS (RLS policies ke SAATH ye bhi chahiye — warna 42501
-- "permission denied for table" aata hai; events par tha isliye wahi chal raha tha)
revoke all on public.admin_profiles from public, anon;
grant select on public.admin_profiles to authenticated;
revoke insert, update, delete on public.admin_profiles from authenticated;
grant select on public.events to anon;
grant all on public.events to authenticated;
grant select on public.certificates to anon;
grant all on public.certificates to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
revoke insert, update, delete on public.events from public, anon;
revoke insert, update, delete on public.certificates from public, anon;

drop policy if exists "public read admin_profiles" on public.admin_profiles;
drop policy if exists "open insert admin_profiles" on public.admin_profiles;
drop policy if exists "open update admin_profiles" on public.admin_profiles;
drop policy if exists "authenticated read admin_profiles" on public.admin_profiles;
create policy "authenticated read admin_profiles"
  on public.admin_profiles for select
  to authenticated
  using (true);

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
  with check (bucket_id = 'templates');

drop policy if exists "open update templates" on storage.objects;
create policy "authenticated update templates"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'templates') with check (bucket_id = 'templates');

drop policy if exists "open delete templates" on storage.objects;
create policy "authenticated delete templates"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'templates');

-- 6. RPC: SuperAdmin → suspend / restore department admin
-- is_active = false → admin ka access temporary stop (sign-in block).
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

  -- Best-effort: active sessions turant revoke (fail-soft)
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

-- 6b. RPC: SuperAdmin → permanently remove department admin
-- auth.users delete → admin_profiles ON DELETE CASCADE; events safe (created_by → NULL)
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

  delete from auth.users where id = p_admin_id;

  return jsonb_build_object('id', p_admin_id, 'email', v_email, 'removed', true);
end;
$$;

-- SECURITY DEFINER admin RPCs must not be executable by anon or PUBLIC.
revoke all on function public.set_admin_access(uuid, boolean) from public, anon, authenticated;
revoke all on function public.remove_department_admin(uuid) from public, anon, authenticated;
grant execute on function public.set_admin_access(uuid, boolean) to authenticated;
grant execute on function public.remove_department_admin(uuid) to authenticated;

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
