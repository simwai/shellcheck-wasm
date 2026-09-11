import { OpenFile, File, ConsoleStdout, WASI } from '@bjorn3/browser_wasi_shim';
import { p as parseLintResponse } from '../shared/shellcheck-wasm.D-14Pj2f.mjs';

class BrowserShellCheck {
  constructor(wasmUrl, jsUrl) {
    this.wasmUrl = wasmUrl;
    this.jsUrl = jsUrl;
  }
  exports = null;
  initialized = false;
  async initialize() {
    if (this.initialized) return;
    const fds = [
      new OpenFile(new File([])),
      ConsoleStdout.lineBuffered((msg) => console.log(`[shellcheck stdout] ${msg}`)),
      ConsoleStdout.lineBuffered((msg) => console.warn(`[shellcheck stderr] ${msg}`))
    ];
    const wasi = new WASI([], [], fds);
    const jsModule = await import(
      /* @vite-ignore */
      this.jsUrl
    );
    const jsffiWasmImports = {};
    const jsffi = jsModule.default(jsffiWasmImports);
    const response = await fetch(this.wasmUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch WASM: ${response.status} ${response.statusText}`);
    }
    const wasmBytes = await response.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(wasmBytes, {
      ghc_wasm_jsffi: jsffi,
      wasi_snapshot_preview1: wasi.wasiImport
    });
    Object.assign(jsffiWasmImports, instance.exports);
    wasi.initialize(
      instance
    );
    const exports = instance.exports;
    exports.hs_init(0, 0);
    this.exports = exports;
    this.initialized = true;
  }
  requireExports() {
    if (!this.initialized || !this.exports) throw new Error("Not initialized");
    return this.exports;
  }
  async lint(script, options) {
    if (!this.initialized) await this.initialize();
    const exports = this.requireExports();
    const json = await exports.lintWithOptions(script, JSON.stringify(options ?? {}));
    return parseLintResponse(json);
  }
  async lintWithOptions(script, options) {
    return this.lint(script, options);
  }
  terminate() {
    this.exports = null;
    this.initialized = false;
  }
  async getVersion() {
    if (!this.initialized) await this.initialize();
    const exports = this.requireExports();
    return exports.getVersion();
  }
}
let cachedInstance = null;
let cachedVersion = null;
async function createShellCheck(options) {
  const finalWasm = options?.wasmUrl ?? "/shellcheck.wasm";
  const finalJs = finalWasm.replace(/\.wasm($|\?)/, ".js$1");
  if (!options?.forceNew && cachedInstance && cachedVersion) {
    const instance2 = new BrowserShellCheck(finalWasm, finalJs);
    await instance2.initialize();
    const version = await instance2.getVersion();
    if (version === cachedVersion) {
      instance2.terminate();
      return cachedInstance;
    }
    cachedInstance.terminate();
  }
  const instance = new BrowserShellCheck(finalWasm, finalJs);
  await instance.initialize();
  cachedVersion = await instance.getVersion();
  cachedInstance = instance;
  return instance;
}
function resetCache() {
  if (cachedInstance) {
    cachedInstance.terminate();
    cachedInstance = null;
    cachedVersion = null;
  }
}

export { BrowserShellCheck, createShellCheck, resetCache };
