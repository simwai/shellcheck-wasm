{-# LANGUAGE OverloadedStrings #-}

-- | In-memory 'SystemInterface' for WASM.
--
-- There is no filesystem access inside the wasm module: every file the
-- checker may read (sourced scripts) is supplied up front by the caller
-- via 'newMemorySystemInterface'. Unknown files resolve to a 'Left'
-- error, exactly like a missing file on disk.
module ShellCheck.Wasm.SystemInterface
  ( newMemorySystemInterface
  ) where

import qualified Data.Map.Strict as Map
import System.FilePath (takeDirectory, (</>))
import ShellCheck.Interface (SystemInterface (..))

-- | Build a 'SystemInterface' backed by a pure in-memory file map.
-- Keys are file paths, values are file contents.
newMemorySystemInterface :: Map.Map FilePath String -> SystemInterface IO
newMemorySystemInterface files = SystemInterface
  { siReadFile = readFileMem
  , siFindSource = findSourceMem
  , siGetConfig = \_ -> pure Nothing
  }
 where
  readFileMem :: Maybe Bool -> FilePath -> IO (Either String String)
  readFileMem _ path =
    pure $ case Map.lookup path files of
      Just content -> Right content
      Nothing -> Left $ "File not found: " ++ path

  -- | Resolve a sourced file against the virtual filesystem: first try
  -- each search directory, return the first hit; otherwise fall back to
  -- the script's own directory (which will then 404 on read, like disk).
  findSourceMem :: String -> Maybe Bool -> [String] -> String -> IO FilePath
  findSourceMem currentScript _ sourcePaths sourcedFile =
    pure $ case filter (`Map.member` files) candidates of
      (hit : _) -> hit
      [] -> head candidates
   where
    candidates = [dir </> sourcedFile | dir <- takeDirectory currentScript : sourcePaths]
