#!/usr/bin/env bash
set -euo pipefail

# Build script for shellcheck-wasm.
#
# Uses the wasm32-wasi cross compiler from ghc-wasm-meta -- a stock ghcup
# GHC cannot emit wasm32-wasi (GHC is single-target). Install once via:
#
#   curl https://gitlab.haskell.org/haskell-wasm/ghc-wasm-meta/-/raw/master/bootstrap.sh | sh
#   source ~/.ghc-wasm/env
#
# which provides: wasm32-wasi-ghc, wasm32-wasi-ghc-pkg, wasm32-wasi-hsc2hs
# and the wasm32-wasi-cabal wrapper. Requires: curl, jq, unzip, zstd.
# NOTE: use cabal <= 3.14 with the wrapper (3.16 has a fatal regression).

echo "Building shellcheck-wasm..."

# Pick up the ghc-wasm-meta env if present (adds cross tools to PATH).
if [ -f "$HOME/.ghc-wasm/env" ]; then
  # shellcheck disable=SC1091
  source "$HOME/.ghc-wasm/env"
fi

if ! command -v wasm32-wasi-ghc &> /dev/null; then
  echo "ERROR: wasm32-wasi-ghc not found in PATH" >&2
  echo "" >&2
  echo "Install the prebuilt GHC WASM toolchain (no compilation needed):" >&2
  echo "  curl https://gitlab.haskell.org/haskell-wasm/ghc-wasm-meta/-/raw/master/bootstrap.sh | sh" >&2
  echo "  source ~/.ghc-wasm/env" >&2
  echo "" >&2
  echo "See https://github.com/haskell-wasm/ghc-wasm-meta for flavours" >&2
  echo "(default 9.14; 9.10/9.12 also available via FLAVOUR=9.10)." >&2
  exit 1
fi

echo "Found: $(wasm32-wasi-ghc --version)"

# Ensure we're in the project root
cd "$(dirname "$0")/.."

# Build with the cross compiler. Prefer the wrapper (sets --with-hc-pkg
# and --with-hsc2hs automatically); fall back to explicit flags.
echo "Building with wasm32-wasi toolchain..."
if command -v wasm32-wasi-cabal &> /dev/null; then
  wasm32-wasi-cabal build exe:shellcheck-wasm
  WASM_PATH=$(wasm32-wasi-cabal list-bin exe:shellcheck-wasm)
else
  cabal --with-compiler=wasm32-wasi-ghc \
        --with-hc-pkg=wasm32-wasi-ghc-pkg \
        --with-hsc2hs=wasm32-wasi-hsc2hs \
        build exe:shellcheck-wasm
  WASM_PATH=$(cabal --with-compiler=wasm32-wasi-ghc list-bin exe:shellcheck-wasm)
fi

if [ ! -f "$WASM_PATH" ]; then
  echo "ERROR: built wasm module not found at $WASM_PATH" >&2
  exit 1
fi
echo "Built WASM: $WASM_PATH"

# Post-link: generate the ghc_wasm_jsffi JS glue from the wasm module.
# Required whenever the module uses JavaScript FFI (our lint exports do).
echo "Running post-linker for JSFFI glue..."
POST_LINK="$(wasm32-wasi-ghc --print-libdir)/post-link.mjs"
if [ ! -f "$POST_LINK" ]; then
  echo "ERROR: post-link.mjs not found at $POST_LINK" >&2
  exit 1
fi

mkdir -p dist
cp "$WASM_PATH" dist/shellcheck.wasm
node "$POST_LINK" -i dist/shellcheck.wasm -o dist/shellcheck.js

WASM_SIZE=$(wc -c < dist/shellcheck.wasm | tr -d ' ')
JS_SIZE=$(wc -c < dist/shellcheck.js | tr -d ' ')

echo ""
echo "Build complete!"
echo "  dist/shellcheck.wasm ($WASM_SIZE bytes)"
echo "  dist/shellcheck.js   ($JS_SIZE bytes, post-link JSFFI glue)"
echo ""
echo "Test with: npm run test:node"
