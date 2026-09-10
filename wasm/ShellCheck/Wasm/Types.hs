{-# LANGUAGE DeriveGeneric #-}
{-# LANGUAGE OverloadedStrings #-}

-- | JSON-serializable types shared with the TypeScript API.
--
-- Field names are mapped to the camelCase names in @src/types.ts@
-- (e.g. @optShell@ <-> @shell@, @lrCode@ <-> @code@).
module ShellCheck.Wasm.Types
  ( LintOptions (..)
  , LintResult (..)
  , FixInfo (..)
  , Replacement (..)
  , defaultLintOptions
  ) where

import Data.Aeson (FromJSON (..), ToJSON (..), Options (omitNothingFields), defaultOptions, fieldLabelModifier, genericParseJSON, genericToJSON)
import Data.Char (toLower)
import Data.Map.Strict (Map)
import Data.Text (Text)
import GHC.Generics (Generic)

-- | Drop a known prefix and lowercase the first remaining character,
-- e.g. @stripPrefixLower "opt" "optShell" == "shell"@.
stripPrefixLower :: String -> String -> String
stripPrefixLower prefix field =
  case drop (length prefix) field of
    [] -> field
    (c : cs) -> toLower c : cs

-- | Options passed from JavaScript to the linter.
-- Decoded from the JSON object built by @src/types.ts LintOptions@.
-- Note: @files@ is an object (path -> content), not a list of pairs.
data LintOptions = LintOptions
  { optShell :: Maybe Text
  , optSeverity :: Maybe Text
  , optExclude :: Maybe [Integer]
  , optInclude :: Maybe [Integer]
  , optFiles :: Maybe (Map Text Text)
  } deriving (Show, Eq, Generic)

instance FromJSON LintOptions where
  parseJSON = genericParseJSON defaultOptions
    { fieldLabelModifier = stripPrefixLower "opt" }

instance ToJSON LintOptions where
  toJSON = genericToJSON defaultOptions
    { fieldLabelModifier = stripPrefixLower "opt" }

defaultLintOptions :: LintOptions
defaultLintOptions = LintOptions
  { optShell = Nothing
  , optSeverity = Nothing
  , optExclude = Nothing
  , optInclude = Nothing
  , optFiles = Nothing
  }

-- | A single lint result, matching @LintResult@ in @src/types.ts@.
data LintResult = LintResult
  { lrFile :: Text
  , lrLine :: Int
  , lrColumn :: Int
  , lrEndLine :: Maybe Int
  , lrEndColumn :: Maybe Int
  , lrCode :: Int
  , lrSeverity :: Text
  , lrMessage :: Text
  , lrFix :: Maybe FixInfo
  } deriving (Show, Eq, Generic)

instance ToJSON LintResult where
  toJSON = genericToJSON defaultOptions
    { fieldLabelModifier = stripPrefixLower "lr"
    , omitNothingFields = True
    }

instance FromJSON LintResult where
  parseJSON = genericParseJSON defaultOptions
    { fieldLabelModifier = stripPrefixLower "lr" }

-- | Fix information with replacements.
data FixInfo = FixInfo
  { fiReplacements :: [Replacement]
  } deriving (Show, Eq, Generic)

instance ToJSON FixInfo where
  toJSON = genericToJSON defaultOptions
    { fieldLabelModifier = stripPrefixLower "fi" }

instance FromJSON FixInfo where
  parseJSON = genericParseJSON defaultOptions
    { fieldLabelModifier = stripPrefixLower "fi" }

-- | A single text replacement.
data Replacement = Replacement
  { repStartLine :: Int
  , repStartColumn :: Int
  , repEndLine :: Int
  , repEndColumn :: Int
  , repText :: Text
  } deriving (Show, Eq, Generic)

instance ToJSON Replacement where
  toJSON = genericToJSON defaultOptions
    { fieldLabelModifier = stripPrefixLower "rep" }

instance FromJSON Replacement where
  parseJSON = genericParseJSON defaultOptions
    { fieldLabelModifier = stripPrefixLower "rep" }
