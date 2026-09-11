import { S as ShellCheckWasmInstance, L as LintOptions, a as LintResult } from './shared/shellcheck-wasm.jupZzq3L.js';
export { F as FixInfo, R as Replacement } from './shared/shellcheck-wasm.jupZzq3L.js';

declare function createShellCheck(options?: {
    wasmUrl?: string;
    runtime?: 'node' | 'browser' | 'auto';
    forceNew?: boolean;
}): Promise<ShellCheckWasmInstance>;
/**
 * @deprecated Use `lintWithOptions` instead. This convenience wrapper calls
 * `lintWithOptions` with default options and will be removed in a future version.
 */
declare function lint(script: string, options?: LintOptions): Promise<LintResult[]>;
declare function lintWithOptions(script: string, options: LintOptions): Promise<LintResult[]>;
declare function resetShellCheck(): void;

export { LintOptions, LintResult, ShellCheckWasmInstance, createShellCheck, lint, lintWithOptions, resetShellCheck };
