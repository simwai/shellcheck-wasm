import { ShellCheckWasmInstance, LintOptions, LintResult } from '../index.mjs';

declare class NodeShellCheck implements ShellCheckWasmInstance {
    private wasmPath;
    private jsPath;
    private exports;
    private initialized;
    constructor(wasmPath: string, jsPath: string);
    initialize(): Promise<void>;
    private requireExports;
    lint(script: string, options?: LintOptions): Promise<LintResult[]>;
    lintWithOptions(script: string, options: LintOptions): Promise<LintResult[]>;
    terminate(): void;
    getVersion(): Promise<string>;
}
declare function createShellCheck(options?: {
    wasmPath?: string;
    forceNew?: boolean;
}): Promise<ShellCheckWasmInstance>;
declare function resetCache(): void;

export { NodeShellCheck, createShellCheck, resetCache };
