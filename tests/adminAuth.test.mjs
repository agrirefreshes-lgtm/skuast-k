import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (...parts) => readFileSync(join(process.cwd(), ...parts), 'utf8');

test('admin creation uses only the existing guarded RPC', () => {
  const dashboard = read('src', 'pages', 'AdminDashboard.tsx');
  const schema = read('supabase', 'schema.sql');
  const upgrade = read('supabase', 'upgrade_existing.sql');

  assert.match(dashboard, /supabase\.rpc\('create_department_admin'/);
  assert.doesNotMatch(dashboard, /functions\.invoke|create-department-admin/);
  assert.match(schema, /Only an active Super Admin can create department admins/);
  assert.match(upgrade, /Only an active Super Admin can create department admins/);
  assert.match(upgrade, /grant execute on function public\.create_department_admin\(text, text, text\) to authenticated/i);
  assert.match(upgrade, /revoke all on function public\.create_department_admin\(text, text, text\) from public, anon, authenticated/i);
  assert.match(upgrade, /revoke insert, update, delete on public\.admin_profiles from authenticated/i);
  assert.doesNotMatch(upgrade, /create policy "self update admin_profiles"/i);
});

test('admin console requires a valid admin profile and preserves exact passwords', () => {
  const dashboard = read('src', 'pages', 'AdminDashboard.tsx');
  const login = read('src', 'components', 'AdminLogin.tsx');

  assert.match(dashboard, /if \(!profile \|\| \(profile\.role !== 'admin' && profile\.role !== 'super_admin'\)\)/);
  assert.doesNotMatch(dashboard, /userEmail\.includes\('superadmin'\)/);
  assert.match(dashboard, /p_password: newAdminPassword,/);
  assert.match(login, /password,\s*\}\);/);
  assert.doesNotMatch(login, /password:\s*password\.trim\(\)/);
});

test('broken-account identity repair is scoped to department admins', () => {
  const upgrade = read('supabase', 'upgrade_existing.sql');

  assert.match(upgrade, /join public\.admin_profiles ap on ap\.id = u\.id and ap\.role = 'admin'/i);
  assert.match(upgrade, /not exists\s*\(\s*select 1 from auth\.identities i\s*where i\.user_id = u\.id and i\.provider = 'email'/i);
});

test('obsolete local admin creation Edge Function is removed', () => {
  assert.equal(existsSync(join(process.cwd(), 'supabase', 'functions', 'create-department-admin', 'index.ts')), false);
});
