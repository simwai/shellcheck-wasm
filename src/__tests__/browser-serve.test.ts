/**
 * Browser runtime path test (runs in Node).
 *
 * Spins up a local HTTP server for dist/ and drives the real
 * BrowserShellCheck class against it: the .wasm module is fetched over
 * HTTP exactly like in a browser, instantiated with the WASI shim, and
 * linted. (Only the glue import uses a file:// URL since Node cannot
 * import ESM over HTTP; the glue itself is identical in browsers.)
 *
 * Skipped when dist/shellcheck.wasm is not built.
 */

import { existsSync, readFileSync } from 'node:fs';
import { type Server, createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BrowserShellCheck } from '../runtime/browser.js';
import type { ShellCheckWasmInstance } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const projectRoot = resolve(__dirname, '../..');
const distDir = resolve(projectRoot, 'dist');
const wasmPath = resolve(distDir, 'shellcheck.wasm');
const jsPath = resolve(distDir, 'shellcheck.js');

const distBuilt = existsSync(wasmPath) && existsSync(jsPath);

const describeIf = distBuilt ? describe : describe.skip;

describeIf('Browser runtime over HTTP', () => {
  let server: Server | null = null;
  let baseUrl = '';
  let shellcheck: ShellCheckWasmInstance | null = null;

  beforeAll(async () => {
    const wasmBytes = readFileSync(wasmPath);
    const jsBytes = readFileSync(jsPath);

    server = createServer((req, res) => {
      if (req.url === '/shellcheck.wasm') {
        res.writeHead(200, { 'content-type': 'application/wasm' });
        res.end(wasmBytes);
      } else if (req.url === '/shellcheck.js') {
        res.writeHead(200, { 'content-type': 'text/javascript' });
        res.end(jsBytes);
      } else {
        res.writeHead(404);
        res.end('not found');
      }
    });
    await new Promise<void>((resolvePromise) => {
      server?.listen(0, '127.0.0.1', () => resolvePromise());
    });
    const address = server?.address();
    if (typeof address !== 'object' || address === null) {
      throw new Error('Failed to bind test HTTP server');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;

    // .wasm over HTTP (browser path); glue via file:// (Node ESM limit).
    const instance = new BrowserShellCheck(
      `${baseUrl}/shellcheck.wasm`,
      pathToFileURL(jsPath).href
    );
    await instance.initialize();
    shellcheck = instance;
  }, 60000);

  afterAll(async () => {
    shellcheck?.terminate();
    shellcheck = null;
    await new Promise<void>((resolvePromise) => {
      if (server) server.close(() => resolvePromise());
      else resolvePromise();
    });
    server = null;
  });

  const getShellcheck = (): ShellCheckWasmInstance => {
    if (!shellcheck) throw new Error('shellcheck not initialized');
    return shellcheck;
  };

  it('serves the wasm with the correct MIME type', async () => {
    const res = await fetch(`${baseUrl}/shellcheck.wasm`);
    expect(res.ok).toBe(true);
    expect(res.headers.get('content-type')).toBe('application/wasm');
  });

  it('lints through the browser runtime', async () => {
    const results = await getShellcheck().lint('echo $VAR');
    const sc2086 = results.find((r) => r.code === 2086);
    expect(sc2086).toBeDefined();
    expect(sc2086?.message).toContain('Double quote');
  });

  it('returns no warnings for a clean script', async () => {
    const results = await getShellcheck().lint('#!/bin/bash\necho "hello"');
    expect(results).toEqual([]);
  });
});
