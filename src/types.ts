/**
 * TypeScript types for shellcheck-wasm
 * Mirrors the Haskell types in ShellCheck.Wasm.Types
 */

export interface LintOptions {
  /** Shell dialect to use */
  shell?: 'bash' | 'sh' | 'dash' | 'ksh' | 'busybox';
  /** Minimum severity to report */
  severity?: 'error' | 'warning' | 'info' | 'style';
  /** Warning codes to exclude */
  exclude?: number[];
  /** Warning codes to include (only these) */
  include?: number[];
  /** Virtual files for sourced scripts (path -> content) */
  files?: Record<string, string>;
}

export interface Replacement {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  text: string;
}

export interface FixInfo {
  replacements: Replacement[];
}

export interface LintResult {
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  code: number;
  severity: 'error' | 'warning' | 'info' | 'style';
  message: string;
  fix?: FixInfo;
}

export type LintResponse = LintResult[] | { error: string };

export interface ShellCheckWasmInstance {
  /** Lint a shell script (convenience wrapper, deprecated - use lintWithOptions) */
  lint(script: string, options?: LintOptions): Promise<LintResult[]>;
  /** Lint with pre-parsed options object */
  lintWithOptions(script: string, options: LintOptions): Promise<LintResult[]>;
  /** Get version string for cache invalidation */
  getVersion(): Promise<string>;
  /** Terminate the instance */
  terminate(): void;
}
