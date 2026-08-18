import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const outputPath = path.resolve(
  process.env.WEBPACK_DIAGNOSTICS_PATH ?? ".playwright/webpack-build-diagnostics.json",
);
const startedAt = new Date().toISOString();
const started = Date.now();
const samples = [];
const stages = [];
let lastOutput = "";

const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build", "--", "--webpack"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

const capture = (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);
  lastOutput = `${lastOutput}${text}`.slice(-8_192);
  for (const line of text.split(/\r?\n/)) {
    if (/Creating an optimized|Compiled successfully|Running TypeScript|Collecting page data|Generating static pages|Finalizing page optimization|Collecting build traces/i.test(line)) {
      stages.push({ at: new Date().toISOString(), message: line.trim() });
    }
  }
};

child.stdout.on("data", capture);
child.stderr.on("data", capture);

const sample = async () => {
  if (process.platform !== "linux" || !child.pid) return;

  try {
    const status = await readFile(`/proc/${child.pid}/status`, "utf8");
    const values = Object.fromEntries(
      status
        .split("\n")
        .filter((line) => /^(VmRSS|VmSize|Threads):/.test(line))
        .map((line) => line.split(/:\s+/, 2)),
    );
    samples.push({ at: new Date().toISOString(), pid: child.pid, ...values });
  } catch {
    // The child may have exited between the timer tick and /proc read.
  }
};

const timer = setInterval(() => void sample(), 5_000);
void sample();

const result = await new Promise((resolve) => {
  child.once("exit", (code, signal) => resolve({ code, signal }));
  child.once("error", (error) => resolve({ code: null, signal: null, error: error.message }));
});

clearInterval(timer);
await mkdir(path.dirname(outputPath), { recursive: true, mode: 0o700 });
await writeFile(
  outputPath,
  JSON.stringify(
    {
      command: "npm run build -- --webpack",
      started_at: startedAt,
      ended_at: new Date().toISOString(),
      duration_ms: Date.now() - started,
      node: process.version,
      platform: process.platform,
      pid: child.pid ?? null,
      result,
      stages,
      samples,
      last_output: lastOutput,
    },
    null,
    2,
  ),
  { mode: 0o600 },
);

if (result.code !== 0) {
  process.exitCode = typeof result.code === "number" ? result.code : 1;
}
