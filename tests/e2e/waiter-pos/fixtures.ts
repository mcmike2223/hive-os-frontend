import { execFile } from "node:child_process";
import { chmod, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { test as base } from "@playwright/test";
import type { WaiterFixtureManifest } from "./support";

const execFileAsync = promisify(execFile);
const frontendRoot = process.cwd();
const workspaceRoot = path.resolve(frontendRoot, "..");
const fixtureDirectory = path.join(frontendRoot, ".playwright", "fixtures");
const fixturePrefix = "acceptance-waiter-";

const composeFile = (): string =>
  process.env.HIVE_E2E_COMPOSE_FILE ?? path.join(workspaceRoot, "hive-os-infra", "docker-compose.yml");

const compose = async (arguments_: string[]): Promise<void> => {
  await execFileAsync("docker", ["compose", "-f", composeFile(), ...arguments_], {
    cwd: workspaceRoot,
    env: process.env,
    maxBuffer: 8 * 1024 * 1024,
  });
};

// The tenant id is stored in varchar(50) columns such as
// hospitality_staff.tenant_id, so anything longer aborts provisioning partway
// through with a truncation error rather than being rejected up front.
const MAX_FIXTURE_ID_LENGTH = 50;

/**
 * Fixture ids must satisfy the backend guard /^acceptance-waiter-[a-z0-9-]{6,80}$/,
 * and they are what cleanup targets, so they have to be unique per test and
 * traceable back to the journey that created them.
 */
const fixtureIdFor = (title: string): string => {
  const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toLowerCase();
  const room = MAX_FIXTURE_ID_LENGTH - fixturePrefix.length - unique.length - 1;
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, Math.max(room, 0))
    .replace(/-+$/g, "");

  return `${fixturePrefix}${slug || "journey"}-${unique}`;
};

const provision = async (fixtureId: string): Promise<WaiterFixtureManifest> => {
  const manifestPath = path.join(fixtureDirectory, `${fixtureId}.json`);
  const containerManifest = `/tmp/hive-waiter-pos-acceptance/${fixtureId}.json`;

  await compose(["exec", "-T", "backend", "php", "artisan", "hospitality:waiter-pos-acceptance-fixture", `--fixture=${fixtureId}`]);
  await execFileAsync("docker", [
    "cp",
    `${process.env.HIVE_E2E_BACKEND_CONTAINER ?? "hive-backend"}:${containerManifest}`,
    manifestPath,
  ]);
  await chmod(manifestPath, 0o600);

  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as WaiterFixtureManifest;
  await warmTenantHost(manifest);

  return manifest;
};

/**
 * The tenant host was created seconds ago, so this is the first request the
 * frontend has ever served for it and a dev server compiles the route on
 * demand. Warming it here keeps that cost out of the first assertion.
 */
const warmTenantHost = async (manifest: WaiterFixtureManifest): Promise<void> => {
  const baseUrl = (process.env.HIVE_E2E_FRONTEND_URL ?? manifest.frontend_url).replace(/\/$/, "");
  const deadline = Date.now() + 90_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/sign-in`, {
        signal: AbortSignal.timeout(30_000),
      });
      if (response.ok) {
        return;
      }
    } catch {
      // Keep retrying: a cold dev-server compile can exceed a single timeout.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
};

const cleanup = async (fixtureId: string): Promise<void> => {
  // The local manifest holds fixture credentials at 0600, so remove it even if
  // the backend cleanup throws. Ordering it after the compose call meant a
  // failed teardown left credentials on disk, and manifests from earlier runs
  // were still present hours later.
  try {
    await compose([
      "exec",
      "-T",
      "backend",
      "php",
      "artisan",
      "hospitality:waiter-pos-acceptance-fixture",
      `--fixture=${fixtureId}`,
      "--cleanup",
    ]);
  } finally {
    await rm(path.join(fixtureDirectory, `${fixtureId}.json`), { force: true });
  }
};

type WaiterFixtures = {
  waiterFixture: WaiterFixtureManifest;
};

/**
 * Gives every journey its own generated tenant, so tests stop competing for the
 * same table. Sharing one fixture made the suite order-dependent: whichever
 * journey opened an order on the waiter's assigned table first left the others
 * unable to open one, because of the single-open-order policy.
 *
 * When HIVE_E2E_FIXTURE_MANIFEST is set the fixture is managed externally — CI
 * provisions and removes it in its own steps — so nothing is created or
 * destroyed here.
 */
export const test = base.extend<WaiterFixtures>({
  waiterFixture: async ({}, provide, testInfo) => {
    const externalManifest = process.env.HIVE_E2E_FIXTURE_MANIFEST;

    if (externalManifest) {
      const manifest = JSON.parse(await readFile(path.resolve(externalManifest), "utf8")) as WaiterFixtureManifest;
      await provide(manifest);

      return;
    }

    // Provisioning a whole tenant — database, migrations, seeders, fixture data
    // — is charged to the test timeout, and so is the cleanup that follows it.
    // Give the journey that budget back so the timeout still measures the
    // journey rather than the tenant build.
    testInfo.setTimeout(testInfo.timeout + 240_000);

    await mkdir(fixtureDirectory, { recursive: true, mode: 0o700 });
    await chmod(fixtureDirectory, 0o700);

    const fixtureId = fixtureIdFor(testInfo.title);
    let manifest: WaiterFixtureManifest;

    try {
      manifest = await provision(fixtureId);
    } catch (error) {
      // A partially provisioned tenant must not survive a failed setup.
      await cleanup(fixtureId).catch(() => undefined);
      throw error;
    }

    // The id is safe to surface; the manifest holds the credentials and is
    // never attached.
    testInfo.annotations.push({ type: "fixture", description: fixtureId });

    try {
      await provide(manifest);
    } finally {
      await cleanup(fixtureId);
    }
  },
});

export { expect } from "@playwright/test";
