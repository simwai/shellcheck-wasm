{-# LANGUAGE OverloadedStrings #-}
{-# LANGUAGE ScopedTypeVariables #-}

-- | JavaScript-facing ShellCheck API.
--
-- This is the ONLY module that may contain @foreign export javascript@
-- declarations. Exports are asynchronous by default, so JavaScript callers
-- must @await@ them:
--
-- > const results = JSON.parse(await instance.exports.lintWithOptions(script, opts));
--
-- Each call is stateless: the virtual filesystem is built fresh from the
-- @files@ option, so no global 'IORef' state is needed (reactor instances
-- persist linear memory across calls; global Haskell state would leak
-- virtual files between unrelated lint runs).
module ShellCheck.Wasm.API
  ( lint
  , lintWithOptions
  ) where

import Control.Exception (SomeException, try)
import Data.Aeson (decodeStrict, encode)
import Data.ByteString.Lazy.Char8 (unpack)
import Data.Map.Strict (Map)
import qualified Data.Map.Strict as Map
import Data.Maybe (fromMaybe)
import Data.Text (Text)
import qualified Data.Text as T
import qualified Data.Text.Encoding as TE
import GHC.Wasm.Prim (JSString (..), fromJSString, toJSString)
import ShellCheck.Checker (checkScript)
import ShellCheck.Interface
import ShellCheck.Wasm.SystemInterface (newMemorySystemInterface)
import ShellCheck.Wasm.Types hiding (Replacement (..))
import qualified ShellCheck.Wasm.Types as WT

-- | Lint a shell script with default options. Input and output are JSON
-- strings decoded/encoded with 'LintOptions'/'LintResult'.
foreign export javascript "lint"
  lint :: JSString -> IO JSString

lint :: JSString -> IO JSString
lint script = do
  results <- checkTextIO (T.pack (fromJSString script)) defaultLintOptions
  pure . toJSString . unpack $ encode results

-- | Lint a shell script. First argument is the script source, second is a
-- JSON-encoded 'LintOptions' object (e.g. @"{\"severity\":\"error\"}"@).
foreign export javascript "lintWithOptions"
  lintWithOptions :: JSString -> JSString -> IO JSString

lintWithOptions :: JSString -> JSString -> IO JSString
lintWithOptions script optionsJson = do
  results <- checkTextIO (T.pack (fromJSString script)) opts
  pure . toJSString . unpack $ encode results
 where
  opts = fromMaybe defaultLintOptions $
    decodeStrict (TE.encodeUtf8 (T.pack (fromJSString optionsJson)))

-- | Run the checker and return lint results. Exceptions (if any) surface
-- as an empty result rather than a wasm trap; callers that need errors
-- should validate options client-side.
checkTextIO :: Text -> LintOptions -> IO [LintResult]
checkTextIO script opts = do
  outcome <- try (checkScript sys spec) :: IO (Either SomeException CheckResult)
  pure $ case outcome of
    Left _ -> []
    Right result -> map toLintResult (crComments result)
 where
  files :: Map FilePath String
  files = Map.mapKeys T.unpack . Map.map T.unpack $
    fromMaybe Map.empty (optFiles opts)

  sys = newMemorySystemInterface files

  spec =
    emptyCheckSpec
      { csFilename = "script.sh"
      , csScript = T.unpack script
      , csCheckSourced = True
      , csIgnoreRC = True
      , csExcludedWarnings = fromMaybe [] (optExclude opts)
      , csIncludedWarnings = optInclude opts
      , csShellTypeOverride = parseShell =<< optShell opts
      , csMinSeverity = fromMaybe StyleC (parseSeverity =<< optSeverity opts)
      , csOptionalChecks = []
      }

-- NOTE: GHC JSFFI async exports wrap @IO a@ as @Promise<a>@ automatically,
-- so JavaScript callers must @await instance.exports.lint(...)@.
parseShell :: Text -> Maybe Shell
parseShell s = case T.toLower s of
  "bash" -> Just Bash
  "sh" -> Just Sh
  "dash" -> Just Dash
  "ksh" -> Just Ksh
  "busybox" -> Just BusyboxSh
  _ -> Nothing

parseSeverity :: Text -> Maybe Severity
parseSeverity s = case T.toLower s of
  "error" -> Just ErrorC
  "warning" -> Just WarningC
  "info" -> Just InfoC
  "style" -> Just StyleC
  _ -> Nothing

toLintResult :: PositionedComment -> LintResult
toLintResult pc = LintResult
  { lrFile = T.pack . posFile $ pcStartPos pc
  , lrLine = fromIntegral . posLine $ pcStartPos pc
  , lrColumn = fromIntegral . posColumn $ pcStartPos pc
  , lrEndLine = Just . fromIntegral . posLine $ pcEndPos pc
  , lrEndColumn = Just . fromIntegral . posColumn $ pcEndPos pc
  , lrCode = fromIntegral . cCode $ pcComment pc
  , lrSeverity = severityText . cSeverity $ pcComment pc
  , lrMessage = T.pack . cMessage $ pcComment pc
  , lrFix = toFixInfo <$> pcFix pc
  }

severityText :: Severity -> Text
severityText ErrorC = "error"
severityText WarningC = "warning"
severityText InfoC = "info"
severityText StyleC = "style"

toFixInfo :: Fix -> FixInfo
toFixInfo fix = FixInfo
  { fiReplacements = map toReplacement (fixReplacements fix)
  }

toReplacement :: Replacement -> WT.Replacement
toReplacement r = WT.Replacement
  { WT.repStartLine = fromIntegral . posLine $ repStartPos r
  , WT.repStartColumn = fromIntegral . posColumn $ repStartPos r
  , WT.repEndLine = fromIntegral . posLine $ repEndPos r
  , WT.repEndColumn = fromIntegral . posColumn $ repEndPos r
  , WT.repText = T.pack $ repString r
  }
