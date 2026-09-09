# shellcheck-wasm

ShellCheck 0.11 compiled to WebAssembly, with a typed TypeScript API for Node.js and browsers.

The module is built with GHC's WebAssembly backend (`wasm32-wasi`) as a WASI reactor exposing two async JSFFI exports, `lint` and `lintWithOptions`. Both runtimes load the same artifact; the only difference is how the WASI imports are provided.

## Requirements

- Node.js >= 20
- The prebuilt `dist/shellcheck.wasm` + `dist/shellcheck.js` (see [Building the WASM module](#building-the-wasm-module)), or build them yourself with the GHC WASM toolchain

## Installation

The package is not published to npm yet. Use it from source:

```bash
git clone --recurse-submodules <repo-url> shellcheck-wasm
cd shellcheck-wasm
npm install
```

## Usage

### Node.js

```typescript
import { createShellCheck, lint } from 'shellcheck-wasm';

// One-shot
const results = await lint('echo $UNQUOTED_VAR');

// Reusable instance (module is instantiated once and reused)
const shellcheck = await createShellCheck();
const results2 = await shellcheck.lint('echo $VAR', { severity: 'warning' });
```

By default the loader resolves `dist/shellcheck.wasm` relative to the package. Pass an explicit path when needed:

```typescript
const shellcheck = await createShellCheck({ wasmUrl: '/path/to/shellcheck.wasm' });
```

### Browser

Serve `dist/shellcheck.wasm` and `dist/shellcheck.js` from the same origin with correct MIME types (`application/wasm` for the `.wasm` file), then:

```typescript
import { createShellCheck } from 'shellcheck-wasm';

const shellcheck = await createShellCheck({ wasmUrl: '/shellcheck.wasm' });
const results = await shellcheck.lint(editorValue);
console.log(results);
```

`wasmUrl` may be any absolute or relative URL. The companion `shellcheck.js` (post-link JSFFI glue) is resolved by replacing the `.wasm` suffix with `.js`.

## API reference

### `createShellCheck(options?)`

Creates (or returns the cached) ShellCheck instance, instantiating the WASM module on first call.

```typescript
await createShellCheck(options?: {
  wasmUrl?: string;              // path or URL of shellcheck.wasm
  runtime?: 'node' | 'browser' | 'auto';  // default 'auto'
});
```

### `lint(script, options?)`

```typescript
await lint('echo $VAR');                          // LintResult[]
await lint('echo $VAR', { severity: 'error' });   // filtered
```

### `lintWithOptions(script, options)`

Same as `lint` with required options object.

### `resetShellCheck()`

Terminates the cached instance. Mainly useful in tests.

### `LintOptions`

```typescript
interface LintOptions {
  shell?: 'bash' | 'sh' | 'dash' | 'ksh' | 'busybox';
  severity?: 'error' | 'warning' | 'info' | 'style';
  exclude?: number[];      // warning codes to suppress, e.g. [2086]
  include?: number[];      // if set, only these codes are reported
  externalSources?: boolean;
  sourcePaths?: string[];
  files?: Record<string, string>;  // virtual files for `source` directives
}
```

Severity filtering matches ShellCheck semantics: setting `severity: 'error'` hides `info`-level findings such as SC2086.

### `LintResult`

```typescript
interface LintResult {
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  code: number;   // e.g. 2086
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

Example output for `echo $VAR`:

```json
[
  {
    "code": 2148, "severity": "error",
    "message": "Tips depend on target shell and yours is unknown. Add a shebang or a 'shell' directive."
  },
  {
    "code": 2086, "severity": "info",
    "message": "Double quote to prevent globbing and word splitting.",
    "fix": { "replacements": [
      { "startLine": 1, "startColumn": 6, "endLine": 1, "endColumn": 6, "text": "\"" },
      { "startLine": 1, "startColumn": 10, "endLine": 1, "endColumn": 10, "text": "\"" }
    ] }
  }
]
```

## How it works

```
shellcheck/ (v0.11.0 submodule, unmodified)
  └─ wasm/Main.hs + wasm/ShellCheck/Wasm/*
       │  wasm32-wasi-ghc 9.10 (ghc-wasm-meta, FLAVOUR=9.10)
       │  -no-hs-main -optl-mexec-model=reactor
       ▼
dist/shellcheck.wasm  (~17 MB, WASI reactor)
dist/shellcheck.js    (post-link.mjs JSFFI glue)
       │  src/runtime/{node,browser}.ts
       ▼
  lint(script, options?) → Promise<LintResult[]>
```

Key design points:

- **Single entry point.** The Haskell layer calls `ShellCheck.Checker.checkScript` directly and maps `CheckResult` to JSON. No CLI parsing, no formatters, no filesystem access inside the module.
- **In-memory filesystem.** `source` directives resolve against the `files` option map; there is no host filesystem access from WASM. Each `lint` call builds a fresh interface, so concurrent or repeated calls share no state.
- **Reactor lifecycle.** Callers must `_initialize` once, then `hs_init(0, 0)`, then `await` the async exports. Both runtimes implement exactly this sequence; see the GHC user's guide section on JavaScript FFI in the wasm backend.
- **No regex shim.** `regex-tdfa` is pure Haskell and compiles to `wasm32-wasi` unmodified.
- **One WASI implementation.** Both runtimes use `@bjorn3/browser_wasi_shim`. Node's builtin `node:wasi` was tried and aborts reactor initialization with an opaque exit-code throw; the shim initializes cleanly in both environments.

## Building the WASM module

Requires the prebuilt GHC WASM toolchain (a stock `ghcup` GHC is single-target and cannot emit `wasm32-wasi`):

```bash
# One-time toolchain install (Linux x86_64, no compilation, ~1 GB)
curl https://gitlab.haskell.org/haskell-wasm/ghc-wasm-meta/-/raw/master/bootstrap.sh | sh
source ~/.ghc-wasm/env

npm run build:wasm
```

`scripts/build-wasm.sh` builds `exe:shellcheck-wasm` with the `wasm32-wasi-cabal` wrapper, then runs GHC's `post-link.mjs` to generate the JSFFI glue. Output lands in `dist/`. Use `cabal` <= 3.14 with the wrapper (3.16 has a known regression with this toolchain).

## Development

```bash
npm install          # install JS dependencies
npm run build        # tsc (WASM step requires the toolchain; see above)
npm test             # Node suites: unit + integration + browser-path-over-HTTP
npm run test:browser # real headless Chromium via @vitest/browser + Playwright
npm run lint         # Biome check
npm run lint:fix     # Biome check --write
```

Git hooks (Husky + lint-staged) run Biome on staged JS/TS files at commit and the test suite on push.

### Test matrix

| Suite | Environment | What it covers |
|---|---|---|
| `api.test.ts` | Node | Type shapes, response envelopes |
| `node.test.ts` | Node + built `.wasm` | SC2086/SC2164/SC3043 detection, severity/include/exclude filters, shell override, virtual `source` files, fix data |
| `browser-serve.test.ts` | Node + local HTTP | `BrowserShellCheck` fetching `.wasm` over HTTP |
| `browser.test.ts` | Real headless Chromium | Full browser path: fetch, instantiate, lint, options |

Integration suites skip automatically when `dist/shellcheck.wasm` is absent.

### Project structure

```
shellcheck-wasm/
├── src/
│   ├── index.ts              # public entry point
│   ├── api.ts                # createShellCheck / lint / resetShellCheck
│   ├── types.ts              # LintOptions, LintResult
│   ├── vitest-provided.d.ts  # ProvidedContext augmentation for browser tests
│   ├── runtime/
│   │   ├── node.ts           # Node loader (reads dist/ from disk)
│   │   └── browser.ts        # browser loader (fetch + WASI shim)
│   └── __tests__/            # Vitest suites
├── wasm/
│   ├── Main.hs               # stub (exports live in ShellCheck.Wasm.API)
│   └── ShellCheck/Wasm/
│       ├── API.hs            # foreign export javascript lint/lintWithOptions
│       ├── SystemInterface.hs# in-memory SystemInterface
│       └── Types.hs          # JSON types mirroring src/types.ts
├── shellcheck/               # upstream ShellCheck v0.11.0 (submodule)
├── test/
│   ├── fixtures/             # .sh fixtures
│   └── serve-dist.ts         # globalSetup: serves dist/ to browser tests
├── scripts/                  # build-wasm.sh, copy-wasm.ts, gen-types.ts
├── shellcheck-wasm.cabal
├── cabal.project
├── vitest.config.ts          # Node suites
└── vitest.browser.config.ts  # Chromium suite
```

`dist/` (compiled JS, `.wasm`, glue, generated `.d.ts`) and `dist-newstyle/` are gitignored build outputs.

## Known limitations

- The 17 MB module takes a few seconds to fetch and instantiate on first use; reuse the instance returned by `createShellCheck`.
- `externalSources`/`sourcePaths` are accepted but only virtual `files` can actually be resolved — the module has no host filesystem access.
- Exceptions inside the checker surface as an empty result array rather than a rejected promise; validate options client-side.
- Browser testing covers headless Chromium. Other engines should work (the module only needs post-MVP features all modern browsers ship), but they are not in the matrix.

## License

GPL-3.0-or-later, same as ShellCheck. ShellCheck is copyright Vidar Holen and contributors; this wrapper is a derivative work.
