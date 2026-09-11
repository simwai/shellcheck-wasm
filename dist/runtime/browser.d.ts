import { ShellCheckWasmInstance, LintOptions, LintResult } from '../index.js';

declare class BrowserShellCheck implements ShellCheckWasmInstance {
    private wasmUrl;
    private jsUrl;
    private exports;
    private initialized;
    constructor(wasmUrl: string, jsUrl: string);
    initialize(): Promise<void>;
    private requireExports;
    lint(script: string, options?: LintOptions): Promise<LintResult[]>;
    lintWithOptions(script: string, options: LintOptions): Promise<LintResult[]>;
    terminate(): void;
    getVersion(): Promise<string>;
}
declare function createShellCheck(options?: string | {
    wasmUrl?: string;
    forceNew?: boolean;
}): Promise<ShellCheckWasmInstance>;
declare function resetCache(): void;

export { BrowserShellCheck, createShellCheck, resetCache };
