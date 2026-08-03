import { execFile } from "node:child_process";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const frontendRoot = process.cwd();
const workspaceRoot = path.resolve(frontendRoot, "..");
const fixtureDirectory = path.join(frontendRoot, ".playwright", "fixtures");
const runtimePath = path.join(fixtureDirectory, "waiter-pos-runtime.json");
const fixturePrefix = "acceptance-waiter-e2e-";

type RuntimeFixture = {
  fixtureId: string;
  manifestPath: string;
};

const composeFile = () =>
  process.env.HIVE_E2E_COMPOSE_FILE ?? path.join(workspaceRoot, "hive-os-infra", "docker-compose.yml");

const compose = async (arguments_: string[]) => {
  await execFileAsync("docker", ["compose", "-f", composeFile(), ...arguments_], {
    cwd: workspaceRoot,
    env: process.env,
    maxBuffer: 1024 * 1024,
  });
};

const fixtureId = () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`.toLowerCase();

  return `${fixturePrefix}${suffix}`;
};

async function cleanupFixture(runtime: RuntimeFixture): Promise<void> {
  await compose([
    "exec",
    "-T",
    "backend",
    "php",
    "artisan",
    "hospitality:waiter-pos-acceptance-fixture",
    `--fixture=${runtime.fixtureId}`,
    "--cleanup",
  ]);
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  const providedManifest = process.env.HIVE_E2E_FIXTURE_MANIFEST;
  await mkdir(fixtureDirectory, { recursive: true, mode: 0o700 });
  await chmod(fixtureDirectory, 0o700);

  if (providedManifest) {
    const runtime: RuntimeFixture = {
      fixtureId: process.env.HIVE_E2E_FIXTURE_ID ?? "externally-managed-fixture",
      manifestPath: path.resolve(providedManifest),
    };
    await readFile(runtime.manifestPath, "utf8");
    await writeFile(runtimePath, JSON.stringify(runtime), { mode: 0o600 });
    await chmod(runtimePath, 0o600);

    return async () => {
      await rm(runtimePath, { force: true });
    };
  }

  const runtime: RuntimeFixture = {
    fixtureId: fixtureId(),
    manifestPath: path.join(fixtureDirectory, "waiter-pos-manifest.json"),
  };
  const containerManifest = `/tmp/hive-waiter-pos-acceptance/${runtime.fixtureId}.json`;

  try {
    await compose([
      "exec",
      "-T",
      "backend",
      "php",
      "artisan",
      "hospitality:waiter-pos-acceptance-fixture",
      `--fixture=${runtime.fixtureId}`,
    ]);
    await execFileAsync("docker", [
      "cp",
      `${process.env.HIVE_E2E_BACKEND_CONTAINER ?? "hive-backend"}:${containerManifest}`,
      runtime.manifestPath,
    ]);
    await chmod(runtime.manifestPath, 0o600);
    await writeFile(runtimePath, JSON.stringify(runtime), { mode: 0o600 });
    await chmod(runtimePath, 0o600);
  } catch (error) {
    await cleanupFixture(runtime).catch(() => undefined);
    await rm(runtime.manifestPath, { force: true });
    await rm(runtimePath, { force: true });
    throw error;
  }

  return async () => {
    try {
      await cleanupFixture(runtime);
    } finally {
      await rm(runtime.manifestPath, { force: true });
      await rm(runtimePath, { force: true });
    }
  };
}
