/**
 * Main API entry point for shellcheck-wasm
 * Automatically selects the appropriate runtime (Node or Browser)
 */

import type { LintOptions, LintResult, ShellCheckWasmInstance } from './types.js';

let runtimeInstance: ShellCheckWasmInstance | null = null;

/**
 * Create a ShellCheck WASM instance
 * @param options - Configuration options
 * @returns ShellCheck instance for linting
 */
export async function createShellCheck(options?: {
  /** Path or URL to the WASM file */
  wasmUrl?: string;
  /** Force a specific runtime ('node' or 'browser') */
  runtime?: 'node' | 'browser' | 'auto';
}): Promise<ShellCheckWasmInstance> {
  if (runtimeInstance) return runtimeInstance;

  const isNode = typeof process !== 'undefined' && process.versions?.node;
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

  let runtime = options?.runtime || 'auto';
  if (runtime === 'auto') {
    runtime = isNode ? 'node' : isBrowser ? 'browser' : 'node';
  }

  let instance: ShellCheckWasmInstance;

  if (runtime === 'node') {
    const { createShellCheck: createNodeShellCheck } = await import('./runtime/node.js');
    instance = await createNodeShellCheck(options?.wasmUrl);
  } else if (runtime === 'browser') {
    const { createShellCheck: createBrowserShellCheck } = await import('./runtime/browser.js');
    instance = await createBrowserShellCheck(options?.wasmUrl);
  } else {
    throw new Error(`Unknown runtime: ${runtime}`);
  }

  runtimeInstance = instance;
  return instance;
}

/**
 * Lint a shell script (convenience function)
 * @param script - Shell script to lint
 * @param options - Lint options
 * @returns Array of lint results
 */
export async function lint(script: string, options?: LintOptions): Promise<LintResult[]> {
  const shellcheck = await createShellCheck();
  return shellcheck.lint(script, options);
}

/**
 * Lint a shell script with options object
 * @param script - Shell script to lint
 * @param options - Lint options
 * @returns Array of lint results
 */
export async function lintWithOptions(script: string, options: LintOptions): Promise<LintResult[]> {
  const shellcheck = await createShellCheck();
  return shellcheck.lintWithOptions(script, options);
}

/**
 * Reset the cached instance (useful for testing)
 */
export function resetShellCheck(): void {
  if (runtimeInstance) {
    runtimeInstance.terminate();
    runtimeInstance = null;
  }
}

// Re-export types
export type {
  LintOptions,
  LintResult,
  Replacement,
  FixInfo,
  ShellCheckWasmInstance,
} from './types.js';
