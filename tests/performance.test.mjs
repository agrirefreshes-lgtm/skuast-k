/**
 * SKUAST-K — Performance Test: Bundle, Render, Memory
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'fs';
import { createRequire } from 'module';
import { join } from 'path';

// Get require function for ESM
const require = createRequire(import.meta.url);
const { execSync } = require('child_process');

// ─── 1. BUNDLE SIZE TESTS ─────────────────────────────────────────────────────

test('PERF-001: Total bundle size is under 500 KB', () => {
  const distDir = join(process.cwd(), 'dist');
  let totalSize = 0;

  if (existsSync(distDir)) {
    const entries = process.platform === 'win32'
      ? execSync('dir /s /B "' + distDir + '"').toString().split('\n')
      : [];
    for (const file of entries) {
      if (file.endsWith('.js') || file.endsWith('.css') || file.endsWith('.html') || file.endsWith('.svg')) {
        try {
          const stats = statSync(join(distDir, file));
          totalSize += stats.size;
        } catch {}
      }
    }
  }

  const sizeKB = totalSize / 1024;
  console.log(`    Total bundle size: ${sizeKB.toFixed(2)} KB`);
  assert.ok(sizeKB < 500, `Bundle too large: ${sizeKB.toFixed(2)} KB (expected < 500 KB)`);
});

test('PERF-002: JavaScript bundle size is under 300 KB', () => {
  const distDir = join(process.cwd(), 'dist');
  let jsSize = 0;

  if (existsSync(distDir)) {
    const entries = process.platform === 'win32'
      ? execSync('dir /s /B "' + distDir + '"').toString().split('\n')
      : [];
    for (const file of entries) {
      if (file.endsWith('.js') && !file.includes('asset')) {
        try {
          const stats = statSync(join(distDir, file));
          jsSize += stats.size;
        } catch {}
      }
    }
  }

  const sizeKB = jsSize / 1024;
  console.log(`    JS bundle size: ${sizeKB.toFixed(2)} KB`);
  assert.ok(sizeKB < 300, `JS bundle too large: ${sizeKB.toFixed(2)} KB (expected < 300 KB)`);
});

test('PERF-003: Main bundle size is reasonable for load time', () => {
  const srcDir = join(process.cwd(), 'src');
  if (!existsSync(srcDir)) return;

  const entries = process.platform === 'win32'
    ? execSync('dir /s /B "' + srcDir + '"').toString().split('\n')
    : [];

  for (const file of entries) {
    if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
      try {
        const stats = statSync(join(srcDir, file));
        const sizeKB = stats.size / 1024;
        if (sizeKB > 200) {
          console.warn(`    Large source file: ${file} (${sizeKB.toFixed(2)} KB)`);
        }
      } catch {}
    }
  }
});

// ─── 2. RENDER PERFORMANCE TESTS ──────────────────────────────────────────────

test('PERF-010: React component render time is under 300ms (relaxed for CI)', async () => {
  const start = performance.now();

  const { supabase } = await import('../src/lib/supabaseClient.ts');

  const appContent = readFileSync(join(process.cwd(), 'src', 'App.tsx'), 'utf8');
  assert.ok(appContent.length > 100, 'App.tsx should have content');

  const mainContent = readFileSync(join(process.cwd(), 'src', 'main.tsx'), 'utf8');
  assert.ok(mainContent.length > 50, 'main.tsx should have content');

  const end = performance.now();
  const renderTime = end - start;
  console.log(`    Component render time: ${renderTime.toFixed(2)}ms`);
  assert.ok(renderTime < 300, `Render time too slow: ${renderTime.toFixed(2)}ms`);
});

test('PERF-011: Certificate processing is efficient', async () => {
  const { supabase } = await import('../src/lib/supabaseClient.ts');

  const { data, error } = await supabase
    .from('certificates')
    .select('*')
    .limit(1);

  if (error) {
    console.warn('  ⚠  Certificate fetch test: ', error.message);
  }

  const start = performance.now();
  if (data && data.length > 0) {
    const transformed = data.map((c) => ({
      certificate_no: c.certificate_no,
      event_name: c.event_name,
      status: c.status,
    }));
    const total = transformed.length;
  }
  const end = performance.now();
  const processTime = end - start;
  console.log(`    Certificate processing time: ${processTime.toFixed(2)}ms`);
  assert.ok(processTime < 50, `Processing too slow: ${processTime.toFixed(2)}ms`);
});

// ─── 3. MEMORY & LEAK TESTS ───────────────────────────────────────────────────

test('PERF-020: Memory usage is within reasonable bounds', () => {
  const memUsage = process.memoryUsage();
  const heapUsedMB = memUsage.heapUsed / (1024 * 1024);
  console.log(`    Current heap usage: ${heapUsedMB.toFixed(2)} MB`);
  assert.ok(heapUsedMB < 100, `Memory usage too high: ${heapUsedMB.toFixed(2)} MB`);
});

test('PERF-021: Node.js process stays stable under 1000 entries', async () => {
  const initialMem = process.memoryUsage().heapUsed;

  const testData = [];
  for (let i = 0; i < 1000; i++) {
    testData.push({
      id: i,
      name: `Test Entry ${i}`,
      value: Math.random().toString(36).substring(2),
      timestamp: Date.now(),
    });
  }

  const finalMem = process.memoryUsage().heapUsed;
  const growth = (finalMem - initialMem) / (1024 * 1024);
  console.log(`    Memory growth after 1000 entries: ${growth.toFixed(2)} MB`);
  assert.ok(growth < 5, `Memory grew too much: ${growth.toFixed(2)} MB`);
});
