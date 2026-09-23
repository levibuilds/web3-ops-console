import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test("production snapshot serves saved records and blocks mutations", async (t) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "ops-snapshot-test-"));
  const port = await freePort();
  const child = spawn(process.execPath, ["src/server.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port), SNAPSHOT_MODE: "1", DEMO_MODE: "0", DATA_DIR: dataDir },
    stdio: "ignore"
  });
  t.after(async () => { child.kill(); await rm(dataDir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${port}`;
  let response;
  for (let i = 0; i < 60; i += 1) {
    try { response = await fetch(`${base}/api/state`); break; } catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
  }
  assert.equal(response?.status, 200);
  const state = await response.json();
  assert.equal(state.dataMode, "snapshot");
  assert.ok(state.snapshotAt);
  assert.ok(state.exchangeAnnouncements.length > 0);
  assert.ok(state.exchangeAnnouncements.every((item) => item.url.startsWith("https://") && item.publishedAt && item.fetchedAt));
  assert.ok(state.exchangeAnnouncements.every((item) => ["binance", "okx", "bybit", "bitget"].includes(item.exchangeId) && item.title === item.originalTitle));
  const search = await (await fetch(`${base}/api/search?q=Binance`)).json();
  assert.ok(search.groups.announcements.length > 0);
  const campaigns = await (await fetch(`${base}/api/campaigns`)).json();
  assert.equal(campaigns.campaigns.length, state.campaigns.length);
  const health = await (await fetch(`${base}/api/health`)).json();
  assert.equal(health.snapshotAt, state.snapshotAt);
  const report = await (await fetch(`${base}/api/daily-report`)).json();
  assert.match(report.report, /规则汇总，未调用模型/);
  assert.equal((await fetch(`${base}/api/sync`, { method: "POST" })).status, 403);
  assert.equal((await fetch(`${base}/api/daily-report?push=1`)).status, 403);
  assert.deepEqual(await readdir(dataDir), []);
});
