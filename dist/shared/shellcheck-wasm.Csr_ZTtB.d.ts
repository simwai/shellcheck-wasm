/**
 * TypeScript types for shellcheck-wasm
 * Mirrors the Haskell types in ShellCheck.Wasm.Types
 */
interface LintOptions {
    /** Shell dialect to use */
    shell?: 'bash' | 'sh' | 'dash' | 'ksh' | 'busybox';
    /** Minimum severity to report */
    severity?: 'error' | 'warning' | 'info' | 'style';
    /** Warning codes to exclude */
    exclude?: number[];
    /** Warning codes to include (only these) */
    include?: number[];
    /** Allow sourcing files outside the input */
    externalSources?: boolean;
    /** Paths to search for sourced files */
    sourcePaths?: string[];
    /** Virtual files for sourced scripts (path -> content) */
    files?: Record<string, string>;
}
interface Replacement {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
    text: string;
}
interface FixInfo {
    replacements: Replacement[];
}
interface LintResult {
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
interface ShellCheckWasmInstance {
    /** Lint a shell script */
    lint(script: string, options?: LintOptions): Promise<LintResult[]>;
    /** Lint with pre-parsed options object */
    lintWithOptions(script: string, options: LintOptions): Promise<LintResult[]>;
    /** Terminate the instance */
    terminate(): void;
}

export type { FixInfo as F, LintOptions as L, Replacement as R, ShellCheckWasmInstance as S, LintResult as a };
