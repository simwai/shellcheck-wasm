#!/usr/bin/env tsx
/**
 * Copy WASM artifacts to dist/ and ensure they're accessible
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

const distDir = resolve(projectRoot, 'dist');
const srcDistDir = resolve(projectRoot, 'dist'); // Same for now

mkdirSync(distDir, { recursive: true });

// Files to copy from build output to final dist
const files = [
  { src: 'shellcheck.wasm', dest: 'shellcheck.wasm' },
  { src: 'shellcheck.js', dest: 'shellcheck.js' },
  { src: 'shellcheck.d.ts', dest: 'shellcheck.d.ts' },
];

for (const file of files) {
  const srcPath = resolve(srcDistDir, file.src);
  const destPath = resolve(distDir, file.dest);

  if (existsSync(srcPath)) {
    copyFileSync(srcPath, destPath);
    console.log(`✅ Copied ${file.src} → dist/${file.dest}`);
  } else {
    console.warn(`⚠️  Source not found: ${srcPath}`);
  }
}

// Create a minimal wasi-polyfill.js for browser if it doesn't exist
const polyfillPath = resolve(distDir, 'wasi-polyfill.js');
if (!existsSync(polyfillPath)) {
  const polyfill = `/**
 * Minimal WASI polyfill for shellcheck-wasm in browser
 * Provides only the WASI functions needed by GHC WASM output
 */

// This is a stub - the actual polyfill is inline in browser.ts
// In production, you might want to use @wasmer/wasi or a more complete polyfill
console.log('[shellcheck-wasm] WASI polyfill loaded (stub)');

export const wasiPolyfill = {
  // The real implementation is in browser.ts createWasiImports()
};
`;
  writeFileSync(polyfillPath, polyfill);
  console.log('✅ Created wasi-polyfill.js');
}

console.log('📦 Copy complete');
