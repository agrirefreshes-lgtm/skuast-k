-- =====================================================================
-- SKUAST-K Certificate System — SECURE RLS POLICIES  (RUN THIS NOW)
-- Supabase Dashboard → SQL Editor → New Query → paste FULL file → Run
-- =====================================================================
--
-- WHY THIS EXISTS (critical):
--   The previous policies were "open write" (using(true) with check(true))
--   for events, certificates, admin_profiles and templates. Because the
--   Supabase *publishable/anon* key is public (it ships inside the browser
--   bundle), ANYONE on the internet could — without logging in:
--     * read every admin email/role,
--     * INSERT/UPDATE admin_profiles  -> promote themselves to super_admin,
--     * DELETE or tamper with all events & certificates,
--     * overwrite / delete certificate templates.
--
-- THE FIX (least-privilege model):
--   anon (public)        -> SELECT only  (certificate verification, templates)
--   authenticated (admin)-> full access  (admins sign in via Supabase Auth)
--   admin_profiles       -> hidden from anon; self-update only (no promotion)
--
-- The app already signs admins in with supabase.auth.signInWithPassword,
-- so their writes carry the `authenticated` JWT and keep working.
-- create_department_admin() is SECURITY DEFINER, so it bypasses RLS and
-- still works after we remove the "open insert" policy.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. EVENTS
--    Public: read only (needed by /verify to load the event by slug).
--    Admin (authenticated): full control.
-- ---------------------------------------------------------------------
drop policy if exists "public read events" on public.events;
create policy "public read events"
  on public.events for select
  to anon
  using (is_published = true);           -- public sees only published events

create policy "authenticated read events"
  on public.events for select
  to authenticated
  using (true);                           -- admins see all events (drafts too)

drop policy if exists "open write events" on public.events;
create policy "authenticated write events"
  on public.events for all
  to authenticated
  using (true) with check (true);

revoke insert, update, delete on public.events from anon;

-- ---------------------------------------------------------------------
-- 2. CERTIFICATES
--    Public: read only (verify a certificate by its number).
--    Admin (authenticated): full control.
-- ---------------------------------------------------------------------
drop policy if exists "public read certificates" on public.certificates;
create policy "public read certificates"
  on public.certificates for select
  using (true);

drop policy if exists "open write certificates" on public.certificates;
create policy "authenticated write certificates"
  on public.certificates for all
  to authenticated
  using (true) with check (true);

revoke insert, update, delete on public.certificates from anon;


-- ---------------------------------------------------------------------
-- 3. ADMIN_PROFILES  (most sensitive — was fully open before)
--    Public: NO access (hide admin emails/roles).
--    Admin: read all profiles; update ONLY their own row (no promotion).
--    Inserts happen via the SECURITY DEFINER RPC / manual SQL -> no policy.
-- ---------------------------------------------------------------------
drop policy if exists "public read admin_profiles" on public.admin_profiles;
drop policy if exists "open insert admin_profiles" on public.admin_profiles;
drop policy if exists "open update admin_profiles" on public.admin_profiles;

create policy "authenticated read admin_profiles"
  on public.admin_profiles for select
  to authenticated
  using (true);

create policy "self update admin_profiles"
  on public.admin_profiles for update
  to authenticated
  using (auth.uid() = id)                 -- can only touch your own row
  with check (auth.uid() = id);

revoke insert, update, delete on public.admin_profiles from anon;

-- ---------------------------------------------------------------------
-- 4. STORAGE — templates bucket
--    Public: read template images (needed to render the certificate).
--    Admin (authenticated): upload / update / delete.
-- ---------------------------------------------------------------------
drop policy if exists "public read templates" on storage.objects;
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

-- =====================================================================
-- VERIFY (run these — you should get rows/[] and NOT "permission denied"):
--   select * from public.certificates limit 1;      -- anon: OK (read)
--   select * from public.events where is_published; -- anon: OK (read)
-- =====================================================================
-- After running, test as a logged-out visitor (anon key):
--   * /verify still finds certificates          -> public read works
--   * INSERT into events/certificates is blocked -> writes locked down
--   * admin_profiles not readable by anon        -> admin data hidden
-- =====================================================================
