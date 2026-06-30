import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync("lib/document-title.ts", "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;

const module = { exports: {} };
vm.runInNewContext(transpiled, { module, exports: module.exports }, { filename: "document-title.cjs" });

const { formatDocumentTitle } = module.exports;

assert.equal(typeof formatDocumentTitle, "function", "formatDocumentTitle must be exported");

assert.equal(formatDocumentTitle("HIVE.OS", "Dashboard"), "HIVE.OS | Dashboard");
assert.equal(formatDocumentTitle("Dashboard", "HIVE.OS"), "Dashboard | HIVE.OS");
assert.equal(formatDocumentTitle("HIVE.OS | Dashboard", "Dashboard"), "HIVE.OS | Dashboard");
assert.equal(formatDocumentTitle("HIVE.OS | Dashboard | Dashboard", "Dashboard"), "HIVE.OS | Dashboard");
assert.equal(
  formatDocumentTitle("HIVE.OS | Enterprise Operations | Enterprise Operations", "Enterprise Operations"),
  "HIVE.OS | Enterprise Operations",
);
assert.equal(formatDocumentTitle("Techive Tenant | Techive Tenant"), "Techive Tenant");
assert.equal(formatDocumentTitle("", "Dashboard"), "HIVE.OS | Dashboard");

const dashboardLayout = fs.readFileSync("app/dashboard/layout.tsx", "utf8");
assert.match(dashboardLayout, /title:\s*"Dashboard"/, "dashboard metadata page title must stay unsuffixed");
assert.doesNotMatch(
  dashboardLayout,
  /title:\s*"Dashboard\s*\|/,
  "dashboard metadata must not include the brand or root layout will append another site title",
);

const rootLayout = fs.readFileSync("app/layout.tsx", "utf8");
assert.match(
  rootLayout,
  /fetchPublicBrandSettings/,
  "root metadata must derive site title from the current workspace branding settings",
);

console.log("document title normalization check passed");
