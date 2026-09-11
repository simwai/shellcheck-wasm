/**
 * Vitest ProvidedContext augmentation for browser tests.
 * test/serve-dist.ts (globalSetup) provides `wasmUrl`, consumed via
 * inject('wasmUrl') in src/__tests__/browser.test.ts.
 */
import 'vitest'

declare module 'vitest' {
  export interface ProvidedContext {
    wasmUrl: string
  }
}
