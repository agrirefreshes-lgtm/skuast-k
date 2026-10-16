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
--   3. "Invalid login credentials" fix — SQL se bane har login account ke
--      saath auth.identities row ab banti hai (+ purano ka repair block).
-- =====================================================================

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
set search_path = public, extensions   -- <- yahi asli gen_salt fix hai
as $$
declare
  v_uid uuid;
  v_email text := lower(btrim(p_email));
begin
  if v_email is null or v_email = '' then
    raise exception 'Email required';
  end if;
  if p_password is null or char_length(p_password) < 6 then
    raise exception 'Password min 6 chars required';
  end if;

  -- Clear error agar login account pehle se exist karta hai
  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    raise exception 'Login account with this email already exists (%)', v_email;
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
    v_email,
    crypt(p_password, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb, false, 'authenticated'
  );

  -- ZAROORI: auth.identities row. Bina iske Supabase Auth (GoTrue) password
  -- login me "Invalid login credentials" deta hai — user auth.users me
  -- hone ke bawajood, kyunki login identity table se hi lookup hota hai.
  insert into auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    v_uid::text, v_uid,
    jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  -- admin_profiles row (role = admin, is_active = true)
  insert into public.admin_profiles (id, email, role, department, is_active)
  values (v_uid, v_email, 'admin',
          coalesce(nullif(btrim(p_department), ''), 'Academic Department'), true)
  on conflict (id) do update
    set email = excluded.email,
        department = excluded.department;

  return jsonb_build_object('id', v_uid, 'email', v_email);
end;
$$;

-- FIX-2: admin_profiles me is_active column
-- false = admin ka access temporarily suspended (sign-in block)
alter table public.admin_profiles
  add column if not exists is_active boolean not null default true;

-- FIX-3: SuperAdmin → suspend / restore department admin
create or replace function public.set_admin_access(
  p_admin_id uuid,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_caller uuid := auth.uid();
  v_is_super boolean;
begin
  -- Server-side guard: sirf super_admin (ya superadmin-pattern email) chala sake
  v_is_super := coalesce(
    (select role = 'super_admin' from public.admin_profiles where id = v_caller),
    false
  ) or coalesce(auth.jwt() ->> 'email', '') ilike '%superadmin%';

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
set search_path = public, extensions
as $$
declare
  v_caller uuid := auth.uid();
  v_is_super boolean;
  v_email text;
begin
  v_is_super := coalesce(
    (select role = 'super_admin' from public.admin_profiles where id = v_caller),
    false
  ) or coalesce(auth.jwt() ->> 'email', '') ilike '%superadmin%';

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
-- FIX-5: REPAIR — jo login accounts bina auth.identities ke ban gaye the
-- (symptom: password bilkul sahi par "Invalid login credentials" aata hai)
-- Ye SIRF un users ke liye identity row banata hai jiska koi email identity nahi.
-- Idhar pehle se banaya gaya naya admin bhi isi block se theek ho jayega
-- (password wahi rahega jo create karte waqt diya tha).
insert into auth.identities (
  provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.email is not null
  and not exists (
    select 1 from auth.identities i
    where i.user_id = u.id and i.provider = 'email'
  );

-- =====================================================================
-- VERIFY (optional):
--   select email, role, is_active from public.admin_profiles order by created_at;
--   select proname, prosecdef from pg_proc
--     where proname in ('create_department_admin','set_admin_access','remove_department_admin');
-- Uske baad app me SuperAdmin console → Registered Department Administrators
-- table me Suspend / Restore / Remove buttons dikhne lagenge.
-- =====================================================================
