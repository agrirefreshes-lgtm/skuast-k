import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const read = (...parts) => readFileSync(join(process.cwd(), ...parts), 'utf8');

test('Supabase SQL sources are consolidated into fresh schema and existing-project upgrade', () => {
  const sqlFiles = readdirSync(join(process.cwd(), 'supabase'))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  assert.deepEqual(sqlFiles, ['schema.sql', 'upgrade_existing.sql']);
  assert.equal(existsSync(join(process.cwd(), 'supabase', 'fix_admin_access.sql')), false);
  assert.equal(existsSync(join(process.cwd(), 'supabase', 'schema_secure_rls.sql')), false);
  assert.equal(existsSync(join(process.cwd(), 'supabase', 'migration_uploaded_column.sql')), false);
  assert.match(read('supabase', 'schema.sql'), /uploaded_certificate_no text/i);
  assert.match(read('supabase', 'upgrade_existing.sql'), /add column if not exists uploaded_certificate_no text/i);
});

test('main push is the only documented website deployment command', () => {
  const packageJson = JSON.parse(read('package.json'));
  const workflow = read('.github', 'workflows', 'deploy.yml');
  const readme = read('README.md');

  assert.equal(packageJson.scripts.deploy, undefined);
  assert.equal(packageJson.scripts.predeploy, undefined);
  assert.equal(packageJson.devDependencies['gh-pages'], undefined);
  assert.match(workflow, /push:\s*\n\s+branches:\s*\[main\]/);
  assert.match(workflow, /node-version:\s*22/);
  assert.ok(workflow.indexOf('run: npm test') < workflow.indexOf('name: Deploy dist/'));
  assert.match(readme, /git push origin main/);
  assert.doesNotMatch(readme, /npm run deploy|gh-pages -d dist/);
});

test('only the environment template is tracked by design and uses app config keys', () => {
  const gitignore = read('.gitignore');
  const example = read('.env.example');
  const envKeys = example
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1])
    .filter(Boolean);

  assert.match(gitignore, /^\.env\*$/m);
  assert.match(gitignore, /^!\.env\.example$/m);
  assert.deepEqual(envKeys.sort(), ['VITE_SUPABASE_ANON_KEY', 'VITE_SUPABASE_URL']);
});

test('footer includes the requested Agritors credit', () => {
  assert.match(read('src', 'components', 'Footer.tsx'), /Powered by Agritors/);
});
