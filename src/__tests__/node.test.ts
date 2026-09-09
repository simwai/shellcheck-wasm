/**
 * Node.js integration tests for shellcheck-wasm
 * These tests require the WASM binary to be built first
 * Run with: npm run test:node
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { LintOptions, LintResult, ShellCheckWasmInstance } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const projectRoot = resolve(__dirname, '../..');
const distDir = resolve(projectRoot, 'dist');
const wasmPath = resolve(distDir, 'shellcheck.wasm');
const fixturesDir = resolve(projectRoot, 'test/fixtures');

// Skip tests if WASM not built
const wasmExists = existsSync(wasmPath);

const describeIf = wasmExists ? describe : describe.skip;

describeIf('Node.js Integration Tests', () => {
  let shellcheck: ShellCheckWasmInstance | null = null;

  beforeAll(async () => {
    if (!wasmExists) {
      console.warn('⚠️  WASM not built, skipping Node integration tests');
      return;
    }

    const { createShellCheck } = await import('../runtime/node.js');
    shellcheck = await createShellCheck(wasmPath);
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
    const script = readFileSync(resolve(fixturesDir, 'valid.sh'), 'utf-8');
    const results = await getShellcheck().lint(script);

    expect(results).toEqual([]);
  });

  it('should detect SC2086 (unquoted variable)', async () => {
    const script = readFileSync(resolve(fixturesDir, 'sc2086.sh'), 'utf-8');
    const results = await getShellcheck().lint(script);

    expect(results.length).toBeGreaterThan(0);
    const sc2086 = results.find((r) => r.code === 2086);
    expect(sc2086).toBeDefined();
    expect(sc2086?.severity).toBe('info');
    expect(sc2086?.message).toContain('Double quote');
  });

  it('should detect SC2164 (cd without error check)', async () => {
    const script = readFileSync(resolve(fixturesDir, 'sc2164.sh'), 'utf-8');
    const results = await getShellcheck().lint(script);

    expect(results.length).toBeGreaterThan(0);
    const sc2164 = results.find((r) => r.code === 2164);
    expect(sc2164).toBeDefined();
    expect(sc2164?.severity).toBe('warning');
  });

  it('should filter by severity option', async () => {
    const script = readFileSync(resolve(fixturesDir, 'sc2086.sh'), 'utf-8');

    // SC2086 is info - should be filtered out with severity=error
    const results = await getShellcheck().lint(script, { severity: 'error' });
    expect(results).toEqual([]);

    // Should appear with severity=info
    const results2 = await getShellcheck().lint(script, { severity: 'info' });
    expect(results2.length).toBeGreaterThan(0);
  });

  it('should exclude specific warning codes', async () => {
    const script = readFileSync(resolve(fixturesDir, 'sc2086.sh'), 'utf-8');

    const results = await getShellcheck().lint(script, { exclude: [2086] });
    const sc2086 = results.find((r) => r.code === 2086);
    expect(sc2086).toBeUndefined();
  });

  it('should include only specific warning codes', async () => {
    const script = readFileSync(resolve(fixturesDir, 'sc2086.sh'), 'utf-8');

    // Include only SC2086 - should get it
    const results = await getShellcheck().lint(script, { include: [2086] });
    const sc2086 = results.find((r) => r.code === 2086);
    expect(sc2086).toBeDefined();

    // Include only SC2164 - should not get SC2086
    const results2 = await getShellcheck().lint(script, { include: [2164] });
    const sc2086_2 = results2.find((r) => r.code === 2086);
    expect(sc2086_2).toBeUndefined();
  });

  it('should respect shell option', async () => {
    // SC3043: In POSIX sh, 'local' is undefined
    const script = 'local var=value';

    // With bash, SC3043 does not apply
    const bashResults = await getShellcheck().lint(script, { shell: 'bash' });
    const sc3043_bash = bashResults.find((r) => r.code === 3043);
    expect(sc3043_bash).toBeUndefined();

    // With sh, local should be flagged
    const shResults = await getShellcheck().lint(script, { shell: 'sh' });
    const sc3043_sh = shResults.find((r) => r.code === 3043);
    expect(sc3043_sh).toBeDefined();
  });

  it('should handle virtual files for sourced scripts', async () => {
    const mainScript = 'source ./lib.sh\necho "$MY_VAR"';

    const results = await getShellcheck().lint(mainScript, {
      files: {
        'lib.sh': 'MY_VAR="hello"',
      },
    });

    // Should not complain about MY_VAR being undefined
    const sc2154 = results.find((r) => r.code === 2154);
    expect(sc2154).toBeUndefined();
  });

  it('should return fix information when available', async () => {
    const script = 'echo $VAR';
    const results = await getShellcheck().lint(script);

    const sc2086 = results.find((r) => r.code === 2086);
    expect(sc2086).toBeDefined();
    // Note: Fix availability depends on ShellCheck version
    if (sc2086?.fix) {
      expect(sc2086.fix.replacements).toBeInstanceOf(Array);
    }
  });
});
