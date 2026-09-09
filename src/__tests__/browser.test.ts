import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest';
import type { LintOptions, LintResult, ShellCheckWasmInstance } from '../types.js';

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

const describeIf = isBrowser ? describe : describe.skip;

describeIf('Browser Integration Tests', () => {
  let shellcheck: ShellCheckWasmInstance | null = null;

  beforeAll(async () => {
    if (!isBrowser) {
      console.warn('Not in browser environment, skipping browser tests');
      return;
    }

    const wasmUrl = inject('wasmUrl') as string;
    const { createShellCheck } = await import('../runtime/browser.js');
    shellcheck = await createShellCheck(wasmUrl);
  }, 120000);

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
    expect(sc2086?.severity).toBe('info');
  });

  it('should filter by severity option', async () => {
    const script = `#!/bin/bash
echo $VAR`;

    const results = await getShellcheck().lint(script, { severity: 'error' });
    expect(results).toEqual([]);

    const results2 = await getShellcheck().lint(script, { severity: 'info' });
    expect(results2.length).toBeGreaterThan(0);
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

    const sc2154 = results.find((r) => r.code === 2154);
    expect(sc2154).toBeUndefined();
  });
});

describe('Browser API Shape (Mock)', () => {
  it('should have correct createShellCheck signature', () => {
    type CreateShellCheck = typeof import('../runtime/browser.js').createShellCheck;
    type Expected = (wasmUrl?: string) => Promise<import('../types.js').ShellCheckWasmInstance>;

    const _check: CreateShellCheck = {} as Expected;
    expect(true).toBe(true);
  });
});
