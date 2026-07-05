export function eventFingerprint(rawEvent = {}) {
  if (rawEvent.fingerprint) return rawEvent.fingerprint;
  if (rawEvent.txHash) return `tx:${rawEvent.txHash}`.toLowerCase();
  if (rawEvent.url) return `url:${rawEvent.url}`.toLowerCase();
  if (rawEvent.source && rawEvent.title) return `title:${rawEvent.source}:${rawEvent.title}`.toLowerCase();
  return "";
}

export function normalizeEvent(raw, context = {}) {
  const market = context.market || {};
  const watchlist = context.watchlist || { protocols: [], keywords: [] };
  const payload = raw.payload || raw;
  const type = payload.type || inferType(payload);
  const asset = String(payload.asset || payload.symbol || "ETH").toUpperCase();
  const price = market[asset]?.price || Number(payload.priceUsd || 1);
  const amount = Number(payload.amount || payload.quantity || 0);
  const amountUsd = Number(payload.amountUsd || amount * price || 0);
  const text = `${payload.title || ""} ${payload.body || ""} ${payload.text || ""}`;
  return {
    id: payload.id || "evt_test",
    fingerprint: eventFingerprint(payload),
    type,
    source: raw.source || payload.source || "manual",
    chain: payload.chain || "ethereum",
    asset,
    amount,
    amountUsd,
    title: payload.title || `${asset} event`,
    body: payload.body || payload.text || "",
    from: payload.from || payload.fromAddress || null,
    to: payload.to || payload.toAddress || null,
    protocol: payload.protocol || watchlist.protocols.find((item) => text.toLowerCase().includes(item.toLowerCase())) || "",
    keywordHits: (watchlist.keywords || []).filter((keyword) => text.toLowerCase().includes(keyword.toLowerCase())),
    observedAt: payload.observedAt || raw.receivedAt || new Date().toISOString(),
    metrics: {
      amountUsd,
      baselineUsd: Number(payload.baselineUsd || 1_000_000),
      anomalyMultiple: Number(payload.baselineUsd || 1_000_000) ? amountUsd / Number(payload.baselineUsd || 1_000_000) : 0,
      socialVelocity: Number(payload.socialVelocity || 0),
      tvlChangePct: Number(payload.tvlChangePct || 0),
      reliability: sourceReliability(raw.source || payload.source || "manual")
    }
  };
}

export function scoreEvent(event, exchangeAddresses = []) {
  const exchangeSet = new Set(exchangeAddresses.map((address) => String(address).toLowerCase()));
  const financialImpact = clamp(Math.log10(Math.max(event.amountUsd, 1)) / 8);
  const anomalyScore = clamp(Math.log10(Math.max(event.metrics?.anomalyMultiple || 1, 1)) / 2);
  const socialVelocity = clamp((event.metrics?.socialVelocity || 0) / 100);
  const keywordScore = clamp((event.keywordHits?.length || 0) * 0.18);
  const protocolMove = clamp(Math.abs(event.metrics?.tvlChangePct || 0) / 12);
  const exchangeRisk = exchangeSet.has(String(event.to || "").toLowerCase()) ? 0.18 : 0;
  const typeBoost = { large_transfer: 0.08, dex_swap: 0.06, protocol_tvl_change: 0.08, social_spike: 0.04, news: 0.03 }[event.type] || 0;
  const score = clamp((event.metrics?.reliability || 0.7) * 0.24 + financialImpact * 0.25 + anomalyScore * 0.2 + Math.max(socialVelocity, keywordScore, protocolMove) * 0.2 + exchangeRisk + typeBoost);
  return {
    score: Number(score.toFixed(3)),
    severity: score >= 0.78 ? "critical" : score >= 0.62 ? "high" : score >= 0.45 ? "medium" : "low",
    shouldAlert: score >= 0.45
  };
}

export function journalStats(entries = []) {
  const completed = entries.filter((entry) => entry.outcome24h && entry.outcome24h !== "neutral");
  const hits = completed.filter((entry) => entry.outcome24h === "hit").length;
  const signedReturn = (entry) => Number(entry.return24h || 0) * (entry.direction === "bearish" ? -1 : 1);
  const group = (key) => {
    const map = new Map();
    for (const entry of entries) {
      const name = entry[key] || "unknown";
      if (!map.has(name)) map.set(name, []);
      map.get(name).push(entry);
    }
    return [...map.entries()].map(([name, rows]) => {
      const done = rows.filter((entry) => entry.outcome24h && entry.outcome24h !== "neutral");
      const hitCount = done.filter((entry) => entry.outcome24h === "hit").length;
      return {
        name,
        total: rows.length,
        evaluated: done.length,
        hitRate: done.length ? hitCount / done.length : 0,
        averageReturn: done.reduce((sum, entry) => sum + signedReturn(entry), 0) / Math.max(done.length, 1)
      };
    });
  };
  return {
    total: entries.length,
    evaluated: completed.length,
    hits,
    hitRate: completed.length ? hits / completed.length : 0,
    averageReturn: completed.reduce((sum, entry) => sum + signedReturn(entry), 0) / Math.max(completed.length, 1),
    bySignalType: group("signalType"),
    byAsset: group("asset")
  };
}

function inferType(payload) {
  if (payload.txHash || payload.from || payload.to) return "large_transfer";
  if (payload.protocol && payload.tvlChangePct) return "protocol_tvl_change";
  if (payload.author || payload.socialVelocity) return "social_spike";
  if (payload.title || payload.url) return "news";
  return "unknown";
}

function sourceReliability(source) {
  const normalized = String(source).toLowerCase();
  if (normalized.includes("alchemy") || normalized.includes("moralis") || normalized.includes("helius")) return 0.9;
  if (normalized.includes("defillama") || normalized.includes("coingecko") || normalized.includes("cryptopanic")) return 0.82;
  if (normalized.includes("x") || normalized.includes("farcaster")) return 0.62;
  return 0.7;
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}
