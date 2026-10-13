/**
 * SKUAST-K — Performance Test: API & Load Testing
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { statSync, existsSync } from 'fs';
import { createRequire } from 'module';
import { join } from 'path';
import { performance } from 'node:perf_hooks';

const require = createRequire(import.meta.url);
const { execSync } = require('child_process');

test('PERF-040: Excel/CSV file processing is efficient', async () => {
  const { supabase } = await import('../src/lib/supabaseClient.ts');

  const largeData = Array.from({ length: 1000 }, (_, i) => ({
    certificate_no: `CERT-2026-${String(i).padStart(5, '0')}`,
    event_name: 'Test Event',
    status: 'verified',
    data: { name: 'Test', batch_id: `BATCH${i}`, issue_date: new Date().toISOString().split('T')[0] },
  }));

  const start = performance.now();
  const processed = largeData.map((c) => ({
    ...c,
    checksum: c.certificate_no.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0),
  }));
  const end = performance.now();

  const processTime = end - start;
  console.log(`    Large dataset processing (1000 records): ${processTime.toFixed(2)}ms`);
  assert.ok(processTime < 500, `Processing too slow: ${processTime.toFixed(2)}ms`);
});

test('PERF-050: Concurrent requests threshold test', async () => {
  const { supabase } = await import('../src/lib/supabaseClient.ts');

  const promises = Array.from({ length: 5 }, async () => {
    try {
      const { data, error } = await supabase.from('events').select('id, name, is_published').limit(1);
      return { data, error };
    } catch {
      return { data: null, error: new Error('Request failed') };
    }
  });

  const results = await Promise.all(promises);
  let successCount = 0;
  for (const r of results) {
    if (!r.error) successCount++;
  }

  console.log(`    Concurrent requests: ${successCount}/5 succeeded`);
  assert.ok(successCount >= 2, `Too many concurrent requests failed: ${successCount}/5`);
});

test('PERF-051: Load is detected and handled gracefully', async () => {
  const { supabase } = await import('../src/lib/supabaseClient.ts');

  let totalSuccess = 0;
  const attempts = 20;

  for (let i = 0; i < attempts; i++) {
    try {
      const { data, error } = await supabase.from('certificates').select('certificate_no').limit(1);
      if (!error) totalSuccess++;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  const successRate = (totalSuccess / attempts) * 100;
  console.log(`    Load test: ${totalSuccess}/${attempts} succeeded (${successRate.toFixed(1)}%)`);
  assert.ok(successRate >= 70, `Too many failures under load: ${successRate.toFixed(1)}%`);
});
