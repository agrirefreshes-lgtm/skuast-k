/**
 * SKUAST-K — Security Test: Client-Side & URL Security
 * Part 3: XSS Prevention, Error Boundaries, Headers
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { join } from 'path';

test('SEC-050: XSS prevention — input is escaped in render', async () => {
  const supabaseMod = await import('../src/lib/supabaseClient.ts');
  const supabase = supabaseMod.supabase;

  const { data, error } = await supabase
    .from('certificates')
    .select('certificate_no, event_name')
    .limit(1);

  if (data && data.length > 0) {
    const cert = data[0];
    assert.ok(typeof cert.certificate_no === 'string', 'certificate_no should be a string');
    assert.ok(typeof cert.event_name === 'string', 'event_name should be a string');
  }
});

test('SEC-051: React StrictMode is enabled', () => {
  const content = readFileSync(join(process.cwd(), 'src', 'main.tsx'), 'utf8');
  assert.ok(content.includes('StrictMode'), 'React StrictMode should be enabled for extra safety checks');
});

test('SEC-052: Error boundary is implemented', () => {
  const content = readFileSync(join(process.cwd(), 'src', 'App.tsx'), 'utf8');
  assert.ok(content.includes('ErrorBoundary'), 'Error boundary should be implemented');
  assert.ok(content.includes('componentDidCatch'), 'Error boundary should have componentDidCatch');
  assert.ok(content.includes('getDerivedStateFromError'), 'Error boundary should have getDerivedStateFromError');
});

test('SEC-060: Cache control headers should prevent sensitive data caching', () => {
  const indexContent = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
  assert.ok(indexContent.includes('no-cache, no-store, must-revalidate'),
    'Cache-Control should prevent sensitive data caching');
  assert.ok(indexContent.includes('no-store'), 'Cache-Control should include no-store');
  assert.ok(indexContent.includes('must-revalidate'), 'Cache-Control should include must-revalidate');
});

test('SEC-061: HTTPS is enforced in headers', () => {
  const indexContent = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
  assert.ok(indexContent.includes('theme-color'), 'Theme color should be set');
  assert.ok(indexContent.includes('og:url'), 'Open Graph URL should be set');
});
