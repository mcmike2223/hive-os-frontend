import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync("lib/runtime-context.ts", "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;

const module = { exports: {} };
const sandbox = {
  module,
  exports: module.exports,
  console,
  process: {
    env: {
      NEXT_PUBLIC_ROOT_DOMAIN: "gulfingot.com",
    },
  },
  URL,
  URLSearchParams,
};

vm.runInNewContext(transpiled, sandbox, { filename: "runtime-context.cjs" });

assert.equal(
  typeof module.exports.getWorkspaceScopeKey,
  "function",
  "runtime-context must export getWorkspaceScopeKey for settings query isolation",
);

const makeWindow = ({ hostname, context = null, signature = null }) => {
  const store = new Map();
  if (context) store.set("hive_context", context);
  if (signature) store.set("hive_context_signature", signature);

  return {
    location: {
      hostname,
      protocol: "https:",
      origin: `https://${hostname}`,
    },
    localStorage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, value),
      removeItem: (key) => store.delete(key),
    },
  };
};

const setWindow = (windowMock) => {
  sandbox.window = windowMock;
  sandbox.localStorage = windowMock.localStorage;
};

setWindow(makeWindow({ hostname: "hive.gulfingot.com", context: "central" }));
const centralScope = module.exports.getWorkspaceScopeKey();
assert.equal(centralScope, "central:hive.gulfingot.com");

setWindow(makeWindow({ hostname: "techive.gulfingot.com" }));
const tenantHostScope = module.exports.getWorkspaceScopeKey();
assert.equal(tenantHostScope, "tenant:techive@techive.gulfingot.com");

setWindow(makeWindow({ hostname: "hive.gulfingot.com", context: "techive" }));
const tenantContextScope = module.exports.getWorkspaceScopeKey();
assert.equal(tenantContextScope, "tenant:techive@hive.gulfingot.com");

assert.notEqual(centralScope, tenantHostScope);
assert.notEqual(centralScope, tenantContextScope);
assert.notEqual(tenantHostScope, tenantContextScope);

console.log("settings context isolation scope check passed");
