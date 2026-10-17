import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (...parts) => readFileSync(join(process.cwd(), ...parts), 'utf8');

test('admin creation uses the guarded Supabase Auth Admin API Edge Function', () => {
  const dashboard = read('src', 'pages', 'AdminDashboard.tsx');
  const edgeFunction = read('supabase', 'functions', 'create-department-admin', 'index.ts');
  const schema = read('supabase', 'schema.sql');
  const upgrade = read('supabase', 'upgrade_existing.sql');

  assert.match(dashboard, /supabase\.functions\.invoke[^]*create-department-admin/);
  assert.doesNotMatch(dashboard, /rpc\('create_department_admin'/);
  assert.match(dashboard, /typeof nestedUser\?\.id === 'string'/);
  assert.match(dashboard, /new admin could not be verified/);
  assert.match(dashboard, /createdProfile\.role !== 'admin'/);
  assert.match(edgeFunction, /supabase\.auth\.admin\.createUser/);
  assert.match(edgeFunction, /supabase\.auth\.getUser\(accessToken\)/);
  assert.match(edgeFunction, /callerProfile\?\.role !== 'super_admin'/);
  assert.match(edgeFunction, /callerProfile\.is_active !== true/);
  assert.match(edgeFunction, /Deno\.env\.get\('SUPABASE_SERVICE_ROLE_KEY'\)/);
  assert.doesNotMatch(dashboard, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(schema, /create or replace function public\.create_department_admin/i);
  assert.match(upgrade, /drop function if exists public\.create_department_admin\(text, text, text\)/i);
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

test('broken-account identity repair is scoped to department admins', () => {
  const upgrade = read('supabase', 'upgrade_existing.sql');

  assert.match(upgrade, /join public\.admin_profiles ap on ap\.id = u\.id and ap\.role = 'admin'/i);
  assert.match(upgrade, /not exists\s*\(\s*select 1 from auth\.identities i\s*where i\.user_id = u\.id and i\.provider = 'email'/i);
});

test('admin Auth Edge Function source is available for deployment', () => {
  assert.equal(existsSync(join(process.cwd(), 'supabase', 'functions', 'create-department-admin', 'index.ts')), true);
});
