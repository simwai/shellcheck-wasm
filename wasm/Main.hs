-- | WASM entry point.
--
-- All JavaScript exports live in 'ShellCheck.Wasm.API' (the single place
-- where @foreign export javascript@ declarations may appear). This module
-- only exists because a cabal executable component requires a @Main@
-- module; with @-no-hs-main@ the @main@ below is never used at runtime.
module Main (main) where

import ShellCheck.Wasm.API ()

main :: IO ()
main = pure ()
