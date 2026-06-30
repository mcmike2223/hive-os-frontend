import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const sourcePath = path.resolve("lib/route-permissions.ts");
const source = fs
  .readFileSync(sourcePath, "utf8")
  .replace('import { isTenantSession } from "@/lib/runtime-context";', "const isTenantSession = () => true;");

const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
});

const sandbox = {
  exports: {},
  module: { exports: {} },
};

vm.runInNewContext(compiled.outputText, sandbox, { filename: sourcePath });

const { canAccessDashboardRoute } = sandbox.exports;

const centralOverrideAccess = {
  canBypassModuleSubscriptions: true,
  hasPermission: (permission) => permission === "manage_workflow_automation",
  hasAnyPermission: (permissions) => permissions.includes("manage_workflow_automation"),
  hasModule: () => false,
};

const tenantWithoutModuleAccess = {
  canBypassModuleSubscriptions: false,
  hasPermission: (permission) => permission === "manage_workflow_automation",
  hasAnyPermission: (permissions) => permissions.includes("manage_workflow_automation"),
  hasModule: () => false,
};

const b2bTenantWithoutModuleAccess = {
  canBypassModuleSubscriptions: false,
  hasPermission: (permission) => permission === "view_b2b_marketplace",
  hasAnyPermission: (permissions) => permissions.includes("view_b2b_marketplace"),
  hasModule: () => false,
};

const b2bTenantWithModuleAccess = {
  canBypassModuleSubscriptions: false,
  hasPermission: (permission) => permission === "view_b2b_marketplace",
  hasAnyPermission: (permissions) => permissions.includes("view_b2b_marketplace"),
  hasModule: (slug) => slug === "b2b_marketplace",
};

if (!canAccessDashboardRoute("/dashboard/workflow/rules", centralOverrideAccess)) {
  throw new Error("Central override users must not be blocked by workflow subscription checks.");
}

if (canAccessDashboardRoute("/dashboard/workflow/rules", tenantWithoutModuleAccess)) {
  throw new Error("Tenant users without workflow_automation must still be blocked.");
}

if (canAccessDashboardRoute("/dashboard/b2b-marketplace", b2bTenantWithoutModuleAccess)) {
  throw new Error("Tenant users without b2b_marketplace must be blocked from the B2B marketplace.");
}

if (!canAccessDashboardRoute("/dashboard/b2b-marketplace", b2bTenantWithModuleAccess)) {
  throw new Error("Tenant users with b2b_marketplace must be allowed into the B2B marketplace.");
}

console.log("route-permissions central override checks passed");
