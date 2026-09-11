import type { LintResult } from '../types.js'

export interface ReactorExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory
  _initialize(): void
  hs_init(argc: number, argv: number): void
  lintWithOptions(script: string, optionsJson: string): Promise<string>
  getVersion(): Promise<string>
}

export interface JsFfiGlueModule {
  default: (imports: unknown) => Record<string, WebAssembly.ImportValue>
}

export function isJsFfiGlueModule(value: unknown): value is JsFfiGlueModule {
  return (
    typeof value === 'object' &&
    value !== null &&
    'default' in value &&
    typeof value.default === 'function'
  )
}

export function assertReactorExports(value: unknown): asserts value is ReactorExports {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Invalid WASM exports: expected an object')
  }
  if (!('memory' in value) || !(value.memory instanceof WebAssembly.Memory)) {
    throw new Error('Invalid WASM exports: missing memory')
  }
  if (!('hs_init' in value) || typeof value.hs_init !== 'function') {
    throw new Error('Invalid WASM exports: missing hs_init')
  }
  if (!('lintWithOptions' in value) || typeof value.lintWithOptions !== 'function') {
    throw new Error('Invalid WASM exports: missing lintWithOptions')
  }
  if (!('getVersion' in value) || typeof value.getVersion !== 'function') {
    throw new Error('Invalid WASM exports: missing getVersion')
  }
}

const SEVERITIES = new Set(['error', 'warning', 'info', 'style'])

function isLintResult(value: unknown): value is LintResult {
  if (typeof value !== 'object' || value === null) return false
  if (!('file' in value) || typeof value.file !== 'string') return false
  if (!('line' in value) || typeof value.line !== 'number') return false
  if (!('column' in value) || typeof value.column !== 'number') return false
  if (!('code' in value) || typeof value.code !== 'number') return false
  if (!('severity' in value) || typeof value.severity !== 'string') return false
  if (!SEVERITIES.has(value.severity)) return false
  if (!('message' in value) || typeof value.message !== 'string') return false
  return true
}

/**
 * Parse the JSON response from the WASM module's lint exports.
 * Throws on error response format.
 */
export function parseLintResponse(json: string): LintResult[] {
  const result: unknown = JSON.parse(json)
  if (Array.isArray(result)) {
    if (result.every(isLintResult)) return result
    throw new Error('Unexpected response format')
  }
  if (typeof result === 'object' && result !== null && 'error' in result) {
    throw new Error(String(result.error))
  }
  throw new Error('Unexpected response format')
}
