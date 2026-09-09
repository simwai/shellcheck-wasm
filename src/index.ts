/**
 * shellcheck-wasm - ShellCheck compiled to WebAssembly
 *
 * @packageDocumentation
 */

export {
  createShellCheck,
  lint,
  lintWithOptions,
  resetShellCheck,
} from './api.js';

export type {
  LintOptions,
  LintResult,
  Replacement,
  FixInfo,
  ShellCheckWasmInstance,
} from './types.js';
