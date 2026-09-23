import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
}

async function waitFor(url, timeoutMs = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // retry while the child server boots
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`timeout waiting for ${url}`);
}

test("critical alerts push Feishu interactive card and WeCom markdown payloads", async (t) => {
  const received = [];
  const mock = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    received.push({ url: req.url, body: JSON.parse(body || "{}") });
    res.writeHead(200, { "content-type": "application/json" });
    res.end("{}");
  });
  const mockPort = await listen(mock);
  t.after(() => mock.close());

  const probe = http.createServer();
  const port = await listen(probe);
  await new Promise((resolve) => probe.close(resolve));
  const child = spawn(process.execPath, ["src/server.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      FEISHU_WEBHOOK_URL: `http://127.0.0.1:${mockPort}/feishu`,
      WECOM_WEBHOOK_URL: `http://127.0.0.1:${mockPort}/wecom`
    },
    stdio: "ignore"
  });
  t.after(() => child.kill());
  await waitFor(`http://127.0.0.1:${port}/api/health`);

  const response = await fetch(`http://127.0.0.1:${port}/api/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      source: "push_test",
      type: "news",
      asset: "BTC",
      title: `SEC lawsuit and fine against crypto exchange ${Date.now()}`,
      body: "The SEC lawsuit includes a potential ban and penalty.",
      url: "https://example.com/sec-lawsuit",
      fingerprint: `push-test:${Date.now()}`
    })
  });
  assert.equal(response.status, 201);

  const started = Date.now();
  while (received.length < 2 && Date.now() - started < 5000) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const feishu = received.find((item) => item.url === "/feishu")?.body;
  const wecom = received.find((item) => item.url === "/wecom")?.body;
  assert.equal(feishu?.msg_type, "interactive");
  assert.equal(feishu?.card?.header?.template, "red");
  assert.equal(wecom?.msgtype, "markdown");
  assert.match(wecom?.markdown?.content || "", /严重告警/);
});
