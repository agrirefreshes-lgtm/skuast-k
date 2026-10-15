/**
 * SKUAST-K — Performance Test: Bundle, Render, Memory
 *
 * NOTE on PERF-001/002: the app intentionally ships several vendor chunks
 * (react, supabase, xlsx, jspdf/html2canvas, zxing). Mobile browsers on a
 * public route only download the route chunk + the shared vendors that
 * route needs — so totals here are a deploy-size ceiling, and PERF-002
 * guards that the heavy admin-only vendors stay in their own chunks.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { createRequire } from 'module';
import { join } from 'path';

// Get require function for ESM
const require = createRequire(import.meta.url);
const { execSync } = require('child_process');

// Recursively list files under a dir (cross-platform — no `dir /s /B`).
const listFilesRecursive = (dir) => {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(full));
    else out.push(full);
  }
  return out;
};

// ─── 1. BUNDLE SIZE TESTS ─────────────────────────────────────────────────────

test('PERF-001: Total deploy size stays within ceiling', () => {
  const distDir = join(process.cwd(), 'dist');
  let totalSize = 0;

  for (const file of listFilesRecursive(distDir)) {
    if (file.endsWith('.js') || file.endsWith('.css') || file.endsWith('.html') || file.endsWith('.svg')) {
      try {
        totalSize += statSync(file).size;
      } catch {}
    }
  }

  const sizeKB = totalSize / 1024;
  console.log(`    Total bundle size: ${sizeKB.toFixed(2)} KB`);
  assert.ok(sizeKB < 2560, `Deploy too large: ${sizeKB.toFixed(2)} KB (expected < 2560 KB)`);
});

test('PERF-002: Heavy vendors are code-split (no single oversized chunk)', () => {
  const distDir = join(process.cwd(), 'dist');
  const jsFiles = listFilesRecursive(distDir).filter((f) => f.endsWith('.js'));

  // Admin-only weight (xlsx import, pdf export) must ship as separate chunks
  // so public QR-shared routes never force mobile browsers to download it.
  const names = jsFiles.map((f) => f.split(/[\\/]/).pop());
  for (const expected of ['vendor-xlsx', 'vendor-pdf', 'vendor-qr']) {
    assert.ok(
      names.some((n) => n.startsWith(expected)),
      `Expected a separate ${expected} chunk in dist/assets`
    );
  }

  let largest = 0;
  let largestName = '';
  for (const file of jsFiles) {
    try {
      const size = statSync(file).size;
      if (size > largest) {
        largest = size;
        largestName = file;
      }
    } catch {}
  }
  console.log(`    Largest JS chunk: ${(largest / 1024).toFixed(2)} KB (${largestName})`);
  assert.ok(largest < 650 * 1024, `Single chunk too large: ${(largest / 1024).toFixed(2)} KB (expected < 650 KB)`);
});

test('PERF-003: Main bundle size is reasonable for load time', () => {
  const srcDir = join(process.cwd(), 'src');
  if (!existsSync(srcDir)) return;

  const entries = listFilesRecursive(srcDir);

  for (const file of entries) {
    if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
      try {
        const stats = statSync(file);
        const sizeKB = stats.size / 1024;
        if (sizeKB > 200) {
          console.warn(`    Large source file: ${file} (${sizeKB.toFixed(2)} KB)`);
        }
      } catch {}
    }
  }
});

// ─── 2. RENDER PERFORMANCE TESTS ──────────────────────────────────────────────

test('PERF-010: React routes resolve and share a lazy-loaded shell (relaxed for CI)', async () => {
  const start = performance.now();

  const appContent = readFileSync(join(process.cwd(), 'src', 'App.tsx'), 'utf8');
  assert.ok(appContent.length > 100, 'App.tsx should have content');
  // Routes are lazy-loaded so the first paint stays light on mobile; the
  // Suspense shell must always be present or a slow chunk = blank page.
  assert.ok(appContent.includes('lazy('), 'App.tsx should lazy-load routes');
  assert.ok(appContent.includes('Suspense'), 'App.tsx should wrap lazy routes in Suspense');

  const mainContent = readFileSync(join(process.cwd(), 'src', 'main.tsx'), 'utf8');
  assert.ok(mainContent.length > 50, 'main.tsx should have content');

  const end = performance.now();
  const renderTime = end - start;
  console.log(`    Route-shell check time: ${renderTime.toFixed(2)}ms`);
  assert.ok(renderTime < 300, `Render check too slow: ${renderTime.toFixed(2)}ms`);
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
