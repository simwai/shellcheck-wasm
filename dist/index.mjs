let runtimeInstance = null;
async function createShellCheck(options) {
  if (runtimeInstance && !options?.forceNew) return runtimeInstance;
  const isNode = typeof process !== "undefined" && process.versions?.node;
  const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
  let runtime = options?.runtime || "auto";
  if (runtime === "auto") {
    runtime = isNode ? "node" : isBrowser ? "browser" : "node";
  }
  let instance;
  if (runtime === "node") {
    const { createShellCheck: createNodeShellCheck } = await import('./runtime/node.mjs');
    instance = await createNodeShellCheck({
      wasmPath: options?.wasmUrl,
      forceNew: options?.forceNew
    });
  } else if (runtime === "browser") {
    const { createShellCheck: createBrowserShellCheck } = await import('./runtime/browser.mjs');
    instance = await createBrowserShellCheck({
      wasmUrl: options?.wasmUrl,
      forceNew: options?.forceNew
    });
  } else {
    throw new Error(`Unknown runtime: ${runtime}`);
  }
  runtimeInstance = instance;
  return instance;
}
async function lint(script, options) {
  const shellcheck = await createShellCheck();
  return shellcheck.lint(script, options);
}
async function lintWithOptions(script, options) {
  const shellcheck = await createShellCheck();
  return shellcheck.lintWithOptions(script, options);
}
function resetShellCheck() {
  if (runtimeInstance) {
    runtimeInstance.terminate();
    runtimeInstance = null;
  }
}

export { createShellCheck, lint, lintWithOptions, resetShellCheck };
