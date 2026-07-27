import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync("lib/runtime-context.ts", "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

const module = { exports: {} };
const requests = [];

const makeStorage = (values) => ({
  getItem: (key) => values[key] ?? null,
  setItem: (key, value) => {
    values[key] = String(value);
  },
  removeItem: (key) => {
    delete values[key];
  },
});

const sandbox = {
  module,
  exports: module.exports,
  URL,
  URLSearchParams,
  Map,
  Date,
  process: {
    env: {
      NEXT_PUBLIC_API_URL: "http://localhost:8085/api/v1",
      NEXT_PUBLIC_ROOT_DOMAIN: "gulfingot.com",
    },
  },
  fetch: async (url, options = {}) => {
    requests.push({ url, options });
    const tenant = options.headers?.["X-Tenant"];
    const expiresAt = Math.floor(Date.now() / 1000) + 300;
    const context = tenant || "central";

    return {
      ok: true,
      status: 200,
      json: async () => ({
        url: `http://localhost:8085/api/v1/media/stream/7?tenant=${context}&uid=1&exp=${expiresAt}&sig=signed-${context}`,
        expires_at: expiresAt,
      }),
    };
  },
  window: undefined,
  localStorage: undefined,
};

vm.runInNewContext(transpiled, sandbox, { filename: "runtime-context.js" });
const runtime = module.exports;

const setWindow = (hostname, values) => {
  const localStorage = makeStorage(values);
  sandbox.window = {
    location: {
      hostname,
      protocol: "http:",
      origin: `http://${hostname}:3000`,
    },
    localStorage,
  };
  sandbox.localStorage = localStorage;
};

setWindow("localhost", {
  hive_context: "central",
  hive_token: "central-token",
});

const centralLegacyUrl = runtime.getStreamUrl(
  "http://localhost:8085/api/v1/files/7/serve",
);
const centralLegacyParams = new URL(centralLegacyUrl).searchParams;
assert.equal(centralLegacyParams.get("token"), "central-token");
assert.equal(centralLegacyParams.has("tenant"), false);

const centralSignedUrl = await runtime.getSignedMediaStreamUrl(
  "http://localhost:8085/api/v1/files/7/serve",
);
assert.equal(new URL(centralSignedUrl).searchParams.get("tenant"), "central");
assert.equal(new URL(requests[0].url).hostname, "localhost");
assert.equal(requests[0].options.headers.Authorization, "Bearer central-token");
assert.equal(requests[0].options.headers["X-Tenant"], undefined);
assert.equal(centralSignedUrl.includes("central-token"), false);

setWindow("acme.localhost", {
  hive_context_signature: "host-derived-signature",
  hive_token: "host-derived-token",
});
const hostDerivedUrl = runtime.getStreamUrl(
  "http://acme.localhost:8085/api/v1/files/8/serve",
);
assert.equal(new URL(hostDerivedUrl).searchParams.get("tenant"), "acme");

setWindow("techive.localhost", {
  hive_context: "techive",
  hive_context_signature: "tenant-context-signature",
  hive_token: "tenant-token",
});

const tenantLegacyUrl = runtime.getStreamUrl(
  "http://techive.localhost:8085/api/v1/files/7/serve",
);
const tenantLegacyParams = new URL(tenantLegacyUrl).searchParams;
assert.equal(tenantLegacyParams.get("tenant"), "techive");
assert.equal(tenantLegacyParams.get("signature"), "tenant-context-signature");

const tenantSignedUrl = await runtime.getSignedMediaStreamUrl(
  "http://techive.localhost:8085/api/v1/files/7/serve",
);
assert.equal(new URL(tenantSignedUrl).searchParams.get("tenant"), "techive");
assert.equal(new URL(requests[1].url).hostname, "techive.localhost");
assert.equal(requests[1].options.headers.Authorization, "Bearer tenant-token");
assert.equal(requests[1].options.headers["X-Tenant"], "techive");
assert.equal(
  requests[1].options.headers["X-Tenant-Signature"],
  "tenant-context-signature",
);
assert.equal(tenantSignedUrl.includes("tenant-token"), false);

const reusedTenantSignedUrl = await runtime.getSignedMediaStreamUrl(tenantSignedUrl);
assert.equal(reusedTenantSignedUrl, tenantSignedUrl);
assert.equal(requests.length, 2);

console.log("Media playback context checks passed for central and tenant workspaces.");
