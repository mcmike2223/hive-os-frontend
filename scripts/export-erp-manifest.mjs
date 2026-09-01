/**
 * Exports the live frontend module registry (navigation, permissions, route
 * prefixes) plus the real App Router page tree into a JSON manifest consumed by
 * the backend Copilot knowledge indexer.
 *
 * The backend cannot read the frontend source (separate container), so this is
 * the hand-off point. Re-run it whenever navigation or permissions change:
 *   npm run export:erp-manifest
 *
 * Follows the transpile+vm approach already used by verify-route-permissions.mjs
 * so no extra runtime dependency is needed.
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import vm from "node:vm";
import ts from "typescript";

const FRONTEND_ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const MODULES_DIR = path.join(FRONTEND_ROOT, "modules");
const DASHBOARD_DIR = path.join(FRONTEND_ROOT, "app", "dashboard");
const OUT_PATH = path.resolve(
  FRONTEND_ROOT,
  "..",
  "hive-os-backend",
  "Modules",
  "SupportBot",
  "resources",
  "erp-manifest",
  "frontend-navigation.json",
);

/** Icons and type-only imports are irrelevant to the manifest; stub them out. */
const iconStub = new Proxy({}, { get: (_target, prop) => String(prop) });

/**
 * Local modules already evaluated, so a shared file is read once.
 * @type {Map<string, object>}
 */
const localModuleCache = new Map();

/**
 * Evaluates a local TypeScript module so its exported values are real.
 *
 * This matters more than it looks. Navigation permissions are declared as
 * shared constants — `permissions: [...STORAGE_ROUTE_PERMISSIONS]` — and the
 * icon stub answered every import with the identifier's own name. Spreading
 * that string produced `["S","T","O","R","A","G","E", …]`, so Storage, Settings
 * and API Docs shipped into the manifest guarded by permissions that cannot
 * exist, and the assistant told everyone those pages were closed to them.
 */
function loadLocalModule(specifier) {
  const relative = specifier.replace(/^@\//, "");
  const candidates = [
    path.join(FRONTEND_ROOT, `${relative}.ts`),
    path.join(FRONTEND_ROOT, `${relative}.tsx`),
    path.join(FRONTEND_ROOT, relative, "index.ts"),
  ];

  const resolved = candidates.find((candidate) => fs.existsSync(candidate));

  if (!resolved) return null;

  if (localModuleCache.has(resolved)) return localModuleCache.get(resolved);

  // Guard against import cycles: seed the cache before evaluating.
  localModuleCache.set(resolved, {});

  const exported = evaluateModule(resolved);
  localModuleCache.set(resolved, exported);

  return exported;
}

function moduleRequire(specifier) {
  // Anything inside the app is real data the manifest may depend on.
  if (specifier.startsWith("@/") || specifier.startsWith("./") || specifier.startsWith("../")) {
    return loadLocalModule(specifier) ?? iconStub;
  }

  // Third-party (icons, react) contributes nothing to the manifest.
  return iconStub;
}

function evaluateModule(filePath) {
  const source = fs
    .readFileSync(filePath, "utf8")
    // Type-only import; transpile erases the binding but keeps the require.
    .replace(/import\s+type\s+\{[^}]*\}\s+from\s+"[^"]+";?/g, "");

  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });

  const sandbox = {
    exports: {},
    module: { exports: {} },
    require: moduleRequire,
    // Referenced by runtime-context style helpers at module scope.
    process: { env: {} },
    console,
  };

  vm.runInNewContext(compiled.outputText, sandbox, { filename: filePath });

  return sandbox.exports;
}

function loadModuleDefinition(filePath) {
  const exported = evaluateModule(filePath);

  return (
    Object.values(exported).find(
      (value) => value && typeof value === "object" && Array.isArray(value.navItems),
    ) ?? null
  );
}

/** Walks the App Router tree and returns every real dashboard URL. */
function collectPages(dir, prefix = "/dashboard") {
  const pages = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      if (entry.name === "page.tsx") {
        pages.push({ route: prefix, file: path.relative(FRONTEND_ROOT, path.join(dir, entry.name)) });
      }
      continue;
    }
    if (entry.name.startsWith("_")) continue;
    // Route groups "(group)" do not contribute a URL segment.
    const isGroup = entry.name.startsWith("(") && entry.name.endsWith(")");
    const segment = isGroup ? "" : "/" + entry.name;
    pages.push(...collectPages(path.join(dir, entry.name), prefix + segment));
  }
  return pages;
}

const moduleFiles = fs
  .readdirSync(MODULES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(MODULES_DIR, entry.name, "module.ts"))
  .filter((file) => fs.existsSync(file));

const modules = [];
const failures = [];

for (const file of moduleFiles) {
  try {
    const definition = loadModuleDefinition(file);
    if (!definition) {
      failures.push({ file: path.relative(FRONTEND_ROOT, file), reason: "no module definition export" });
      continue;
    }
    modules.push({
      id: definition.id,
      name: definition.name,
      description: definition.description ?? "",
      backendModule: definition.backendModule ?? null,
      routePrefixes: definition.routePrefixes ?? [],
      navItems: (definition.navItems ?? []).map((item) => ({
        moduleId: item.moduleId,
        label: item.fallbackLabel,
        translationKey: item.translationKey,
        href: item.href,
        permissions: item.permissions ?? [],
        subscriptionSlug: item.subscriptionSlug ?? null,
        businessTypes: item.businessTypes ?? null,
        placement: item.placement ?? "primary",
        audience: item.audience ?? "all",
      })),
    });
  } catch (error) {
    failures.push({ file: path.relative(FRONTEND_ROOT, file), reason: error.message });
  }
}

const pages = fs.existsSync(DASHBOARD_DIR) ? collectPages(DASHBOARD_DIR) : [];

const manifest = {
  generated_at: new Date().toISOString(),
  source: "hive-os-frontend/modules/*/module.ts + app/dashboard",
  module_count: modules.length,
  nav_item_count: modules.reduce((total, module) => total + module.navItems.length, 0),
  page_count: pages.length,
  modules: modules.sort((a, b) => a.id.localeCompare(b.id)),
  pages: pages.sort((a, b) => a.route.localeCompare(b.route)),
  failures,
};

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf8");

console.log(
  "Exported " +
    manifest.module_count +
    " modules / " +
    manifest.nav_item_count +
    " nav items / " +
    manifest.page_count +
    " pages -> " +
    path.relative(FRONTEND_ROOT, OUT_PATH),
);

if (failures.length) {
  console.warn(failures.length + " module file(s) could not be parsed:");
  for (const failure of failures) console.warn("  - " + failure.file + ": " + failure.reason);
  process.exitCode = 1;
}
