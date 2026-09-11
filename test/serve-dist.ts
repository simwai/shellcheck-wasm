#!/usr/bin/env tsx
/**
 * Vitest globalSetup for browser tests: serves dist/shellcheck.wasm and
 * dist/shellcheck.js over local HTTP and provides the wasm URL to tests
 * via inject('wasmUrl').
 *
 * Run with: npm run test:browser
 */

import { existsSync, readFileSync } from 'node:fs'
import { type Server, createServer } from 'node:http'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { GlobalSetupContext } from 'vitest/node'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const distDir = resolve(__dirname, '..', 'dist')

declare module 'vitest' {
  export interface ProvidedContext {
    wasmUrl: string
  }
}

export default async function setup({ provide }: GlobalSetupContext) {
  const wasmPath = resolve(distDir, 'shellcheck.wasm')
  const jsPath = resolve(distDir, 'shellcheck.js')
  if (!existsSync(wasmPath) || !existsSync(jsPath)) {
    throw new Error(
      'dist/shellcheck.wasm is missing. Build it first: npm run build:wasm (requires the GHC WASM toolchain, see README.md)'
    )
  }

  const files: Record<string, { data: Buffer; type: string }> = {
    '/shellcheck.wasm': { data: readFileSync(wasmPath), type: 'application/wasm' },
    '/shellcheck.js': { data: readFileSync(jsPath), type: 'text/javascript' },
  }

  const server: Server = createServer((req, res) => {
    const entry = files[req.url ?? '']
    if (entry) {
      res.writeHead(200, {
        'content-type': entry.type,
        'content-length': entry.data.length,
        'access-control-allow-origin': '*',
      })
      res.end(entry.data)
    } else {
      res.writeHead(404)
      res.end('not found')
    }
  })

  await new Promise<void>((resolvePromise) => {
    server.listen(0, '127.0.0.1', () => resolvePromise())
  })
  const address = server.address()
  if (typeof address !== 'object' || address === null) {
    throw new Error('Failed to bind test HTTP server')
  }
  provide('wasmUrl', `http://127.0.0.1:${address.port}/shellcheck.wasm`)

  return async () => {
    await new Promise<void>((resolvePromise) => {
      server.close(() => resolvePromise())
    })
  }
}
