import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { OpenFile, File, ConsoleStdout, WASI } from '@bjorn3/browser_wasi_shim';
import { i as isJsFfiGlueModule, a as assertReactorExports, p as parseLintResponse } from '../shared/shellcheck-wasm.DIDZ6e2P.mjs';

const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = path.dirname(__filename$1);
class NodeShellCheck {
  constructor(wasmPath, jsPath) {
    this.wasmPath = wasmPath;
    this.jsPath = jsPath;
  }
  exports = null;
  initialized = false;
  async initialize() {
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
      ConsoleStdout.lineBuffered((msg) => console.warn(`[shellcheck stderr] ${msg}`))
    ];
    const wasi = new WASI([], [], fds);
    const jsModule = await import(pathToFileURL(this.jsPath).href);
    if (!isJsFfiGlueModule(jsModule)) throw new Error("Invalid shellcheck JSFFI glue module");
    const jsffiWasmImports = {};
    const jsffi = jsModule.default(jsffiWasmImports);
    const imports = {
      ghc_wasm_jsffi: jsffi,
      wasi_snapshot_preview1: wasi.wasiImport
    };
    const { instance } = await WebAssembly.instantiate(wasmBytes, imports);
    Object.assign(jsffiWasmImports, instance.exports);
    const memory = instance.exports.memory;
    if (!(memory instanceof WebAssembly.Memory))
      throw new Error("Invalid WASM exports: missing memory");
    wasi.initialize({ exports: { memory } });
    assertReactorExports(instance.exports);
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
  const normalized = typeof options === "string" ? { wasmPath: options } : options;
  const defaultWasm = path.resolve(__dirname$1, "../../dist/shellcheck.wasm");
  const finalWasm = normalized?.wasmPath ?? defaultWasm;
  const finalJs = path.resolve(path.dirname(finalWasm), "shellcheck.js");
  if (!normalized?.forceNew && cachedInstance && cachedVersion) {
    const instance2 = new NodeShellCheck(finalWasm, finalJs);
    await instance2.initialize();
    const version = await instance2.getVersion();
    if (version === cachedVersion) {
      instance2.terminate();
      return cachedInstance;
    }
    cachedInstance.terminate();
  }
  const instance = new NodeShellCheck(finalWasm, finalJs);
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

export { NodeShellCheck, createShellCheck, resetCache };
