import type { LintResult } from '../types.js';

/**
 * Parse the JSON response from the WASM module's lint exports.
 * Throws on error response format.
 */
export function parseLintResponse(json: string): LintResult[] {
  const result = JSON.parse(json) as unknown;
  if (Array.isArray(result)) return result as LintResult[];
  if (typeof result === 'object' && result !== null && 'error' in result) {
    throw new Error(String((result as { error: unknown }).error));
  }
  throw new Error('Unexpected response format');
}
