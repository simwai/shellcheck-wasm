/**
 * Browser integration tests for shellcheck-wasm
 * These tests run in a browser-like environment (jsdom)
 * Run with: npm run test:browser
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { LintOptions, LintResult, ShellCheckWasmInstance } from '../types.js';

// These tests are designed to run in a browser environment
// They will be skipped in Node unless jsdom is configured

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

const describeIf = isBrowser ? describe : describe.skip;

describeIf('Browser Integration Tests', () => {
  let shellcheck: ShellCheckWasmInstance | null = null;

  beforeAll(async () => {
    if (!isBrowser) {
      console.warn('⚠️  Not in browser environment, skipping browser tests');
      return;
    }

    const { createShellCheck } = await import('../runtime/browser.js');
    // In browser, the WASM is served from the same origin
    shellcheck = await createShellCheck('/shellcheck.wasm');
  }, 60000);

  const getShellcheck = () => {
    if (!shellcheck) throw new Error('shellcheck not initialized');
    return shellcheck;
  };

  afterAll(() => {
    if (shellcheck) {
      shellcheck.terminate();
    }
  });

  it('should lint a valid script with no warnings', async () => {
    const script = `#!/bin/bash
echo "Hello, World!"`;
    const results = await getShellcheck().lint(script);

    expect(results).toEqual([]);
  });

  it('should detect SC2086 (unquoted variable)', async () => {
    const script = `#!/bin/bash
echo $VAR`;
    const results = await getShellcheck().lint(script);

    expect(results.length).toBeGreaterThan(0);
    const sc2086 = results.find((r) => r.code === 2086);
    expect(sc2086).toBeDefined();
    expect(sc2086?.severity).toBe('warning');
  });

  it('should filter by severity option', async () => {
    const script = `#!/bin/bash
echo $VAR`;

    // SC2086 is warning - should be filtered out with severity=error
    const results = await getShellcheck().lint(script, { severity: 'error' });
    expect(results).toEqual([]);
  });

  it('should work with virtual files for sourced scripts', async () => {
    const mainScript = `#!/bin/bash
source ./lib.sh
echo "$MY_VAR"`;

    const results = await getShellcheck().lint(mainScript, {
      files: {
        'lib.sh': 'MY_VAR="hello"',
      },
    });

    // Should not complain about MY_VAR being undefined
    const sc2154 = results.find((r) => r.code === 2154);
    expect(sc2154).toBeUndefined();
  });
});

// Mock tests for Node environment to verify API shape
describe('Browser API Shape (Mock)', () => {
  it('should have correct createShellCheck signature', () => {
    // This is a compile-time check - if it compiles, the signature is correct
    type CreateShellCheck = typeof import('../runtime/browser.js').createShellCheck;
    type Expected = (wasmUrl?: string) => Promise<import('../types.js').ShellCheckWasmInstance>;

    // Type assertion to verify compatibility
    const _check: CreateShellCheck = {} as Expected;
    expect(true).toBe(true);
  });
});
