# shellcheck-wasm

[![npm version](https://img.shields.io/npm/v/shellcheck-wasm.svg)](https://www.npmjs.com/package/shellcheck-wasm)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/yourname/shellcheck-wasm)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](https://opensource.org/licenses/GPL-3.0)

**ShellCheck compiled to WebAssembly with a TypeScript API** — Run ShellCheck in the browser, Node.js, or any WASI runtime.

## Features

- 🚀 **Single WASM artifact** — Works in browser (via WASI polyfill) and Node.js (via wasmtime)
- 📦 **TypeScript-first API** — Full type definitions included
- 🔧 **Modern tooling** — Biome (lint/format), Vitest (test), Husky (hooks), lint-staged
- ⚡ **Fast** — Compiled with GHC 9.6+ WASM backend, optimized with `-O2`
- 🎯 **Compatible** — Matches ShellCheck v0.11.0 behavior exactly

## Installation

```bash
npm install shellcheck-wasm
# or
yarn add shellcheck-wasm
# or
pnpm add shellcheck-wasm
```

## Quick Start

### Node.js

```typescript
import { createShellCheck, lint } from 'shellcheck-wasm';

// One-liner
const results = await lint('echo $UNQUOTED_VAR');

// Or create a reusable instance
const shellcheck = await createShellCheck();
const results = shellcheck.lint('echo $VAR');
```

### Browser

```html
<script type="module">
  import { createShellCheck } from 'https://cdn.jsdelivr.net/npm/shellcheck-wasm@latest/dist/index.js';
  
  const shellcheck = await createShellCheck({
    wasmUrl: 'https://cdn.jsdelivr.net/npm/shellcheck-wasm@latest/dist/shellcheck.wasm'
  });
  
  const results = shellcheck.lint(document.getElementById('editor').value);
  console.log(results);
</script>
```

## API

### `createShellCheck(options?)`

Creates a ShellCheck instance.

```typescript
interface CreateOptions {
  /** Path or URL to the WASM file */
  wasmUrl?: string;
  /** Force runtime: 'node', 'browser', or 'auto' (default) */
  runtime?: 'node' | 'browser' | 'auto';
}
```

### `shellcheck.lint(script, options?)`

Lint a shell script.

```typescript
interface LintOptions {
  /** Shell dialect */
  shell?: 'bash' | 'sh' | 'dash' | 'ksh' | 'busybox';
  /** Minimum severity */
  severity?: 'error' | 'warning' | 'info' | 'style';
  /** Warning codes to exclude */
  exclude?: number[];
  /** Warning codes to include (only these) */
  include?: number[];
  /** Allow sourcing external files */
  externalSources?: boolean;
  /** Search paths for sourced files */
  sourcePaths?: string[];
  /** Virtual files for `source` command */
  files?: Record<string, string>;
}

interface LintResult {
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  code: number;           // ShellCheck code (e.g., 2086)
  severity: 'error' | 'warning' | 'info' | 'style';
  message: string;
  fix?: {
    replacements: Array<{
      startLine: number;
      startColumn: number;
      endLine: number;
      endColumn: number;
      text: string;
    }>;
  };
}
```

## Development

### Prerequisites

- **Node.js** ≥ 20
- **GHC WASM toolchain** (for building WASM):
  ```bash
  # Via Nix (recommended)
  nix shell 'gitlab:haskell-wasm/ghc-wasm-meta?host=gitlab.haskell.org'
  ```

### Setup

```bash
# Clone with submodules
git clone --recurse-submodules https://github.com/yourname/shellcheck-wasm
cd shellcheck-wasm

# Install dependencies
npm install

# Build WASM (requires GHC WASM toolchain)
npm run build:wasm

# Build TypeScript
npm run build

# Run tests
npm test
```

### Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Full build (TS + WASM) |
| `npm run build:wasm` | Build WASM only |
| `npm run test` | Run all tests |
| `npm run test:node` | Node integration tests |
| `npm run test:browser` | Browser integration tests |
| `npm run lint` | Lint with Biome |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run format` | Format with Biome |

### Project Structure

```
shellcheck-wasm/
├── src/
│   ├── index.ts              # Main entry point
│   ├── api.ts                # Public API
│   ├── types.ts              # TypeScript types
│   ├── runtime/
│   │   ├── node.ts           # Node.js runtime (wasmtime)
│   │   └── browser.ts        # Browser runtime (WASI polyfill)
│   └── __tests__/            # Vitest tests
├── wasm/
│   ├── Main.hs               # WASM entry point (JS FFI)
│   └── ShellCheck/Wasm/      # Haskell WASM layer
├── shellcheck/               # ShellCheck source (git submodule)
├── scripts/                  # Build scripts
├── dist/                     # Build output
├── cabal.project             # Cabal config
├── shellcheck-wasm.cabal     # WASM package
├── package.json
├── tsconfig.json
├── biome.json
├── vitest.config.ts
└── .husky/                   # Git hooks
```

## Building the WASM

The WASM is built using GHC's native `wasm32-wasi` backend:

```bash
# Requires wasm32-wasi-ghc in PATH
npm run build:wasm
```

This produces:
- `dist/shellcheck.wasm` — The WebAssembly module
- `dist/shellcheck.js` — JS glue code (generated by GHC)
- `dist/shellcheck.d.ts` — TypeScript definitions

### Regex-tdfa Note

ShellCheck depends on `regex-tdfa` which uses C FFI. The build uses a **JavaScript RegExp shim** via GHC's JS FFI when the `use-js-regex` cabal flag is enabled (default for WASM). This avoids linking C code and works in both browser and Node.

## Testing

```bash
# Unit tests (no WASM required)
npm run test

# Node integration tests (requires built WASM)
npm run test:node

# Browser tests (run in browser or jsdom)
npm run test:browser
```

Test fixtures are in `test/fixtures/` — add `.sh` files with expected behaviors.

## License

GPL-3.0-or-later — Same as ShellCheck.

ShellCheck is copyright Vidar Holen and contributors.
This WASM wrapper is a derivative work.

## Credits

- **ShellCheck** by Vidar Holen et al. — https://www.shellcheck.net/
- **GHC WASM Backend** by Cheng Shao, Tweag, and GHC team
- **wasmtime** / **@wasmer/wasi** for runtime support