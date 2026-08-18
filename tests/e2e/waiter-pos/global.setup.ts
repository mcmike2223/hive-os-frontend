import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const frontendRoot = process.cwd();
const fixtureDirectory = path.join(frontendRoot, ".playwright", "fixtures");
const runtimePath = path.join(fixtureDirectory, "waiter-pos-runtime.json");

/**
 * Fixtures are provisioned per test by tests/e2e/waiter-pos/fixtures.ts so that
 * journeys cannot compete for the same table. Nothing is provisioned here.
 *
 * The one job left is the externally-managed case: CI provisions a fixture in
 * its own step and points HIVE_E2E_FIXTURE_MANIFEST at the manifest. Recording
 * it keeps loadFixture() in support.ts working for anything still reading the
 * runtime pointer, and the manifest itself is left untouched because the run
 * that created it also removes it.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  const providedManifest = process.env.HIVE_E2E_FIXTURE_MANIFEST;

  if (!providedManifest) {
    return async () => undefined;
  }

  await mkdir(fixtureDirectory, { recursive: true, mode: 0o700 });
  await chmod(fixtureDirectory, 0o700);

  const runtime = {
    fixtureId: process.env.HIVE_E2E_FIXTURE_ID ?? "externally-managed-fixture",
    manifestPath: path.resolve(providedManifest),
  };

  // Fail fast when the manifest is unreadable rather than in every test.
  await readFile(runtime.manifestPath, "utf8");
  await writeFile(runtimePath, JSON.stringify(runtime), { mode: 0o600 });
  await chmod(runtimePath, 0o600);

  return async () => {
    await rm(runtimePath, { force: true });
  };
}
