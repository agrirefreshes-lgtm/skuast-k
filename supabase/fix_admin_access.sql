-- =====================================================================
-- FIX: gen_salt error + SuperAdmin access-control (suspend / remove admin)
-- Supabase Dashboard → SQL Editor → New Query → ye poori file paste → Run
--
-- Kya fix hota hai:
--   1. "function gen_salt(unknown) does not exist" — pgcrypto ke functions
--      Supabase me aksar `extensions` schema me hote hain, aur hamari RPC ka
--      search_path = public tha. Ab function dono schemas me dhoondta hai.
--   2. SuperAdmin ab department admin ko SUSPEND (temporary access stop)
--      aur REMOVE (permanently hata) sakta hai — naye RPC ke through.
--   3. Admin creation RPC is limited to active Super Admins; missing email
--      identity rows for existing department-admin profiles can be repaired.
-- =====================================================================

-- FIX-2: admin_profiles me is_active column
-- false = admin ka access temporarily suspended (sign-in block)
alter table public.admin_profiles
  add column if not exists is_active boolean not null default true;

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
revoke all on public.admin_profiles from anon;
revoke insert, update, delete on public.admin_profiles from authenticated;
grant select on public.admin_profiles to authenticated;

-- FIX-1: pgcrypto + create_department_admin recreate
-- (ye line no-op hai agar extension pehle se kahin bhi installed hai)
create extension if not exists pgcrypto;

create or replace function public.create_department_admin(
  p_email text,
  p_password text,
  p_department text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_uid uuid;
  v_email text := lower(btrim(p_email));
  v_department text := coalesce(nullif(btrim(p_department), ''), 'Academic Department');
begin
  if auth.uid() is null or not exists (
    select 1
    from public.admin_profiles ap
    where ap.id = auth.uid()
      and ap.role = 'super_admin'
      and ap.is_active = true
  ) then
    raise exception 'Only an active Super Admin can create department admins';
  end if;

  if v_email is null
     or length(v_email) > 254
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'A valid email address is required';
  end if;
  if p_password is null or char_length(p_password) < 6 then
    raise exception 'Password min 6 chars required';
  end if;
  if char_length(v_department) > 160 then
    raise exception 'Department name must be 160 characters or fewer';
  end if;

  -- Clear error agar login account pehle se exist karta hai
  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    raise exception 'Login account with this email already exists (%)', v_email;
  end if;

  -- auth.users me naya login create
  v_uid := gen_random_uuid();
  insert into auth.users (
    id, instance_id, aud, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, role
  ) values (
    v_uid, '00000000-0000-0000-0000-000000000000',
    'authenticated',
    v_email,
    crypt(p_password, gen_salt('bf', 10)),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('department', v_department), false, 'authenticated'
  );

  -- ZAROORI: auth.identities row. Bina iske Supabase Auth (GoTrue) password
  -- login me "Invalid login credentials" deta hai — user auth.users me
  -- hone ke bawajood, kyunki login identity table se hi lookup hota hai.
  insert into auth.identities (
    provider_id, user_id, identity_data, provider,
    created_at, updated_at
  ) values (
    v_uid::text, v_uid,
    jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
    'email', now(), now()
  );

  -- admin_profiles row (role = admin, is_active = true)
  insert into public.admin_profiles (id, email, role, department, is_active)
  values (v_uid, v_email, 'admin', v_department, true);

  return jsonb_build_object('id', v_uid, 'email', v_email);
end;
$$;

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
revoke all on function public.create_department_admin(text, text, text) from public, anon, authenticated;
revoke all on function public.set_admin_access(uuid, boolean) from public, anon, authenticated;
revoke all on function public.remove_department_admin(uuid) from public, anon, authenticated;
grant execute on function public.create_department_admin(text, text, text) to authenticated;
grant execute on function public.set_admin_access(uuid, boolean) to authenticated;
grant execute on function public.remove_department_admin(uuid) to authenticated;

-- =====================================================================
-- VERIFY (optional):
--   select email, role, is_active from public.admin_profiles order by created_at;
--   select proname, prosecdef from pg_proc
--     where proname in ('create_department_admin','set_admin_access','remove_department_admin');
-- Uske baad app me SuperAdmin console → Registered Department Administrators
-- table me Suspend / Restore / Remove buttons dikhne lagenge.
-- =====================================================================
