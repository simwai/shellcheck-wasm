import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ConsoleStdout, File, OpenFile, WASI } from '@bjorn3/browser_wasi_shim';
import type { LintOptions, LintResult, ShellCheckWasmInstance } from '../types.js';
import { parseLintResponse } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ReactorExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  _initialize(): void;
  hs_init(argc: number, argv: number): void;
  lintWithOptions(script: string, optionsJson: string): Promise<string>;
  getVersion(): Promise<string>;
}

export class NodeShellCheck implements ShellCheckWasmInstance {
  private exports: ReactorExports | null = null;
  private initialized = false;

  constructor(
    private wasmPath: string,
    private jsPath: string
  ) {}

  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!fs.existsSync(this.wasmPath) || !fs.existsSync(this.jsPath)) {
      throw new Error(
        `shellcheck.wasm not built (missing ${this.wasmPath} or ${this.jsPath}). Run: npm run build:wasm`
      );
    }

    const wasmBytes = fs.readFileSync(this.wasmPath);

    const fds = [
      new OpenFile(new File([])),
      ConsoleStdout.lineBuffered((msg) => console.log(`[shellcheck stdout] ${msg}`)),
      ConsoleStdout.lineBuffered((msg) => console.warn(`[shellcheck stderr] ${msg}`)),
    ];
    const wasi = new WASI([], [], fds);

    const jsModule = (await import(pathToFileURL(this.jsPath).href)) as {
      default: (exports: unknown) => Record<string, WebAssembly.ImportValue>;
    };
    const jsffiWasmImports: Record<string, unknown> = {};
    const jsffi = jsModule.default(jsffiWasmImports);

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

  async getVersion(): Promise<string> {
    if (!this.initialized) await this.initialize();
    const exports = this.requireExports();
    return exports.getVersion();
  }
}

let cachedInstance: NodeShellCheck | null = null;
let cachedVersion: string | null = null;

export async function createShellCheck(
  options?: string | { wasmPath?: string; forceNew?: boolean }
): Promise<ShellCheckWasmInstance> {
  const normalized = typeof options === 'string' ? { wasmPath: options } : options;
  const defaultWasm = path.resolve(__dirname, '../../dist/shellcheck.wasm');
  const finalWasm = normalized?.wasmPath ?? defaultWasm;
  const finalJs = path.resolve(path.dirname(finalWasm), 'shellcheck.js');

  // Check if we need to create a new instance
  if (!normalized?.forceNew && cachedInstance && cachedVersion) {
    const instance = new NodeShellCheck(finalWasm, finalJs);
    await instance.initialize();
    const version = await instance.getVersion();
    if (version === cachedVersion) {
      instance.terminate();
      return cachedInstance;
    }
    // Version mismatch, terminate old instance
    cachedInstance.terminate();
  }

  const instance = new NodeShellCheck(finalWasm, finalJs);
  await instance.initialize();
  cachedVersion = await instance.getVersion();
  cachedInstance = instance;
  return instance;
}

export function resetCache(): void {
  if (cachedInstance) {
    cachedInstance.terminate();
    cachedInstance = null;
    cachedVersion = null;
  }
}
