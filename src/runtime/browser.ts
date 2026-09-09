import { ConsoleStdout, File, OpenFile, WASI } from '@bjorn3/browser_wasi_shim';
import type { LintOptions, LintResult, ShellCheckWasmInstance } from '../types.js';

interface ReactorExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  _initialize(): void;
  hs_init(argc: number, argv: number): void;
  lint(script: string): Promise<string>;
  lintWithOptions(script: string, optionsJson: string): Promise<string>;
}

export class BrowserShellCheck implements ShellCheckWasmInstance {
  private exports: ReactorExports | null = null;
  private initialized = false;

  constructor(
    private wasmUrl: string,
    private jsUrl: string
  ) {}

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const fds = [
      new OpenFile(new File([])),
      ConsoleStdout.lineBuffered((msg) => console.log(`[shellcheck stdout] ${msg}`)),
      ConsoleStdout.lineBuffered((msg) => console.warn(`[shellcheck stderr] ${msg}`)),
    ];
    const wasi = new WASI([], [], fds);

    const jsModule = (await import(/* @vite-ignore */ this.jsUrl)) as {
      default: (exports: unknown) => Record<string, WebAssembly.ImportValue>;
    };
    const jsffiWasmImports: Record<string, unknown> = {};
    const jsffi = jsModule.default(jsffiWasmImports);

    const response = await fetch(this.wasmUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch WASM: ${response.status} ${response.statusText}`);
    }
    const wasmBytes = await response.arrayBuffer();

    const { instance } = await WebAssembly.instantiate(wasmBytes, {
      ghc_wasm_jsffi: jsffi,
      wasi_snapshot_preview1: wasi.wasiImport,
    } as WebAssembly.Imports);

    Object.assign(jsffiWasmImports, instance.exports);

    wasi.initialize(
      instance as unknown as {
        exports: { memory: WebAssembly.Memory; _initialize?: () => unknown };
      }
    );
    const exports = instance.exports as unknown as ReactorExports;
    exports.hs_init(0, 0);

    this.exports = exports;
    this.initialized = true;
  }

  private requireExports(): ReactorExports {
    if (!this.initialized || !this.exports) throw new Error('Not initialized');
    return this.exports;
  }

  async lint(script: string, options?: LintOptions): Promise<LintResult[]> {
    if (!this.initialized) await this.initialize();
    const exports = this.requireExports();
    const json = await exports.lintWithOptions(script, JSON.stringify(options ?? {}));
    return parseLintResponse(json);
  }

  async lintWithOptions(script: string, options: LintOptions): Promise<LintResult[]> {
    return this.lint(script, options);
  }

  terminate(): void {
    this.exports = null;
    this.initialized = false;
  }
}

export function parseLintResponse(json: string): LintResult[] {
  const result = JSON.parse(json) as unknown;
  if (Array.isArray(result)) return result as LintResult[];
  if (typeof result === 'object' && result !== null && 'error' in result) {
    throw new Error(String((result as { error: unknown }).error));
  }
  throw new Error('Unexpected response format');
}

let cachedInstance: BrowserShellCheck | null = null;

export async function createShellCheck(wasmUrl?: string): Promise<ShellCheckWasmInstance> {
  if (cachedInstance) return cachedInstance;

  const finalWasm = wasmUrl ?? '/shellcheck.wasm';
  const finalJs = finalWasm.replace(/\.wasm($|\?)/, '.js$1');

  const instance = new BrowserShellCheck(finalWasm, finalJs);
  await instance.initialize();
  cachedInstance = instance;
  return instance;
}

export function resetCache(): void {
  if (cachedInstance) {
    cachedInstance.terminate();
    cachedInstance = null;
  }
}
