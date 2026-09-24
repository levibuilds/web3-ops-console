import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dataDir = await mkdtemp(path.join(os.tmpdir(), "ops-refresh-"));
const probe = createServer();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const endpoint = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["src/server.mjs"], {
  cwd: root,
  env: {
    ...process.env, PORT: String(port), HOST: "127.0.0.1", DATA_DIR: dataDir,
    TRUSTED_SOURCES_ONLY: "1", DEMO_MODE: "0", SNAPSHOT_MODE: "0",
    OPENAI_API_KEY: "", TELEGRAM_BOT_TOKEN: "", DISCORD_WEBHOOK_URL: "",
    FEISHU_WEBHOOK_URL: "", WECOM_WEBHOOK_URL: "", ALCHEMY_SIGNING_KEY: "",
    MORALIS_STREAM_SECRET: ""
  },
  stdio: "ignore"
});

try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) throw new Error("Collector exited before startup");
    try { ready = (await fetch(`${endpoint}/api/health`)).ok; } catch { /* still starting */ }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 125));
  }
  if (!ready) throw new Error("Collector did not start");
  const sync = await fetch(`${endpoint}/api/sync-exchanges`, { method: "POST", signal: AbortSignal.timeout(120_000) });
  if (!sync.ok) throw new Error(`Exchange collection failed: ${sync.status}`);
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/export-production-snapshot.mjs", endpoint], { cwd: root, stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(true) : reject(new Error("Snapshot validation failed; previous snapshot preserved")));
  });
  if (!result) throw new Error("Snapshot export failed");
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/update-snapshot-copy.mjs"], { cwd: root, stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error("Snapshot copy update failed")));
  });
} finally {
  server.kill();
  await rm(dataDir, { recursive: true, force: true });
}
