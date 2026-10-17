import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (...parts) => readFileSync(join(process.cwd(), ...parts), 'utf8');

test('admin creation uses a guarded Auth Admin API with a strict response contract', () => {
  const dashboard = read('src', 'pages', 'AdminDashboard.tsx');
  const edgeFunction = read('supabase', 'functions', 'create-department-admin', 'index.ts');
  const authHelper = read('supabase', 'functions', '_shared', 'admin-auth.ts');
  const schema = read('supabase', 'schema.sql');
  const upgrade = read('supabase', 'upgrade_existing.sql');

  assert.match(dashboard, /supabase\.functions\.invoke[^]*create-department-admin/);
  assert.doesNotMatch(dashboard, /rpc\('create_department_admin'/);
  assert.match(dashboard, /response\?\.ok !== true/);
  assert.match(dashboard, /nestedAdmin\.role !== 'admin'/);
  assert.match(dashboard, /createdProfile\.is_active !== true/);
  assert.match(edgeFunction, /client\.auth\.admin\.createUser/);
  assert.match(authHelper, /client\.auth\.getUser\(token\)/);
  assert.match(authHelper, /profile\?\.role !== 'super_admin'/);
  assert.match(authHelper, /profile\.is_active !== true/);
  assert.match(authHelper, /Deno\.env\.get\('SUPABASE_SERVICE_ROLE_KEY'\)/);
  assert.doesNotMatch(dashboard, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(schema, /create or replace function public\.create_department_admin/i);
  assert.match(upgrade, /drop function if exists public\.create_department_admin\(text, text, text\)/i);
  assert.match(upgrade, /drop function if exists public\.create_department_admin\(text, text\)/i);
  assert.match(upgrade, /drop function if exists public\.set_admin_access\(uuid, boolean\)/i);
  assert.match(upgrade, /drop function if exists public\.remove_department_admin\(uuid\)/i);
  assert.match(upgrade, /from pg_policies\s+where \(schemaname = 'public' and tablename in \('admin_profiles', 'events', 'certificates'\)\)/i);
  assert.match(upgrade, /revoke insert, update, delete on public\.admin_profiles from authenticated/i);
  assert.doesNotMatch(upgrade, /create policy "self update admin_profiles"/i);
});

test('admin console requires a valid admin profile and preserves exact passwords', () => {
  const dashboard = read('src', 'pages', 'AdminDashboard.tsx');
  const login = read('src', 'components', 'AdminLogin.tsx');

  assert.match(dashboard, /if \(!profile \|\| \(profile\.role !== 'admin' && profile\.role !== 'super_admin'\)\)/);
  assert.doesNotMatch(dashboard, /userEmail\.includes\('superadmin'\)/);
  assert.match(dashboard, /password: newAdminPassword,/);
  assert.doesNotMatch(dashboard, /password:\s*newAdminPassword\.trim\(\)/);
  assert.match(login, /password,\s*\}\);/);
  assert.doesNotMatch(login, /password:\s*password\.trim\(\)/);
});

test('admin lifecycle actions are handled by the Super-Admin-only Edge Function', () => {
  const dashboard = read('src', 'pages', 'AdminDashboard.tsx');
  const management = read('supabase', 'functions', 'manage-department-admin', 'index.ts');
  const upgrade = read('supabase', 'upgrade_existing.sql');

  assert.match(dashboard, /supabase\.functions\.invoke[^]*manage-department-admin/);
  assert.match(management, /authorizeSuperAdmin\(request\)/);
  assert.match(management, /client\.auth\.admin\.updateUserById/);
  assert.match(management, /client\.auth\.admin\.deleteUser/);
  assert.doesNotMatch(upgrade, /insert into auth\.identities/i);
});

test('certificate lookup is server mediated and public QR responses filter private fields', () => {
  const portal = read('src', 'pages', 'UserPortal.tsx');
  const publicDownload = read('src', 'pages', 'PublicEventDownload.tsx');
  const publicVerification = read('src', 'pages', 'PublicVerification.tsx');
  const helper = read('src', 'lib', 'certificateVerification.ts');
  const endpoint = read('supabase', 'functions', 'verify-certificate', 'index.ts');
  const schema = read('supabase', 'schema.sql');
  const upgrade = read('supabase', 'upgrade_existing.sql');

  assert.match(portal, /verifyPublicCertificate/);
  assert.doesNotMatch(portal, /\.from\('certificates'\)/);
  assert.match(publicDownload, /verifyPublicCertificate/);
  assert.match(publicVerification, /verifyPublicCertificate/);
  assert.match(helper, /supabase\.functions\.invoke/);
  assert.match(endpoint, /publicCertificateData\(certificate\.data\)/);
  assert.match(endpoint, /event\.is_published/);
  assert.match(endpoint, /event\.is_download_enabled === false/);
  assert.doesNotMatch(schema, /create policy "public read certificates"/i);
  assert.doesNotMatch(upgrade, /create policy "public read certificates"/i);
  assert.match(upgrade, /revoke all on public\.certificates from public, anon, authenticated/i);
});

test('admin Auth Edge Function source is available for deployment', () => {
  assert.equal(existsSync(join(process.cwd(), 'supabase', 'functions', 'create-department-admin', 'index.ts')), true);
  assert.equal(existsSync(join(process.cwd(), 'supabase', 'functions', 'manage-department-admin', 'index.ts')), true);
  assert.equal(existsSync(join(process.cwd(), 'supabase', 'functions', 'verify-certificate', 'index.ts')), true);
});
