import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
async function start(env) {
  const port = await freePort();
  const child = spawn(process.execPath, ['src/server.mjs'], { cwd: root, env: { ...process.env, ...env, PORT: String(port), HOST: '127.0.0.1' }, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`server exited: ${child.exitCode}`);
    try { if ((await fetch(`${base}/api/health`)).ok) return { child, base }; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  child.kill();
  throw new Error('server did not start');
}
async function stop(child) {
  child.kill('SIGTERM');
  await new Promise((resolve) => child.once('exit', resolve));
}

test('explicit demo mode isolates persistence and blocks external work on production routes', async () => {
  const unsafe = spawnSync(process.execPath, ['src/server.mjs'], { cwd: root, env: { ...process.env, DEMO_MODE: '1', DATA_DIR: path.join(root, 'data') }, encoding: 'utf8' });
  assert.notEqual(unsafe.status, 0);
  assert.match(unsafe.stderr, /separate directory/);
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ops-demo-'));
  const marker = path.join(dir, 'network-attempts');
  const env = { DEMO_MODE: '1', DATA_DIR: path.join(dir, 'demo'), FETCH_MARKER: marker, NODE_OPTIONS: `--require=${path.join(root, 'scripts', 'no-network.cjs')}`, OPENAI_API_KEY: 'test-only', TELEGRAM_BOT_TOKEN: 'test-only', TELEGRAM_CHAT_ID: 'test-only' };
  let running;
  try {
    running = await start(env);
    const state = await (await fetch(`${running.base}/api/state`)).json();
    assert.equal(state.dataMode, 'demo');
    assert.equal(state.exchangeAnnouncements.length, 0);
    assert.equal((await fetch(`${running.base}/api/sync`, { method: 'POST' })).status, 403);
    assert.equal((await fetch(`${running.base}/api/simulate`, { method: 'POST' })).status, 201);
    const report = await (await fetch(`${running.base}/api/daily-report?push=1`)).json();
    assert.equal(report.usedAi, false);
    const populated = await (await fetch(`${running.base}/api/state`)).json();
    assert.ok(populated.exchangeAnnouncements.length > 0);
    assert.ok(populated.exchangeAnnouncements.every((item) => !item.url));
    assert.ok(populated.unlockEvents.filter((item) => item.isDemo).every((item) => !item.url));
    await stop(running.child);
    running = await start(env);
    assert.ok((await (await fetch(`${running.base}/api/state`)).json()).exchangeAnnouncements.length > 0);
    await assert.rejects(readFile(marker), { code: 'ENOENT' });
  } finally {
    if (running?.child.exitCode === null && running.child.signalCode === null) await stop(running.child);
    await rm(dir, { recursive: true, force: true });
  }
});
