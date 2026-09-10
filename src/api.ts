import type { LintOptions, LintResult, ShellCheckWasmInstance } from './types.js';

let runtimeInstance: ShellCheckWasmInstance | null = null;

export async function createShellCheck(options?: {
  wasmUrl?: string;
  runtime?: 'node' | 'browser' | 'auto';
  forceNew?: boolean;
}): Promise<ShellCheckWasmInstance> {
  if (runtimeInstance && !options?.forceNew) return runtimeInstance;

  const isNode = typeof process !== 'undefined' && process.versions?.node;
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

  let runtime = options?.runtime || 'auto';
  if (runtime === 'auto') {
    runtime = isNode ? 'node' : isBrowser ? 'browser' : 'node';
  }

  let instance: ShellCheckWasmInstance;

  if (runtime === 'node') {
    const { createShellCheck: createNodeShellCheck } = await import('./runtime/node.js');
    instance = await createNodeShellCheck({
      wasmPath: options?.wasmUrl,
      forceNew: options?.forceNew,
    });
  } else if (runtime === 'browser') {
    const { createShellCheck: createBrowserShellCheck } = await import('./runtime/browser.js');
    instance = await createBrowserShellCheck({
      wasmUrl: options?.wasmUrl,
      forceNew: options?.forceNew,
    });
  } else {
    throw new Error(`Unknown runtime: ${runtime}`);
  }

  runtimeInstance = instance;
  return instance;
}

/**
 * @deprecated Use `lintWithOptions` instead. This convenience wrapper calls
 * `lintWithOptions` with default options and will be removed in a future version.
 */
export async function lint(script: string, options?: LintOptions): Promise<LintResult[]> {
  const shellcheck = await createShellCheck();
  return shellcheck.lint(script, options);
}

export async function lintWithOptions(script: string, options: LintOptions): Promise<LintResult[]> {
  const shellcheck = await createShellCheck();
  return shellcheck.lintWithOptions(script, options);
}

export function resetShellCheck(): void {
  if (runtimeInstance) {
    runtimeInstance.terminate();
    runtimeInstance = null;
  }
}

export type {
  LintOptions,
  LintResult,
  Replacement,
  FixInfo,
  ShellCheckWasmInstance,
} from './types.js';
