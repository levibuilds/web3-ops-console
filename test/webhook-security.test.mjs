import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";

async function startServer(t, secrets = {}) {
  const probe = net.createServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "ops-webhook-"));
  const child = spawn(process.execPath, ["src/server.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", DATA_DIR: dataDir, DEMO_MODE: "0", SNAPSHOT_MODE: "0", ALCHEMY_SIGNING_KEY: "", MORALIS_STREAM_SECRET: "", ...secrets },
    stdio: "ignore"
  });
  t.after(async () => { child.kill(); await rm(dataDir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 80; i += 1) {
    try { if ((await fetch(`${base}/api/health`)).ok) return base; } catch { /* startup */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Webhook test server did not start");
}

test("webhooks reject requests without configured secrets", async (t) => {
  const base = await startServer(t);
  for (const provider of ["alchemy", "moralis"]) {
    const response = await fetch(`${base}/api/webhooks/${provider}`, { method: "POST", body: "{}" });
    assert.equal(response.status, 401, provider);
  }
});

test("webhooks accept valid secrets and reject invalid ones", async (t) => {
  const base = await startServer(t, { ALCHEMY_SIGNING_KEY: "test-alchemy-key", MORALIS_STREAM_SECRET: "test-moralis-key" });
  const body = "{}";
  const signature = createHmac("sha256", "test-alchemy-key").update(body).digest("hex");
  for (const [provider, validHeaders, invalidHeaders] of [
    ["alchemy", { "x-alchemy-signature": signature }, { "x-alchemy-signature": "wrong" }],
    ["moralis", { authorization: "Bearer test-moralis-key" }, { authorization: "Bearer wrong" }]
  ]) {
    assert.equal((await fetch(`${base}/api/webhooks/${provider}`, { method: "POST", headers: invalidHeaders, body })).status, 401, provider);
    assert.equal((await fetch(`${base}/api/webhooks/${provider}`, { method: "POST", headers: validHeaders, body })).status, 201, provider);
  }
});
