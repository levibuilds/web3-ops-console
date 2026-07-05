import test from "node:test";
import assert from "node:assert/strict";
import { eventFingerprint, normalizeEvent, scoreEvent, journalStats } from "../src/core.mjs";

test("eventFingerprint prefers explicit fingerprint", () => {
  assert.equal(eventFingerprint({ fingerprint: "abc" }), "abc");
});

test("eventFingerprint uses tx hash", () => {
  assert.equal(eventFingerprint({ txHash: "0xABC" }), "tx:0xabc");
});

test("eventFingerprint uses url", () => {
  assert.equal(eventFingerprint({ url: "https://x.test/A" }), "url:https://x.test/a");
});

test("eventFingerprint uses source and title", () => {
  assert.equal(eventFingerprint({ source: "news", title: "ETH ETF" }), "title:news:eth etf");
});

test("normalizeEvent infers large transfer and amountUsd", () => {
  const event = normalizeEvent({ payload: { from: "0x1", to: "0x2", asset: "ETH", amount: 2 } }, { market: { ETH: { price: 2000 } } });
  assert.equal(event.type, "large_transfer");
  assert.equal(event.amountUsd, 4000);
});

test("normalizeEvent detects protocol and keywords", () => {
  const event = normalizeEvent(
    { payload: { title: "Uniswap exploit rumor", asset: "UNI" } },
    { watchlist: { protocols: ["Uniswap"], keywords: ["exploit"] } }
  );
  assert.equal(event.protocol, "Uniswap");
  assert.deepEqual(event.keywordHits, ["exploit"]);
});

test("normalizeEvent computes anomaly multiple", () => {
  const event = normalizeEvent({ payload: { asset: "BTC", amountUsd: 3_000_000, baselineUsd: 1_000_000 } });
  assert.equal(event.metrics.anomalyMultiple, 3);
});

test("scoreEvent alerts on large exchange transfer", () => {
  const event = normalizeEvent({ payload: { type: "large_transfer", asset: "ETH", amountUsd: 10_000_000, to: "0xexchange", baselineUsd: 1_000_000 }, source: "alchemy" });
  const result = scoreEvent(event, ["0xexchange"]);
  assert.equal(result.shouldAlert, true);
  assert.match(result.severity, /high|critical/);
});

test("scoreEvent remains low for tiny manual event", () => {
  const event = normalizeEvent({ payload: { type: "news", asset: "ETH", amountUsd: 1, title: "minor" }, source: "manual" });
  assert.equal(scoreEvent(event).shouldAlert, false);
});

test("scoreEvent boosts protocol TVL move", () => {
  const event = normalizeEvent({ payload: { type: "protocol_tvl_change", asset: "AAVE", amountUsd: 1_000_000, tvlChangePct: -12 }, source: "defillama" });
  assert.equal(scoreEvent(event).shouldAlert, true);
});

test("journalStats computes total and hit rate", () => {
  const stats = journalStats([
    { asset: "ETH", signalType: "large_transfer", direction: "bearish", return24h: -2, outcome24h: "hit" },
    { asset: "ETH", signalType: "news", direction: "bullish", return24h: -1, outcome24h: "miss" }
  ]);
  assert.equal(stats.total, 2);
  assert.equal(stats.hitRate, 0.5);
});

test("journalStats groups by signal type and asset", () => {
  const stats = journalStats([
    { asset: "ETH", signalType: "large_transfer", direction: "bearish", return24h: -2, outcome24h: "hit" },
    { asset: "BTC", signalType: "large_transfer", direction: "bullish", return24h: 3, outcome24h: "hit" }
  ]);
  assert.equal(stats.bySignalType.find((row) => row.name === "large_transfer").total, 2);
  assert.equal(stats.byAsset.length, 2);
});
