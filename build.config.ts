import { defineBuildConfig } from 'unbuild'
import { glob } from 'glob'

export default defineBuildConfig({
  entries: [
    'src/index.ts',
    'src/runtime/node.ts',
    'src/runtime/browser.ts',
  ],
  outDir: 'dist',
  declaration: true,
  externals: [
    '@bjorn3/browser_wasi_shim',
  ],
  clean: false,
  failOnWarn: false,
  hooks: {
    async 'build:done'(ctx) {
      // Copy WASM and JSFFI glue from cabal build output (created by build-wasm.sh)
      const { copyFileSync, existsSync, mkdirSync } = await import('node:fs')
      const { resolve } = await import('node:path')

      const projectRoot = resolve(ctx.cwd || process.cwd())
      const distDir = resolve(projectRoot, 'dist')

      mkdirSync(distDir, { recursive: true })

      // Find the built WASM file in dist-newstyle
      const wasmFiles = await glob('dist-newstyle/**/shellcheck-wasm.wasm', { cwd: projectRoot, absolute: true })

      if (wasmFiles.length === 0) {
        console.warn('⚠️  shellcheck.wasm not found in dist-newstyle')
        return
      }

      const wasmSrc = wasmFiles[0]
      const wasmDest = resolve(distDir, 'shellcheck.wasm')
      const jsSrc = resolve(projectRoot, 'dist/shellcheck.js')
      const jsDest = resolve(distDir, 'shellcheck.js')

      copyFileSync(wasmSrc, wasmDest)
      console.log('✅ Copied shellcheck.wasm → dist/')

      // The bash script already generates shellcheck.js via post-link
      if (existsSync(jsSrc)) {
        copyFileSync(jsSrc, jsDest)
        console.log('✅ Copied shellcheck.js (JSFFI glue) → dist/')
      } else {
        console.warn('⚠️  shellcheck.js not found in dist/ (run build:wasm first)')
      }
    },
  },
})