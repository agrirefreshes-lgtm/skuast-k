-- =====================================================================
-- SKUAST-K Certificate System — Fresh Supabase Schema (RUN ONCE)
-- Supabase Dashboard → SQL Editor → New Query → paste FULL file → Run
-- =====================================================================
-- Creates: admin_profiles, events, certificates, storage bucket
--          templates/, RLS policies (anon-key app compatible),
--          RPC create_department_admin(p_email, p_password, p_department)
-- App uses PUBLIC anon key directly, isliye policies permissive hain.
-- Secrets kabhi git me mat dalo (.env gitignored hai).
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
  status text not null default 'verified'
    check (status in ('verified', 'cancelled')),
  data jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_certs_event
  on public.certificates (event_id, created_at);
create index if not exists idx_certs_batch on public.certificates (batch_id);
-- 4. Row Level Security ON + anon-key compatible policies
-- (App sirf anon key use karta hai, isliye public read + open write.)
alter table public.admin_profiles enable row level security;
alter table public.events enable row level security;
alter table public.certificates enable row level security;

drop policy if exists "public read admin_profiles" on public.admin_profiles;
create policy "public read admin_profiles"
  on public.admin_profiles for select using (true);

drop policy if exists "open insert admin_profiles" on public.admin_profiles;
create policy "open insert admin_profiles"
  on public.admin_profiles for insert with check (true);

drop policy if exists "open update admin_profiles" on public.admin_profiles;
create policy "open update admin_profiles"
  on public.admin_profiles for update using (true) with check (true);

drop policy if exists "public read events" on public.events;
create policy "public read events"
  on public.events for select using (true);

drop policy if exists "open write events" on public.events;
create policy "open write events"
  on public.events for all using (true) with check (true);

drop policy if exists "public read certificates" on public.certificates;
create policy "public read certificates"
  on public.certificates for select using (true);

drop policy if exists "open write certificates" on public.certificates;
create policy "open write certificates"
  on public.certificates for all using (true) with check (true);

-- 5. Storage bucket templates/ (certificate blank formats)
insert into storage.buckets (id, name, public)
values ('templates', 'templates', true)
on conflict (id) do update set public = true;

drop policy if exists "public read templates" on storage.objects;
create policy "public read templates"
  on storage.objects for select
  using (bucket_id = 'templates');

drop policy if exists "open upload templates" on storage.objects;
create policy "open upload templates"
  on storage.objects for insert
  with check (bucket_id = 'templates');

drop policy if exists "open update templates" on storage.objects;
create policy "open update templates"
  on storage.objects for update
  using (bucket_id = 'templates') with check (bucket_id = 'templates');

drop policy if exists "open delete templates" on storage.objects;
create policy "open delete templates"
  on storage.objects for delete
  using (bucket_id = 'templates');

-- 6. RPC: SuperAdmin → Department Admin create
-- SECURITY DEFINER taaki anon-key se naya auth user + profile ban sake.
-- NOTE: ye open hai; sirf SuperAdmin email se call karo (UI enforce karta hai).
create or replace function public.create_department_admin(
  p_email text,
  p_password text,
  p_department text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  if p_email is null or btrim(p_email) = '' then
    raise exception 'Email required';
  end if;
  if p_password is null or char_length(p_password) < 6 then
    raise exception 'Password min 6 chars required';
  end if;

  -- auth.users me naya login create
  v_uid := gen_random_uuid();
  insert into auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, role
  ) values (
    v_uid, '00000000-0000-0000-0000-000000000000',
    lower(btrim(p_email)),
    crypt(p_password, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb, false, 'authenticated'
  );

  -- admin_profiles row (role = admin)
  insert into public.admin_profiles (id, email, role, department)
  values (v_uid, lower(btrim(p_email)), 'admin', coalesce(nullif(btrim(p_department), ''), 'Academic Department'))
  on conflict (id) do update
    set email = excluded.email,
        department = excluded.department;

  return jsonb_build_object('id', v_uid, 'email', lower(btrim(p_email)));
end;
$$;

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
