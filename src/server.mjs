import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, createReadStream, readFileSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const dataDir = path.join(rootDir, "data");
const statePath = path.join(dataDir, "state.json");
const dbPath = path.join(dataDir, "app.db");
const envPath = path.join(rootDir, ".env");
const announcementRulesPath = path.join(rootDir, "config", "announcement-rules.json");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

await loadEnv();

const port = Number(process.env.PORT || 4173);

const defaultState = {
  watchlist: {
    assets: ["ETH", "BTC", "SOL", "ARB", "UNI"],
    wallets: [
      { address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e", label: "Whale treasury" },
      { address: "0x28C6c06298d514Db089934071355E5743bf21d60", label: "Binance hot wallet" }
    ],
    protocols: ["Uniswap", "Aave", "Lido", "Maker"],
    keywords: ["exploit", "airdrop", "ETF", "unlock", "governance"],
    kols: ["WuBlockchain", "lookonchain", "zachxbt", "VitalikButerin", "cz_binance", "APompliano"],
    brandTerms: ["Binance", "OKX", "Bybit", "Bitget"]
  },
  rawEvents: [],
  normalizedEvents: [],
  alerts: [],
  exchangeAnnouncements: [],
  unlockEvents: [],
  translationCache: {},
  feedback: [],
  settings: {
    language: "zh",
    myExchangeId: "binance"
  },
  metrics: {
    ingested: 0,
    normalized: 0,
    alerts: 0,
    lastRunAt: null,
    lastLiveSyncAt: null,
    translationInputTokens: 0,
    translationOutputTokens: 0,
    aiInputTokens: 0,
    aiOutputTokens: 0,
    aiAnalystCalls: 0
  },
  connectorHealth: {}
};

const addressBook = new Map(defaultState.watchlist.wallets.map((item) => [item.address.toLowerCase(), item.label]));
const exchangeAddresses = new Map([
  ["0x28c6c06298d514db089934071355e5743bf21d60", "Binance"],
  ["0xdfd5293d8e347dfe59e90efd55b2956a1343963d", "Binance"],
  ["0x3f5ce5fbfe3e9af3971dD833D26BA9b5C936f0bE", "Binance"],
  ["0x503828976d22510aad0201ac7ec88293211d23da", "Coinbase"],
  ["0x2faf487a4414fe77e2327f0bf4ae2a264a776ad2", "FTX legacy"]
].map(([address, label]) => [address.toLowerCase(), label]));

const market = {
  ETH: { price: 2400, volume24h: 12_800_000_000, volatility1h: 0.018 },
  BTC: { price: 61000, volume24h: 24_300_000_000, volatility1h: 0.012 },
  SOL: { price: 145, volume24h: 2_200_000_000, volatility1h: 0.026 },
  ARB: { price: 0.92, volume24h: 430_000_000, volatility1h: 0.031 },
  UNI: { price: 9.4, volume24h: 280_000_000, volatility1h: 0.022 },
  USDC: { price: 1, volume24h: 6_000_000_000, volatility1h: 0.002 }
};

const coinIds = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  ARB: "arbitrum",
  UNI: "uniswap",
  USDC: "usd-coin",
  USDT: "tether",
  LINK: "chainlink",
  AAVE: "aave",
  LDO: "lido-dao",
  MKR: "maker"
};

const connectorDocs = {
  alchemy: "https://www.alchemy.com/docs/reference/notify-api-quickstart",
  coingecko: "https://docs.coingecko.com/reference/simple-price",
  cryptopanic: "https://cryptopanic.com/developers/api/about",
  defillama: "https://api-docs.defillama.com/",
  x: "https://docs.x.com/x-api/posts/search-recent-posts",
  etherscan: "https://docs.etherscan.io/api-reference/endpoint/txlist"
};

const exchangeSources = [
  {
    id: "binance",
    name: "Binance",
    url: "https://www.binance.com/en/support/announcement/list/93",
    docs: "https://www.binance.com/en/support/announcement/list/93"
  },
  {
    id: "okx",
    name: "OKX",
    url: "https://www.okx.com/help/section/announcements-latest-announcements",
    docs: "https://www.okx.com/en-us/help/section/announcements-latest-announcements"
  },
  {
    id: "bybit",
    name: "Bybit",
    url: "https://announcements.bybit.com/en/",
    docs: "https://bybit-exchange.github.io/docs/v5/announcement"
  },
  {
    id: "bitget",
    name: "Bitget",
    url: "https://www.bitget.com/support/announcement-center",
    docs: "https://www.bitget.com/api-doc/common/notice/Get-All-Notices"
  },
  {
    id: "kucoin",
    name: "KuCoin",
    url: "https://www.kucoin.com/announcement",
    docs: "https://www.kucoin.com/docs-new/rest/spot-trading/market-data/get-announcements"
  },
  {
    id: "gate",
    name: "Gate",
    url: "https://www.gate.com/en-us/announcements",
    docs: "https://www.gate.com/en-us/announcements"
  },
  {
    id: "mexc",
    name: "MEXC",
    url: "https://www.mexc.com/announcements/all",
    docs: "https://www.mexc.com/announcements/all"
  },
  {
    id: "htx",
    name: "HTX",
    url: "https://www.htx.com/en-us/support/",
    docs: "https://www.htx.com/en-us/support/"
  },
  {
    id: "coinbase",
    name: "Coinbase",
    url: "https://www.coinbase.com/blog/announcements",
    docs: "https://www.coinbase.com/blog/announcements"
  },
  {
    id: "kraken",
    name: "Kraken",
    url: "https://blog.kraken.com/category/product",
    docs: "https://blog.kraken.com/category/product"
  },
  {
    id: "crypto_com",
    name: "Crypto.com",
    url: "https://crypto.com/product-news",
    docs: "https://crypto.com/product-news"
  },
  {
    id: "bitfinex",
    name: "Bitfinex",
    url: "https://blog.bitfinex.com/category/announcements/",
    docs: "https://blog.bitfinex.com/category/announcements/"
  },
  {
    id: "bitmex",
    name: "BitMEX",
    url: "https://blog.bitmex.com/category/site-announcements/",
    docs: "https://blog.bitmex.com/category/site-announcements/"
  },
  {
    id: "deribit",
    name: "Deribit",
    url: "https://insights.deribit.com/exchange-updates/",
    docs: "https://insights.deribit.com/exchange-updates/"
  },
  {
    id: "bitstamp",
    name: "Bitstamp",
    url: "https://blog.bitstamp.net/category/product/",
    docs: "https://blog.bitstamp.net/category/product/"
  },
  {
    id: "gemini",
    name: "Gemini",
    url: "https://www.gemini.com/blog",
    docs: "https://www.gemini.com/blog"
  },
  {
    id: "lbank",
    name: "LBank",
    url: "https://support.lbank.com/hc/en-gb/categories/900000148646-Announcements",
    docs: "https://support.lbank.com/hc/en-gb/categories/900000148646-Announcements"
  },
  {
    id: "bingx",
    name: "BingX",
    url: "https://support.bingx.com/hc/en-001/categories/360000184993-Announcements",
    docs: "https://support.bingx.com/hc/en-001/categories/360000184993-Announcements"
  },
  {
    id: "bitmart",
    name: "BitMart",
    url: "https://support.bitmart.com/hc/en-us/categories/360002516474-Announcements",
    docs: "https://support.bitmart.com/hc/en-us/categories/360002516474-Announcements"
  },
  {
    id: "coinex",
    name: "CoinEx",
    url: "https://announcement.coinex.com/hc/en-us/categories/360000031353-Announcement",
    docs: "https://announcement.coinex.com/hc/en-us/categories/360000031353-Announcement"
  }
];

const announcementRules = loadAnnouncementRules();

await mkdir(dataDir, { recursive: true });
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
initDatabase();

const fetchCache = new Map();
const ingestRateLimit = new Map();
let aiWindowStart = Date.now();
let aiCallsThisHour = 0;

let state = await loadState();
loadPersistentState();

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      fingerprint TEXT UNIQUE,
      observed_at TEXT,
      type TEXT,
      asset TEXT,
      source TEXT,
      amount_usd REAL,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      event_id TEXT,
      created_at TEXT,
      severity TEXT,
      score REAL,
      asset TEXT,
      signal_type TEXT,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      exchange_id TEXT,
      language TEXT,
      published_at TEXT,
      title TEXT,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS signals (
      id TEXT PRIMARY KEY,
      alert_id TEXT UNIQUE,
      event_id TEXT,
      created_at TEXT,
      asset TEXT,
      signal_type TEXT,
      direction TEXT,
      entry_price REAL,
      score REAL,
      reasons TEXT,
      price_1h REAL,
      return_1h REAL,
      outcome_1h TEXT,
      price_24h REAL,
      return_24h REAL,
      outcome_24h TEXT,
      price_7d REAL,
      return_7d REAL,
      outcome_7d TEXT,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      announcement_id TEXT,
      exchange_id TEXT,
      exchange TEXT,
      campaign_type TEXT,
      tokens TEXT,
      starts_at TEXT,
      ends_at TEXT,
      published_at TEXT,
      structured INTEGER,
      json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_observed ON events(observed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_announcements_lang_time ON announcements(language, published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_signals_created ON signals(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_campaigns_time ON campaigns(published_at DESC);
  `);
}

function loadAnnouncementRules() {
  try {
    return JSON.parse(readFileSync(announcementRulesPath, "utf8"));
  } catch {
    return { categories: [], campaignTypes: [] };
  }
}

function loadPersistentState() {
  if (db.prepare("SELECT COUNT(*) AS count FROM events").get().count === 0) {
    for (const event of state.normalizedEvents || []) persistEvent(event);
  }
  if (db.prepare("SELECT COUNT(*) AS count FROM alerts").get().count === 0) {
    for (const alert of state.alerts || []) persistAlert(alert);
  }
  if (db.prepare("SELECT COUNT(*) AS count FROM announcements").get().count === 0) {
    for (const item of state.exchangeAnnouncements || []) persistAnnouncement(item);
  }
  state.normalizedEvents = db.prepare("SELECT json FROM events ORDER BY observed_at DESC LIMIT 500").all().map((row) => JSON.parse(row.json));
  state.alerts = db.prepare("SELECT json FROM alerts ORDER BY created_at DESC LIMIT 300").all().map((row) => JSON.parse(row.json));
  state.exchangeAnnouncements = db.prepare("SELECT json FROM announcements ORDER BY published_at DESC LIMIT 600").all().map((row) => JSON.parse(row.json));
}


async function loadEnv() {
  if (!existsSync(envPath)) return;
  const text = await readFile(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (!process.env[key]) process.env[key] = rest.join("=").trim().replace(/^["']|["']$/g, "");
  }
}

async function loadState() {
  await mkdir(dataDir, { recursive: true });
  if (!existsSync(statePath)) {
    await saveState(defaultState);
    return structuredClone(defaultState);
  }

  try {
    const saved = JSON.parse(await readFile(statePath, "utf8"));
    return {
      ...structuredClone(defaultState),
      ...saved,
      watchlist: { ...defaultState.watchlist, ...saved.watchlist },
      settings: { ...defaultState.settings, ...saved.settings },
      metrics: { ...defaultState.metrics, ...saved.metrics },
      connectorHealth: { ...defaultState.connectorHealth, ...saved.connectorHealth }
    };
  } catch {
    return structuredClone(defaultState);
  }
}

async function saveState(nextState = state) {
  await mkdir(dataDir, { recursive: true });
  const settingsState = {
    watchlist: nextState.watchlist,
    unlockEvents: nextState.unlockEvents,
    translationCache: nextState.translationCache,
    feedback: nextState.feedback,
    settings: nextState.settings,
    metrics: nextState.metrics,
    connectorHealth: nextState.connectorHealth
  };
  await writeFile(statePath, JSON.stringify(settingsState, null, 2));
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(payload);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) return {};
  return JSON.parse(text);
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function rateLimit(req, bucket = "global", limit = 60, windowMs = 60_000) {
  const ip = req.socket.remoteAddress || "local";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const hits = (ingestRateLimit.get(key) || []).filter((time) => now - time < windowMs);
  hits.push(now);
  ingestRateLimit.set(key, hits);
  return hits.length <= limit;
}

function validateIngestPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "payload_must_be_object";
  if (body.amountUsd != null && (!Number.isFinite(Number(body.amountUsd)) || Number(body.amountUsd) < 0)) return "invalid_amountUsd";
  if (body.amount != null && (!Number.isFinite(Number(body.amount)) || Number(body.amount) < 0)) return "invalid_amount";
  if (body.asset != null && !/^[A-Za-z0-9]{1,16}$/.test(String(body.asset))) return "invalid_asset";
  if (body.url != null && String(body.url).length > 1000) return "url_too_long";
  if (body.title != null && String(body.title).length > 500) return "title_too_long";
  return "";
}

function id(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function currency(value) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2
  }).format(value);
}

function nowIso() {
  return new Date().toISOString();
}

function connectorOk(name, detail = {}) {
  state.connectorHealth[name] = {
    ok: true,
    checkedAt: nowIso(),
    message: detail.message || "已连接",
    count: detail.count || 0
  };
}

function connectorFail(name, error) {
  state.connectorHealth[name] = {
    ok: false,
    checkedAt: nowIso(),
    message: error?.message || String(error),
    count: 0
  };
}

function currentLanguage() {
  return "zh";
}

function languageName(language = currentLanguage()) {
  return "中文";
}

function isChineseText(text) {
  return /[\u3400-\u9fff]/.test(String(text || ""));
}

function localText(zh, en) {
  return zh;
}

function trimList(items, max = 500) {
  return items.slice(0, max);
}

function persistEvent(event) {
  db.prepare(
    `INSERT OR REPLACE INTO events (id, fingerprint, observed_at, type, asset, source, amount_usd, json)
     VALUES (@id, @fingerprint, @observedAt, @type, @asset, @source, @amountUsd, @json)`
  ).run({ ...event, fingerprint: event.fingerprint || null, json: JSON.stringify(event) });
}

function persistAlert(alert) {
  db.prepare(
    `INSERT OR REPLACE INTO alerts (id, event_id, created_at, severity, score, asset, signal_type, json)
     VALUES (@id, @eventId, @createdAt, @severity, @score, @asset, @signalType, @json)`
  ).run({
    id: alert.id,
    eventId: alert.eventId,
    createdAt: alert.createdAt,
    severity: alert.severity,
    score: alert.score,
    asset: alert.event?.asset || "",
    signalType: alert.event?.type || "",
    json: JSON.stringify(alert)
  });
}

function persistAnnouncement(item) {
  const row = {
    ...item,
    language: item.language || (isChineseText(item.title) ? "zh" : "en"),
    publishedAt: item.publishedAt || item.fetchedAt || nowIso()
  };
  db.prepare(
    `INSERT OR REPLACE INTO announcements (id, exchange_id, language, published_at, title, json)
     VALUES (@id, @exchangeId, @language, @publishedAt, @title, @json)`
  ).run({ ...row, json: JSON.stringify(row) });
  const campaign = parseCampaign(row);
  if (campaign) persistCampaign(campaign);
}

function persistCampaign(campaign) {
  db.prepare(
    `INSERT OR REPLACE INTO campaigns (
      id, announcement_id, exchange_id, exchange, campaign_type, tokens, starts_at, ends_at, published_at, structured, json
    ) VALUES (
      @id, @announcementId, @exchangeId, @exchange, @campaignType, @tokensJson, @startsAt, @endsAt, @publishedAt, @structured, @json
    )`
  ).run({ ...campaign, tokensJson: JSON.stringify(campaign.tokens || []), json: JSON.stringify(campaign) });
}

function opsCategoryFor(text, language = currentLanguage()) {
  const lower = String(text || "").toLowerCase();
  const matched = announcementRules.categories.find((category) =>
    (category.keywords || []).some((keyword) => lower.includes(String(keyword).toLowerCase()))
  );
  if (!matched) return { id: "other", label: language === "zh" ? "其他" : "Other" };
  return { id: matched.id, label: language === "zh" ? matched.zh : matched.en };
}

function campaignTypeFor(text, language = currentLanguage()) {
  const lower = String(text || "").toLowerCase();
  const matched = announcementRules.campaignTypes.find((type) =>
    (type.keywords || []).some((keyword) => lower.includes(String(keyword).toLowerCase()))
  );
  if (!matched) return { id: "other", label: language === "zh" ? "其他" : "Other" };
  return { id: matched.id, label: language === "zh" ? matched.zh : matched.en };
}

function campaignTypeLabel(id, language = currentLanguage()) {
  const matched = announcementRules.campaignTypes.find((type) => type.id === id);
  if (!matched) return language === "zh" ? "其他" : "Other";
  return language === "zh" ? matched.zh : matched.en;
}

function opsCategoryLabel(id, language = currentLanguage()) {
  const matched = announcementRules.categories.find((category) => category.id === id);
  if (!matched) return language === "zh" ? "其他" : "Other";
  return language === "zh" ? matched.zh : matched.en;
}

function exchangeName(exchangeId) {
  return exchangeSources.find((source) => source.id === exchangeId)?.name || exchangeId || "";
}

function myExchangeId() {
  const id = state.settings.myExchangeId || "binance";
  return exchangeSources.some((source) => source.id === id) ? id : "binance";
}

function regulationMetaFor(text) {
  const value = String(text || "");
  const lower = value.toLowerCase();
  const isRegulation =
    opsCategoryFor(value, "zh").id === "regulation" ||
    /(sec|sfc|mas|fca|mifid|mica|license|compliance|ban|lawsuit|fine|penalty|regulation|regulatory|监管|牌照|合规|禁令|诉讼|罚款|处罚)/i.test(value);
  if (!isRegulation) return { isRegulation: false, region: "" };
  let region = "OTHER";
  if (/(sec|cftc|finra|doj|美国|美 SEC|美國)/i.test(value)) region = "US";
  else if (/(sfc|hong kong|hkma|香港|港证监|證監)/i.test(value)) region = "HK";
  else if (/(mas|singapore|新加坡)/i.test(value)) region = "SG";
  else if (/(eu|europe|european|mica|mifid|esma|欧洲|歐洲|欧盟|歐盟)/i.test(value)) region = "EU";
  const highRisk = /(ban|lawsuit|fine|penalty|禁令|诉讼|訴訟|罚款|罰款|处罚|處罰)/i.test(value);
  return { isRegulation: true, region, highRisk };
}

function regulationDisplayTitle(text, region = "OTHER", asset = "Web3") {
  const value = String(text || "");
  if (/禁令|ban/i.test(value)) return `${region} 监管禁令动态：${asset}`;
  if (/诉讼|lawsuit/i.test(value)) return `${region} 监管诉讼动态：${asset}`;
  if (/罚款|罰款|fine|penalty/i.test(value)) return `${region} 监管罚款动态：${asset}`;
  if (/牌照|license/i.test(value)) return `${region} 牌照合规动态：${asset}`;
  return `${region} 监管动态：${asset}`;
}

function tokensFromTitle(title) {
  const blacklist = new Set([
    "USDT", "USDC", "USD", "APR", "API", "VIP", "ETF", "NFT", "BTC", "ETH", "BOT", "DEFI",
    "BINANCE", "OKX", "BYBIT", "BITGET", "KUCOIN", "GATE", "MEXC", "HTX", "COINBASE", "KRAKEN",
    "CRYPTO", "COM", "BITFINEX", "BITMEX", "DERIBIT", "BITSTAMP", "GEMINI", "LBANK", "BINGX", "BITMART", "COINEX"
  ]);
  const matches = String(title || "").match(/\b[A-Z0-9]{2,12}\b/g) || [];
  const normalized = matches
    .map((token) => token.replace(/(USDT|USDC|USD)$/i, ""))
    .filter((token) => token.length >= 2 && !blacklist.has(token) && /[A-Z]/.test(token));
  return [...new Set(normalized)].slice(0, 8);
}

function parseCampaign(announcement) {
  if (announcement.opsCategoryId !== "campaign") return null;
  const sourceTitle = announcement.originalTitle || announcement.title;
  const type = campaignTypeFor(`${announcement.title} ${sourceTitle}`, announcement.language);
  const startsAt = announcement.startsAt || "";
  const endsAt = announcement.endsAt || "";
  const structured = Boolean(type.id !== "other" || startsAt || endsAt || announcement.tokens?.length);
  return {
    id: `cmp:${announcement.id}`,
    announcementId: announcement.id,
    exchangeId: announcement.exchangeId,
    exchange: announcement.exchange,
    campaignType: type.label,
    campaignTypeId: type.id,
    tokens: announcement.tokens || tokensFromTitle(announcement.title),
    startsAt,
    endsAt,
    publishedAt: announcement.publishedAt,
    structured: structured ? 1 : 0,
    title: announcement.title,
    originalTitle: sourceTitle,
    url: announcement.url
  };
}

async function ingest(rawEvent) {
  if (isDuplicate(rawEvent)) {
    return { raw: null, event: null, alert: null, duplicate: true };
  }

  const raw = {
    id: id("raw"),
    receivedAt: nowIso(),
    source: rawEvent.source || "manual",
    payload: rawEvent
  };

  const event = normalize(raw);
  const alert = evaluate(event);

  state.rawEvents = trimList([raw, ...state.rawEvents]);
  state.normalizedEvents = trimList([event, ...state.normalizedEvents]);
  persistEvent(event);
  state.metrics.ingested += 1;
  state.metrics.normalized += 1;
  state.metrics.lastRunAt = nowIso();

  if (alert) {
    await attachAiAnalysis(alert);
    state.alerts = trimList([alert, ...state.alerts], 300);
    persistAlert(alert);
    state.metrics.alerts += 1;
    await createJournalEntry(alert);
    await deliverAlert(alert);
  }

  await saveState();
  return { raw, event, alert };
}

function isDuplicate(rawEvent) {
  const fingerprint = eventFingerprint(rawEvent);
  if (!fingerprint) return false;
  if (state.normalizedEvents.some((event) => event.fingerprint === fingerprint)) return true;
  return Boolean(db.prepare("SELECT 1 FROM events WHERE fingerprint = ?").get(fingerprint));
}

function eventFingerprint(rawEvent) {
  if (rawEvent.fingerprint) return rawEvent.fingerprint;
  if (rawEvent.txHash) return `tx:${rawEvent.txHash}`.toLowerCase();
  if (rawEvent.url) return `url:${rawEvent.url}`.toLowerCase();
  if (rawEvent.source && rawEvent.title) return `title:${rawEvent.source}:${rawEvent.title}`.toLowerCase();
  return "";
}

function normalize(raw) {
  const payload = raw.payload;
  const type = payload.type || inferType(payload);
  const asset = (payload.asset || payload.symbol || "ETH").toUpperCase();
  const price = market[asset]?.price || Number(payload.priceUsd || 1);
  const amount = Number(payload.amount || payload.quantity || 0);
  const amountUsd = Number(payload.amountUsd || amount * price || 0);
  const from = payload.from || payload.fromAddress || null;
  const to = payload.to || payload.toAddress || null;
  const regulation = regulationMetaFor(`${payload.title || ""} ${payload.body || ""} ${payload.text || ""}`);

  return {
    id: id("evt"),
    fingerprint: eventFingerprint(payload),
    rawId: raw.id,
    type,
    source: raw.source,
    chain: payload.chain || "ethereum",
    asset,
    amount,
    amountUsd,
    title: payload.title || titleFor(type, asset, amountUsd),
    body: payload.body || payload.text || payload.summary || "",
    url: payload.url || payload.txUrl || "",
    txHash: payload.txHash || "",
    from,
    to,
    fromLabel: labelAddress(from),
    toLabel: labelAddress(to),
    protocol: payload.protocol || detectProtocol(payload),
    keywordHits: keywordHits(`${payload.title || ""} ${payload.body || ""} ${payload.text || ""}`),
    sentiment: inferSentiment(`${payload.title || ""} ${payload.body || ""} ${payload.text || ""}`),
    brandHits: brandHits(`${payload.title || ""} ${payload.body || ""} ${payload.text || ""}`),
    opsCategoryId: regulation.isRegulation ? "regulation" : payload.opsCategoryId || "",
    opsCategory: regulation.isRegulation ? "监管动态" : payload.opsCategory || "",
    regulationRegion: regulation.region || payload.regulationRegion || "",
    regulationHighRisk: Boolean(regulation.highRisk || payload.regulationHighRisk),
    observedAt: payload.observedAt || raw.receivedAt,
    metrics: enrichMetrics(type, asset, amountUsd, payload)
  };
}

function inferType(payload) {
  if (payload.txHash || payload.from || payload.to) return "large_transfer";
  if (payload.protocol && payload.tvlChangePct) return "protocol_tvl_change";
  if (payload.author || payload.socialVelocity) return "social_spike";
  if (payload.title || payload.url) return "news";
  return "unknown";
}

function titleFor(type, asset, amountUsd) {
  if (type === "large_transfer") return `${asset} 大额转账`;
  if (type === "dex_swap") return `${asset} 去中心化交易所大额兑换`;
  if (type === "protocol_tvl_change") return "协议总锁仓量异动";
  if (type === "social_spike") return `${asset} 社交热度异动`;
  if (type === "news") return `${asset} 新闻`;
  if (type === "market_move") return `${asset} 市场价格异动`;
  return amountUsd ? `${asset} 事件 ${currency(amountUsd)}` : `${asset} 事件`;
}

function labelAddress(address) {
  if (!address) return "";
  const key = address.toLowerCase();
  return addressBook.get(key) || exchangeAddresses.get(key) || shorten(address);
}

function shorten(value) {
  if (!value || value.length < 12) return value || "";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function detectProtocol(payload) {
  const text = `${payload.title || ""} ${payload.body || ""} ${payload.text || ""}`.toLowerCase();
  return state.watchlist.protocols.find((item) => text.includes(item.toLowerCase())) || payload.protocol || "";
}

function keywordHits(text) {
  const lower = text.toLowerCase();
  return state.watchlist.keywords.filter((keyword) => lower.includes(keyword.toLowerCase()));
}

function brandHits(text) {
  const lower = text.toLowerCase();
  return (state.watchlist.brandTerms || []).filter((term) => lower.includes(term.toLowerCase()));
}

function inferSentiment(text) {
  const lower = String(text || "").toLowerCase();
  if (/(hack|exploit|scam|rug|fud|lawsuit|insolvent|withdrawal issue|攻击|漏洞|跑路|诈骗|暴雷|无法提现|负面|下架)/.test(lower)) return "negative";
  if (/(launch|reward|growth|record high|partnership|airdrop|上线|奖励|增长|合作|空投|利好)/.test(lower)) return "positive";
  return "neutral";
}

function enrichMetrics(type, asset, amountUsd, payload) {
  const assetMarket = market[asset] || { volume24h: 0, volatility1h: 0.02 };
  const baselineUsd = Number(payload.baselineUsd || historicalBaseline(type, asset));
  const anomalyMultiple = baselineUsd > 0 ? amountUsd / baselineUsd : 0;
  const volumeShare = assetMarket.volume24h ? amountUsd / assetMarket.volume24h : 0;

  return {
    priceUsd: assetMarket.price || Number(payload.priceUsd || 0),
    amountUsd,
    baselineUsd,
    anomalyMultiple,
    volumeShare,
    volatility1h: Number(payload.volatility1h || assetMarket.volatility1h || 0),
    socialVelocity: Number(payload.socialVelocity || 0),
    tvlChangePct: Number(payload.tvlChangePct || 0),
    reliability: sourceReliability(payload.source || "manual")
  };
}

function historicalBaseline(type, asset) {
  const same = state.normalizedEvents.filter((event) => event.type === type && event.asset === asset && event.amountUsd > 0);
  if (same.length < 5) {
    if (type === "large_transfer") return asset === "BTC" ? 3_000_000 : 1_000_000;
    if (type === "dex_swap") return 400_000;
    return 100_000;
  }
  const sorted = same.map((event) => event.amountUsd).sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] || 1;
}

function sourceReliability(source) {
  const normalized = source.toLowerCase();
  if (normalized.includes("alchemy") || normalized.includes("moralis") || normalized.includes("helius")) return 0.9;
  if (normalized.includes("defillama") || normalized.includes("coingecko") || normalized.includes("cryptopanic")) return 0.82;
  if (normalized.includes("x") || normalized.includes("farcaster")) return 0.62;
  return 0.7;
}

async function syncLiveSources() {
  const startedAt = nowIso();
  const results = await Promise.allSettled([
    syncCoinGecko(),
    syncDefiLlama(),
    syncUnlockCalendar(),
    syncWeb3News(),
    syncCryptoPanic(),
    syncXKolPosts(),
    syncWhaleTransfers(),
    syncExchangeAnnouncements()
  ]);
  state.metrics.lastLiveSyncAt = startedAt;
  await saveState();
  return {
    startedAt,
    connectors: state.connectorHealth,
    results: results.map((result) => (result.status === "fulfilled" ? result.value : { error: result.reason.message }))
  };
}

async function syncExchangeAnnouncements() {
  const language = currentLanguage();
  const results = await Promise.allSettled([
    fetchBinanceActivities(language),
    fetchOkxAnnouncements(language),
    fetchBybitActivities(language),
    fetchBitgetAnnouncements(language),
    ...exchangeSources
      .filter((source) => !["binance", "okx", "bybit", "bitget"].includes(source.id))
      .map((source) => fetchGenericExchangeAnnouncements(source, language))
  ]);
  const announcements = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  const existingOtherLanguages = state.exchangeAnnouncements.filter((item) => item.language !== language);
  const existingSameLanguage = state.exchangeAnnouncements.filter((item) => item.language === language);
  const merged = [...announcements, ...existingSameLanguage]
    .filter((item) => item && item.id && item.title)
    .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  const seen = new Set();
  const dedupedLanguageItems = merged.filter((item) => {
      const key = item.id || `${item.exchange}:${item.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
  });
  state.exchangeAnnouncements = trimList([...dedupedLanguageItems, ...existingOtherLanguages], 600);
  for (const item of state.exchangeAnnouncements) {
    persistAnnouncement(item);
    createAnnouncementKeywordAlert(item);
    createRegulationAnnouncementAlert(item);
  }

  for (const source of exchangeSources) {
    const count = announcements.filter((item) => item.exchangeId === source.id).length;
    if (!state.connectorHealth[source.id]) {
      connectorOk(source.id, {
        count,
        message: count ? `已同步 ${count} 条${languageName(language)}交易所公告` : "暂无新公告"
      });
    }
  }

  return { source: "exchange_announcements", language, count: announcements.length };
}

function createAnnouncementKeywordAlert(item) {
  const hits = state.watchlist.keywords.filter((keyword) => String(item.title || "").toLowerCase().includes(keyword.toLowerCase()));
  if (!hits.length) return;
  const alertId = `ops_alert:${item.id}:${hits.join(",")}`;
  if (db.prepare("SELECT 1 FROM alerts WHERE id = ?").get(alertId)) return;
  const alert = {
    id: alertId,
    eventId: item.id,
    severity: "medium",
    score: 0.62,
    title: `关键词命中：${item.exchange} ${hits.join(", ")}`,
    summary: `${item.title} 命中订阅关键词：${hits.join(", ")}。`,
    reasons: ["关键词订阅", item.opsCategory || "公告"],
    sources: [item.url].filter(Boolean),
    createdAt: nowIso(),
    status: "open",
    event: {
      id: item.id,
      type: "announcement_keyword",
      asset: item.tokens?.[0] || "OPS",
      source: item.exchange,
      title: item.title,
      url: item.url,
      amountUsd: 0,
      keywordHits: hits,
      metrics: { reliability: 0.85, anomalyMultiple: 1, socialVelocity: 0, tvlChangePct: 0 }
    }
  };
  state.alerts = trimList([alert, ...state.alerts], 300);
  persistAlert(alert);
}

function createRegulationAnnouncementAlert(item) {
  if (item.opsCategoryId !== "regulation" || !item.regulationHighRisk) return;
  const alertId = `reg_alert:${item.id}`;
  if (db.prepare("SELECT 1 FROM alerts WHERE id = ?").get(alertId)) return;
  const displayTitle = regulationDisplayTitle(`${item.title || ""} ${item.originalTitle || ""}`, item.regulationRegion || "OTHER", item.tokens?.[0] || "Web3");
  const alert = {
    id: alertId,
    eventId: item.id,
    severity: "critical",
    score: 0.96,
    title: `严重: ${displayTitle}`,
    summary: `${item.exchange} 公告命中高危监管词，需要优先核验：${displayTitle}。`,
    reasons: ["监管动态", "高危词命中", item.regulationRegion || "OTHER"],
    sources: [item.url].filter(Boolean),
    createdAt: nowIso(),
    status: "open",
    event: {
      id: item.id,
      type: "announcement_regulation",
      asset: item.tokens?.[0] || "OPS",
      source: item.exchange,
      title: item.title,
      url: item.url,
      amountUsd: 0,
      opsCategoryId: "regulation",
      regulationRegion: item.regulationRegion || "OTHER",
      regulationHighRisk: true,
      keywordHits: [],
      metrics: { reliability: 0.9, anomalyMultiple: 1, socialVelocity: 80, tvlChangePct: 0 }
    }
  };
  state.alerts = trimList([alert, ...state.alerts], 300);
  persistAlert(alert);
  deliverAlert(alert).catch((error) => connectorFail("regulationAlertDelivery", error));
}

async function fetchBinanceActivities(language = currentLanguage()) {
  const url = "https://www.binance.com/bapi/composite/v1/public/cms/article/list/query?type=1&catalogId=93&pageNo=1&pageSize=20";
  try {
    const headers = language === "zh" ? { lang: "zh-CN" } : {};
    const data = await fetchJson(url, { headers, cacheMs: 5 * 60 * 1000 });
    const articles = data?.data?.catalogs?.[0]?.articles || [];
    const items = [];
    for (const article of articles) {
      const originalTitle = article.title;
      const title = await titleForLanguage(originalTitle, language, "Binance");
      items.push(
      exchangeAnnouncement({
        exchangeId: "binance",
        exchange: "Binance",
        title,
        originalTitle,
        category: language === "zh" ? "最新活动" : "Latest Activities",
        publishedAt: Number(article.releaseDate),
        url: `https://www.binance.com/${language === "zh" ? "zh-CN" : "en"}/support/announcement/detail/${article.code}`,
        sourceUrl: exchangeSources.find((source) => source.id === "binance").url,
        language
      })
      );
    }
    connectorOk("binance", {
      count: items.length,
      message: `已同步 ${items.length} 条${languageName(language)}活动公告`
    });
    return items;
  } catch (error) {
    connectorFail("binance", error);
    return [];
  }
}

async function fetchBybitActivities(language = currentLanguage()) {
  const locale = "en-US";
  const url = `https://api.bybit.com/v5/announcements/index?locale=${locale}&limit=20`;
  try {
    const data = await fetchJson(url, { cacheMs: 5 * 60 * 1000 });
    const list = data?.result?.list || [];
    const items = [];
    const activityItems = list.filter((entry) => !entry.type?.key || entry.type.key === "latest_activities");
    for (const item of (activityItems.length ? activityItems : list).slice(0, 20)) {
      const originalTitle = item.title;
      const title = await titleForLanguage(originalTitle, language, "Bybit");
      items.push(
        exchangeAnnouncement({
          exchangeId: "bybit",
          exchange: "Bybit",
          title,
          originalTitle,
          category: language === "zh" ? "最新活动" : item.type?.title || "Latest Activities",
          tags: item.tags || [],
          publishedAt: Number(item.publishTime || item.dateTimestamp),
          startsAt: Number(item.startDateTimestamp),
          endsAt: Number(item.endDateTimestamp),
          url: item.url,
          sourceUrl: exchangeSources.find((source) => source.id === "bybit").url,
          language
        })
      );
    }
    connectorOk("bybit", { count: items.length, message: `已同步 ${items.length} 条${languageName(language)}活动公告` });
    return items;
  } catch (error) {
    connectorFail("bybit", error);
    return [];
  }
}

async function fetchBitgetAnnouncements(language = currentLanguage()) {
  const url = `https://api.bitget.com/api/v2/public/annoucements?language=${language === "zh" ? "zh_CN" : "en_US"}`;
  try {
    const data = await fetchJson(url, { cacheMs: 5 * 60 * 1000 });
    const list = Array.isArray(data?.data) ? data.data : [];
    const items = list.slice(0, 30).map((item) =>
        exchangeAnnouncement({
          exchangeId: "bitget",
          exchange: "Bitget",
          title: item.annTitle,
          originalTitle: item.annTitle,
          category: readableCategory(item.annType || item.annDesc, language),
          tags: [readableCategory(item.annSubType, language)].filter(Boolean),
          publishedAt: Number(item.cTime),
          url: item.annUrl,
          sourceUrl: exchangeSources.find((source) => source.id === "bitget").url,
          language
        })
      );
    connectorOk("bitget", { count: items.length, message: `已同步 ${items.length} 条${languageName(language)}公告` });
    return items;
  } catch (error) {
    connectorFail("bitget", error);
    return [];
  }
}

async function fetchOkxAnnouncements(language = currentLanguage()) {
  const url =
    language === "zh"
      ? "https://www.okx.com/zh-hans/help/section/announcements-latest-announcements"
      : "https://www.okx.com/help/section/announcements-latest-announcements";
  try {
    const html = await fetchText(url, { cacheMs: 5 * 60 * 1000 });
    const lines = htmlToLines(html);
    const items = [];
    for (let index = 1; index < lines.length; index += 1) {
      if (!isOkxDateLine(lines[index], language)) continue;
      const originalTitle = lines[index - 1];
      const title = language === "zh" ? await titleForLanguage(originalTitle, "zh", "OKX") : originalTitle;
      if (!originalTitle || originalTitle.length < 8 || originalTitle.includes("Announcements")) continue;
      items.push(
        exchangeAnnouncement({
          exchangeId: "okx",
          exchange: "OKX",
          title,
          originalTitle,
          category: classifyAnnouncement(title, language),
          publishedAt: parseOkxDate(lines[index], language),
          url,
          sourceUrl: url,
          language
        })
      );
      if (items.length >= 20) break;
    }
    connectorOk("okx", { count: items.length, message: `已同步 ${items.length} 条${languageName(language)}公告` });
    return items;
  } catch (error) {
    connectorFail("okx", error);
    return [];
  }
}

async function fetchGenericExchangeAnnouncements(source, language = currentLanguage()) {
  try {
    const html = await fetchText(source.url, { cacheMs: 5 * 60 * 1000 });
    const lines = htmlToLines(html)
      .filter((line) => line.length >= 12 && line.length <= 180)
      .filter((line) => !/^(login|sign up|cookie|privacy|terms|subscribe|learn more|view all)$/i.test(line));
    const candidates = [];
    const seen = new Set();
    for (const line of lines) {
      const score = announcementLineScore(line);
      if (score < 2) continue;
      const title = language === "zh" ? await titleForLanguage(line, "zh", source.name) : line;
      const key = `${source.id}:${line}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push(
        exchangeAnnouncement({
          exchangeId: source.id,
          exchange: source.name,
          title,
          originalTitle: line,
          category: classifyAnnouncement(title, language),
          publishedAt: Date.now(),
          url: source.url,
          sourceUrl: source.url,
          language
        })
      );
      if (candidates.length >= 12) break;
    }
    connectorOk(source.id, { count: candidates.length, message: `已同步 ${candidates.length} 条${source.name}公告` });
    return candidates;
  } catch (error) {
    connectorFail(source.id, error);
    return [];
  }
}

function announcementLineScore(line) {
  const text = String(line || "").toLowerCase();
  let score = 0;
  if (/(list|listing|launch|上线|上新|opens trading|spot trading|futures trading)/.test(text)) score += 3;
  if (/(campaign|reward|earn|bonus|airdrop|competition|tournament|活动|奖励|瓜分|空投|交易赛|理财|赚币)/.test(text)) score += 3;
  if (/(maintenance|upgrade|suspend|resume|维护|升级|暂停|恢复)/.test(text)) score += 2;
  if (/(fee|funding|leverage|contract|perpetual|费率|手续费|合约|永续)/.test(text)) score += 2;
  if (/(delist|remove|下架|移除)/.test(text)) score += 2;
  if (/\b[A-Z0-9]{2,12}(USDT|USDC|USD)?\b/.test(line)) score += 1;
  return score;
}

async function fetchWithRetry(url, options = {}, control = {}) {
  const retries = control.retries ?? 2;
  const timeoutMs = control.timeoutMs || options.timeoutMs || 10000;
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

async function fetchText(url, options = {}) {
  const cacheMs = options.cacheMs ?? 5 * 60 * 1000;
  const cacheKey = `text:${url}`;
  const cached = fetchCache.get(cacheKey);
  if (cacheMs && cached && Date.now() - cached.time < cacheMs) return cached.value;
  const timeoutMs = options.timeoutMs || 12000;
  const response = await fetchWithRetry(
    url,
    {
      ...options,
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "Mozilla/5.0 web3-info-monitor-agent/0.1",
        ...(options.headers || {})
      }
    },
    { timeoutMs, retries: options.retries ?? 2 }
  );
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const text = await response.text();
  if (cacheMs) fetchCache.set(cacheKey, { time: Date.now(), value: text });
  return text;
}

function htmlToLines(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function exchangeAnnouncement(input) {
  const publishedAt = normalizeTimestamp(input.publishedAt);
  const title = String(input.title || "").trim();
  const originalTitle = String(input.originalTitle || input.rawTitle || input.title || "").trim();
  const language = input.language || currentLanguage();
  const opsCategory = opsCategoryFor(`${title} ${originalTitle} ${input.category || ""}`, language);
  const tokens = tokensFromTitle(`${title} ${originalTitle}`);
  return {
    id: `${input.exchangeId}:${language}:${crypto.createHash("sha1").update(`${originalTitle || title}:${input.url || ""}`).digest("hex").slice(0, 16)}`,
    exchangeId: input.exchangeId,
    exchange: input.exchange,
    language,
    title,
    originalTitle,
    category: input.category || classifyAnnouncement(title, language),
    opsCategoryId: opsCategory.id,
    opsCategory: opsCategory.label,
    tokens,
    tags: input.tags || tagsForAnnouncement(title, language),
    url: input.url || input.sourceUrl,
    sourceUrl: input.sourceUrl || input.url,
    publishedAt,
    startsAt: normalizeTimestamp(input.startsAt),
    endsAt: normalizeTimestamp(input.endsAt),
    activityScore: activityScore(title, input.category, input.tags || []),
    matchedAssets: matchedAssets(title),
    fetchedAt: nowIso()
  };
}

function normalizeTimestamp(value) {
  const number = Number(value);
  if (!number) return "";
  const ms = number < 10_000_000_000 ? number * 1000 : number;
  return new Date(ms).toISOString();
}

function isOkxDateLine(line, language = currentLanguage()) {
  const text = String(line || "");
  return language === "zh" ? text.includes("发布于") : text.startsWith("Published on");
}

function parseOkxDate(line, language = currentLanguage()) {
  const text = String(line || "")
    .replace(language === "zh" ? "发布于" : "Published on", "")
    .trim();
  const normalized = text
    .replace(/年/g, "-")
    .replace(/月/g, "-")
    .replace(/日/g, "")
    .replace(/\s+/g, " ");
  const parsed = Date.parse(`${normalized} UTC`);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function readableCategory(value, language = currentLanguage()) {
  if (!value) return "";
  const key = String(value).toLowerCase();
  if (language === "zh") {
    const map = {
      maintenance_system_updates: "维护 / 升级",
      asset_maintenance: "资产维护",
      asset: "资产",
      coin_listings: "上新 / 交易",
      futures: "合约",
      spot: "现货",
      system: "系统",
      latest_activities: "最新活动",
      api: "API",
      delisting: "下架 / 移除",
      symbol_delisting: "下架 / 移除"
    };
    if (map[key]) return map[key];
  }
  return key
    .split(/[_-]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function classifyAnnouncement(title, language = currentLanguage()) {
  const lower = String(title || "").toLowerCase();
  const text = String(title || "");
  if (language === "zh") {
    if (/(奖励|活动|瓜分|锦标赛|交易竞赛|空投|年化|理财|赚币|嘉年华|挑战)/.test(text)) return "活动 / 奖励";
    if (/(上线|开通|开启|现货|合约|交易对|上新)/.test(text)) return "上新 / 交易";
    if (/(维护|暂停|恢复|升级|网络)/.test(text)) return "维护 / 升级";
    if (/(下架|移除)/.test(text)) return "下架 / 移除";
    return "公告";
  }
  if (/(reward|campaign|tournament|bonus|airdrop|earn|apr|win|share|voucher|carnival|challenge)/.test(lower)) {
    return "Activities / Rewards";
  }
  if (/(list|launch|trading pair|spot trading|futures)/.test(lower)) return "Listings / Trading";
  if (/(maintenance|suspend|resume|upgrade|network)/.test(lower)) return "Maintenance / Upgrades";
  if (/(delist|remove)/.test(lower)) return "Delisting / Removal";
  return "Announcement";
}

function tagsForAnnouncement(title, language = currentLanguage()) {
  const tags = [];
  const lower = String(title || "").toLowerCase();
  const zh = language === "zh";
  if (/(reward|bonus|voucher|win|share|奖励|瓜分)/.test(lower)) tags.push(zh ? "奖励" : "Rewards");
  if (/(airdrop|空投)/.test(lower)) tags.push(zh ? "空投" : "Airdrop");
  if (/(earn|apr|staking|年化|理财|赚币)/.test(lower)) tags.push(zh ? "理财" : "Earn");
  if (/(trading|tournament|competition|交易赛|锦标赛)/.test(lower)) tags.push(zh ? "交易赛" : "Trading event");
  if (/(list|launch|上线|开启)/.test(lower)) tags.push(zh ? "上新" : "Listing");
  return tags;
}

function matchedAssets(title) {
  const upper = String(title || "").toUpperCase();
  return state.watchlist.assets.filter((asset) => upper.includes(asset));
}

function activityScore(title, category, tags) {
  const text = `${title} ${category} ${(tags || []).join(" ")}`.toLowerCase();
  let score = 45;
  if (/(reward|bonus|voucher|win|share|airdrop)/.test(text)) score += 20;
  if (/(competition|tournament|campaign|carnival|challenge)/.test(text)) score += 15;
  if (/(list|launch|futures|spot)/.test(text)) score += 10;
  if (/(maintenance|suspend|delist|remove)/.test(text)) score += 12;
  return Math.min(score, 100);
}

async function titleForLanguage(title, language = currentLanguage(), context = "") {
  if (language !== "zh" || isChineseText(title)) return title;
  return translateToChinese(title, context);
}

async function translateToChinese(text, context = "") {
  const source = String(text || "").trim();
  if (!source || isChineseText(source)) return source;
  const cacheKey = `zh:v2:${source}`;
  if (state.translationCache[cacheKey]) return state.translationCache[cacheKey];

  if (process.env.OPENAI_API_KEY) {
    try {
      const translated = await translateWithOpenAI(source, context);
      if (translated) {
        state.translationCache[cacheKey] = translated;
        return translated;
      }
    } catch (error) {
      connectorFail("translation", error);
    }
  }

  const fallback = heuristicChineseTranslation(source, context);
  state.translationCache[cacheKey] = fallback;
  connectorOk("translation", {
    message: process.env.OPENAI_API_KEY ? "翻译降级为本地规则" : "未配置 OPENAI_API_KEY，使用本地规则翻译"
  });
  return fallback;
}

async function translateWithOpenAI(text, context = "") {
  const model = process.env.OPENAI_TRANSLATION_MODEL || "gpt-5.4-nano";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model,
      store: false,
      instructions: "Translate crypto exchange announcement titles into concise Simplified Chinese. Keep token symbols, numbers, dates, APR, and product names unchanged. Output only the translation.",
      input: `Context: ${context}\nTitle: ${text}`
    })
  });
  if (!response.ok) throw new Error(`OpenAI translation ${response.status} ${response.statusText}`);
  const data = await response.json();
  if (data.usage) {
    state.metrics.translationInputTokens += Number(data.usage.input_tokens || 0);
    state.metrics.translationOutputTokens += Number(data.usage.output_tokens || 0);
  }
  connectorOk("translation", { message: "已使用 OpenAI 翻译英文公告标题" });
  return extractResponseText(data);
}

function extractResponseText(data) {
  if (data.output_text) return String(data.output_text).trim();
  const parts = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.text) parts.push(content.text);
    }
  }
  return parts.join("").trim();
}

function heuristicChineseTranslation(text, context = "") {
  const replacements = [
    [/Livestream:/gi, "直播："],
    [/New User Exclusive/gi, "新用户专属"],
    [/Whale treasury/gi, "巨鲸金库"],
    [/hot wallet/gi, "热钱包"],
    [/FUD/gi, "负面舆情"],
    [/Lend and earn daily/gi, "每日借贷赚币"],
    [/Grow your network and earn/gi, "邀请好友并赚取奖励"],
    [/Collect Chips to earn rewards/gi, "收集筹码赚取奖励"],
    [/Quick commit, earn potential new tokens/gi, "快速投入，获取潜在新代币奖励"],
    [/Earned Rewards/gi, "已获得奖励"],
    [/Stake cryptos to earn in PoS products/gi, "质押加密资产参与 PoS 产品赚取收益"],
    [/Learn about crypto investing/gi, "学习加密投资知识"],
    [/Boosted USDC Rewards for the Rest of 2025/gi, "2025年剩余时间提高 USDC 奖励"],
    [/Deribit And SignalPlus Host 100,000 USDC Crypto Options Trading Competition/gi, "Deribit 与 SignalPlus 举办 100,000 USDC 加密期权交易赛"],
    [/Learn more about how our contracts work/gi, "了解合约产品运作方式"],
    [/Learn how trading at BitMEX works to take full advantage of your account/gi, "学习 BitMEX 交易机制并充分使用账户"],
    [/Learn everything you need to know about BitMEX/gi, "了解 BitMEX 使用要点"],
    [/Sign up and trade for new user rewards/gi, "注册并交易领取新用户奖励"],
    [/Claim exclusive bonuses and vouchers/gi, "领取专属奖金和代金券"],
    [/Earn up to 60% as a BitMEX Affiliate/gi, "成为 BitMEX 邀请合作伙伴，最高赚取60%返佣"],
    [/Invite to Earn/gi, "邀请好友赚取奖励"],
    [/Reward Distribution/gi, "奖励发放"],
    [/Higher rewards\. Clear timelines\. Full control\. Why settle for flexible when you can go further\?/gi, "更高奖励、清晰周期和完整控制：固定赚币活动"],
    [/With Kraken\+, monthly subscribers unlock zero-fee trading and boosted USDG rewards, for just \$4\.99 a month\./gi, "Kraken+ 月订阅用户可解锁零手续费交易和 USDG 加码奖励"],
    [/Take 2 minutes to learn more/gi, "花2分钟了解更多"],
    [/Earn more with Bonded Earn: Now live in the Kraken app and on Kraken web/gi, "Kraken 质押赚币上线应用端和网页端"],
    [/Giveaway/gi, "福利活动"],
    [/Win a Share of ([^!]+) in the ([^!]+)!?/gi, "参与 $2，瓜分 $1"],
    [/Win from ([^!]+)!?/gi, "赢取 $1 起奖励"],
    [/Summer Demo Trading Challenge/gi, "夏季模拟交易挑战赛"],
    [/Built for Good/gi, "为善而建"],
    [/Incubation Showcase/gi, "孵化项目展示"],
    [/Bybit launches/gi, "Bybit 上线"],
    [/Binance Alpha Trading Competition/gi, "币安 Alpha 交易竞赛"],
    [/Trading Competition/gi, "交易竞赛"],
    [/Trading Tournament/gi, "交易锦标赛"],
    [/Trade ([A-Z0-9]+) and Share/gi, "交易 $1，瓜分"],
    [/Trade to Share/gi, "交易瓜分"],
    [/Share Up to/gi, "瓜分最高"],
    [/Share/gi, "分享"],
    [/Rewards?/gi, "奖励"],
    [/Vouchers?/gi, "代金券"],
    [/Airdrop/gi, "空投"],
    [/\bEarn\b/gi, "理财"],
    [/APR/gi, "年化"],
    [/limited-time/gi, "限时"],
    [/boost event/gi, "加息活动"],
    [/launches/gi, "上线"],
    [/will launch/gi, "将上线"],
    [/to list/gi, "将上线"],
    [/for spot trading/gi, "现货交易"],
    [/futures/gi, "合约"],
    [/maintenance/gi, "维护"],
    [/suspending/gi, "暂停"],
    [/resuming/gi, "恢复"],
    [/network withdrawal service/gi, "网络提现服务"],
    [/announcement/gi, "公告"],
    [/Football Season/gi, "足球赛季活动"],
    [/Deposit/gi, "充值"],
    [/claim/gi, "领取"],
    [/guaranteed/gi, "保底"],
    [/real gold/gi, "实物黄金"]
  ];
  let output = text;
  for (const [pattern, replacement] of replacements) {
    output = output.replace(pattern, replacement);
  }
  if (output !== text && !hasUntranslatedEnglish(output)) return output;
  const tokens = tokensFromTitle(text).slice(0, 3).join(" / ");
  const prefix = context ? `${context} ` : "";
  return tokens ? `${prefix}${tokens} 相关活动公告` : `${prefix}活动公告`;
}

function hasUntranslatedEnglish(text) {
  const allowed = new Set([
    "Binance", "OKX", "Bybit", "Bitget", "KuCoin", "Gate", "MEXC", "HTX", "Coinbase", "Kraken",
    "Crypto", "Bitfinex", "BitMEX", "Deribit", "Bitstamp", "Gemini", "LBank", "BingX", "BitMart", "CoinEx",
    "CoinGecko", "DefiLlama", "CryptoPanic", "Etherscan", "Alchemy", "Moralis", "OpenAI", "Web3",
    "Launchpool", "DeFi", "Alpha", "ETH", "BTC", "SOL", "ARB", "UNI", "USDT", "USDC", "USD"
  ]);
  const words = String(text || "").match(/[A-Za-z][A-Za-z0-9_.-]*/g) || [];
  return words.filter((word) => !allowed.has(word) && !/^[A-Z0-9]{2,12}$/.test(word)).length >= 2;
}

function heuristicEnglishTranslation(text) {
  const replacements = [
    [/严重/g, "Critical"],
    [/高优先级/g, "High priority"],
    [/中优先级/g, "Medium priority"],
    [/关键词命中/g, "Keyword hit"],
    [/舆情告警/g, "Sentiment alert"],
    [/巨鲸金库/g, "whale treasury"],
    [/巨鲸/g, "Whale"],
    [/热钱包/g, "hot wallet"],
    [/大额转账/g, "large transfer"],
    [/大额兑换/g, "large swap"],
    [/协议总锁仓量异动/g, "protocol total value locked move"],
    [/协议指标异动/g, "protocol metric move"],
    [/社交热度异动/g, "social activity spike"],
    [/市场价格异动/g, "market price move"],
    [/安全信号/g, "security signal"],
    [/新闻/g, "news"],
    [/未知/g, "unknown"],
    [/事件规模约/g, "event size about"],
    [/资金路径：/g, "fund path: "],
    [/相对近期基线放大/g, "above recent baseline by"],
    [/倍/g, "x"],
    [/协议指标变化/g, "protocol metric changed"],
    [/需要和价格\/新闻交叉验证/g, "needs price/news cross-check"],
    [/命中关键词：/g, "matched keywords: "],
    [/综合置信\/优先级评分/g, "confidence/priority score"],
    [/金额较大/g, "large amount"],
    [/高于历史基线/g, "above historical baseline"],
    [/流向中心化交易所/g, "to centralized exchange"],
    [/社交热度较高/g, "elevated social activity"],
    [/负面舆情/g, "negative sentiment"],
    [/品牌词命中/g, "brand term hit"],
    [/规则评分达标/g, "rule score threshold met"],
    [/订阅关键词/g, "subscribed keywords"],
    [/公告/g, "announcement"],
    [/新币上线/g, "new listing"],
    [/上新 \/ 交易/g, "listings / trading"],
    [/活动 \/ 奖励/g, "activities / rewards"],
    [/活动/g, "campaign"],
    [/奖励/g, "rewards"],
    [/空投/g, "airdrop"],
    [/理财/g, "earn"],
    [/交易赛/g, "trading competition"],
    [/充值赛/g, "deposit campaign"],
    [/学习赚币/g, "learn and earn"],
    [/新手任务/g, "new user tasks"],
    [/手续费返佣/g, "fee rebate"],
    [/合约活动/g, "futures campaign"],
    [/合约与费率变更/g, "contracts and fee changes"],
    [/维护 \/ 升级/g, "maintenance / upgrades"],
    [/维护/g, "maintenance"],
    [/下架 \/ 移除/g, "delisting / removal"],
    [/下架/g, "delisting"],
    [/其他/g, "other"],
    [/已同步/g, "synced"],
    [/条/g, "items"],
    [/个/g, "records"],
    [/交易所/g, "exchange"],
    [/暂无新/g, "no new "],
    [/缺少/g, "missing"],
    [/已跳过/g, "skipped"],
    [/未配置/g, "not configured"],
    [/使用本地规则翻译/g, "using local rule translation"],
    [/翻译降级为本地规则/g, "translation fell back to local rules"],
    [/已使用/g, "used"],
    [/英文标题/g, "English titles"],
    [/收到/g, "received"],
    [/事件/g, "events"],
    [/模拟数据/g, "simulation data"],
    [/没有可映射资产/g, "no mappable assets"],
    [/已禁用/g, "disabled"],
    [/币圈意见领袖动态/g, "crypto KOL posts"],
    [/依赖/g, "depends on"],
    [/或/g, "or"],
    [/后会自动进入这里/g, "to appear here"],
    [/当前/g, "current"],
    [/分类/g, "category"]
  ];
  let output = String(text || "");
  for (const [pattern, replacement] of replacements) {
    output = output.replace(pattern, replacement);
  }
  if (isChineseText(output)) {
    const tokens = tokensFromTitle(text).slice(0, 3).join(" / ");
    return tokens ? `${tokens} external item pending translation` : "External item pending translation";
  }
  return output;
}

function localizeStoredText(text, language = currentLanguage()) {
  const value = String(text || "");
  if (!value) return value;
  if (/^(0x)?[0-9a-f]{4,}\.\.\.[0-9a-f]{2,}$/i.test(value) || /^0x[0-9a-f]{8,}$/i.test(value)) return value;
  if (language === "zh") {
    const normalized = normalizeChineseSurface(value);
    if (isChineseText(normalized) && !hasUntranslatedEnglish(normalized)) return normalized;
    return normalizeChineseSurface(heuristicChineseTranslation(value));
  }
  return isChineseText(value) ? heuristicEnglishTranslation(value) : value;
}

function normalizeChineseSurface(text) {
  return String(text || "")
    .replace(/\bDEX\b/g, "去中心化交易所")
    .replace(/\bTVL\b/g, "总锁仓量")
    .replace(/\bwebhooks?\b/gi, "回调")
    .replace(/\bSignal Journal\b/g, "信号日志")
    .replace(/\bLIVE\b/g, "实时")
    .replace(/\bAPI key\b/gi, "接口密钥")
    .replace(/\bJSON\b/g, "事件数据")
    .replace(/\bFUD\b/g, "负面舆情")
    .replace(/\bReward\b/g, "奖励")
    .replace(/\bRewards\b/g, "奖励")
    .replace(/\b24h\b/g, "24小时")
    .replace(/\bLiquid Staking\b/g, "流动性质押")
    .replace(/\bSystem\b/g, "系统")
    .replace(/\bDistribution\b/g, "分发");
}

async function fetchJson(url, options = {}) {
  const cacheMs = options.cacheMs || 0;
  const cacheKey = `json:${url}`;
  const cached = fetchCache.get(cacheKey);
  if (cacheMs && cached && Date.now() - cached.time < cacheMs) return cached.value;
  const timeoutMs = options.timeoutMs || 12000;
  const response = await fetchWithRetry(
    url,
    {
      ...options,
      headers: {
        accept: "application/json",
        "user-agent": "web3-info-monitor-agent/0.1",
        ...(options.headers || {})
      }
    },
    { timeoutMs, retries: options.retries ?? 2 }
  );
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const jsonBody = await response.json();
  if (cacheMs) fetchCache.set(cacheKey, { time: Date.now(), value: jsonBody });
  return jsonBody;
}

async function syncCoinGecko() {
  const assets = state.watchlist.assets.filter((asset) => coinIds[asset]);
  if (!assets.length) {
    connectorOk("coingecko", { message: "没有可映射资产" });
    return { source: "coingecko", count: 0 };
  }

  const ids = assets.map((asset) => coinIds[asset]).join(",");
  const base = process.env.COINGECKO_API_KEY ? "https://pro-api.coingecko.com/api/v3" : "https://api.coingecko.com/api/v3";
  const url = `${base}/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true`;
  const headers = process.env.COINGECKO_API_KEY ? { "x-cg-pro-api-key": process.env.COINGECKO_API_KEY } : {};
  try {
    const data = await fetchJson(url, { headers });
    let count = 0;
    for (const asset of assets) {
      const item = data[coinIds[asset]];
      if (!item) continue;
      const previous = market[asset]?.price || item.usd;
      const change24h = Number(item.usd_24h_change || 0);
      market[asset] = {
        price: Number(item.usd || previous),
        volume24h: Number(item.usd_24h_vol || market[asset]?.volume24h || 0),
        volatility1h: Math.min(Math.abs(change24h) / 100 / 12, 0.12)
      };
      if (Math.abs(change24h) >= 4) {
        await ingest({
          source: "coingecko",
          type: "market_move",
          asset,
          title: localText(`${asset} 24h 价格变化 ${change24h.toFixed(2)}%`, `${asset} 24h price changed ${change24h.toFixed(2)}%`),
          body: localText(
            `${asset} 最新价格 ${currency(item.usd)}，24h 成交量约 ${currency(item.usd_24h_vol || 0)}。`,
            `${asset} latest price is ${currency(item.usd)}. 24h volume is around ${currency(item.usd_24h_vol || 0)}.`
          ),
          amountUsd: Number(item.usd_24h_vol || 0),
          socialVelocity: Math.min(Math.abs(change24h) * 8, 100),
          fingerprint: `coingecko:${asset}:${Math.round(Date.now() / 900000)}`
        });
      }
      count += 1;
    }
    connectorOk("coingecko", { count, message: localText(`已同步 ${count} 个资产价格`, `Synced ${count} asset prices`) });
    return { source: "coingecko", count };
  } catch (error) {
    connectorFail("coingecko", error);
    return { source: "coingecko", count: 0, error: error.message };
  }
}

async function syncDefiLlama() {
  if (String(process.env.DEFILLAMA_ENABLED || "true").toLowerCase() === "false") {
    connectorOk("defillama", { message: "已禁用" });
    return { source: "defillama", count: 0 };
  }

  try {
    const protocols = await fetchJson("https://api.llama.fi/protocols");
    let count = 0;
    for (const name of state.watchlist.protocols) {
      const protocol = protocols.find((item) => item.name?.toLowerCase() === name.toLowerCase());
      if (!protocol) continue;
      const tvlChangePct = Number(protocol.change_1d || 0);
      if (Math.abs(tvlChangePct) >= 2.5) {
        await ingest({
          source: "defillama",
          type: "protocol_tvl_change",
          asset: protocol.symbol || "TVL",
          protocol: protocol.name,
          title: localText(
            `${protocol.name} 总锁仓量 24h 变化 ${tvlChangePct.toFixed(2)}%`,
            `${protocol.name} TVL changed ${tvlChangePct.toFixed(2)}% over 24h`
          ),
          body: localText(
            `${protocol.name} 当前总锁仓量约 ${currency(Number(protocol.tvl || 0))}，分类 ${protocol.category || "未知"}。`,
            `${protocol.name} TVL is around ${currency(Number(protocol.tvl || 0))}. Category: ${protocol.category || "unknown"}.`
          ),
          amountUsd: Number(protocol.tvl || 0),
          tvlChangePct,
          url: `https://defillama.com/protocol/${protocol.slug}`,
          fingerprint: `defillama:${protocol.slug}:${new Date().toISOString().slice(0, 13)}`
        });
      }
      count += 1;
    }
    connectorOk("defillama", { count, message: localText(`已同步 ${count} 个协议总锁仓量记录`, `Synced ${count} protocol TVL records`) });
    return { source: "defillama", count };
  } catch (error) {
    connectorFail("defillama", error);
    return { source: "defillama", count: 0, error: error.message };
  }
}

async function syncUnlockCalendar() {
  const urls = process.env.DEFILLAMA_API_KEY
    ? [`https://pro-api.llama.fi/${process.env.DEFILLAMA_API_KEY}/api/emissions`]
    : ["https://api.llama.fi/emissions", "https://api.llama.fi/api/emissions"];
  for (const url of urls) {
    try {
      const data = await fetchJson(url, { cacheMs: 30 * 60 * 1000, timeoutMs: 10000, retries: 1 });
      const events = normalizeUnlockPayload(data);
      state.unlockEvents = events;
      for (const event of events.filter((item) => item.isLarge).slice(0, 12)) {
        await ingest({
          source: "defillama_unlocks",
          type: "news",
          asset: event.symbol || event.token || "UNLOCK",
          title: `${event.project} 即将发生大额代币解锁`,
          body: `${event.unlockDate} 预计解锁 ${currency(event.valueUsd || 0)}，占供应量 ${event.percentOfSupply ? `${event.percentOfSupply.toFixed(2)}%` : "未知"}。`,
          amountUsd: event.valueUsd || 0,
          url: event.url,
          observedAt: nowIso(),
          fingerprint: `unlock:${event.project}:${event.unlockDate}:${event.category}`
        });
      }
      connectorOk("unlocks", { count: events.length, message: events.length ? `已同步 ${events.length} 条解锁事件` : "暂无未来解锁数据" });
      await saveState();
      return { source: "defillama_unlocks", count: events.length };
    } catch (error) {
      connectorFail("unlocks", error);
    }
  }
  await saveState();
  return { source: "defillama_unlocks", count: (state.unlockEvents || []).length, error: "暂无数据" };
}

function normalizeUnlockPayload(data) {
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.protocols)
      ? data.protocols
      : Array.isArray(data?.emissions)
        ? data.emissions
        : Array.isArray(data?.data)
          ? data.data
          : [];
  const watch = new Set(state.watchlist.assets.map((asset) => asset.toUpperCase()));
  const now = Date.now();
  const until = now + 30 * 24 * 60 * 60 * 1000;
  const events = [];
  for (const row of rows) {
    const schedules = Array.isArray(row.events) ? row.events : Array.isArray(row.unlocks) ? row.unlocks : Array.isArray(row.schedule) ? row.schedule : [row];
    for (const item of schedules) {
      const dateValue = item.unlockDateIso || item.unlockDate || item.date || item.timestamp || item.time || item.end || item.start;
      const time = typeof dateValue === "number" ? (dateValue > 1e12 ? dateValue : dateValue * 1000) : Date.parse(dateValue || "");
      if (!Number.isFinite(time) || time < now || time > until) continue;
      const symbol = String(item.symbol || row.symbol || row.tokenSymbol || row.name || "").toUpperCase();
      if (watch.size && symbol && !watch.has(symbol) && events.length > 80) continue;
      const valueUsd = Number(item.valueUsd || item.unlockValueUsd || item.usdValue || item.amountUsd || item.value || 0);
      const percentOfSupply = Number(item.percentOfSupply || item.pctOfSupply || item.pctOfMaxSupply || item.unlockPercent || 0);
      events.push({
        id: `unlock:${row.slug || row.name || symbol}:${new Date(time).toISOString()}:${item.category || item.type || ""}`,
        project: row.name || item.project || item.name || symbol || "Unknown",
        slug: row.slug || item.slug || "",
        symbol,
        token: item.token || row.token || symbol,
        unlockDate: new Date(time).toISOString(),
        category: item.category || item.type || item.unlockType || "解锁",
        tokensUnlocked: Number(item.tokensUnlocked || item.amount || item.unlockAmount || 0),
        valueUsd,
        percentOfSupply,
        isLarge: valueUsd >= 10_000_000 || percentOfSupply >= 1,
        url: `https://defillama.com/unlocks/${row.slug || item.slug || ""}`
      });
    }
  }
  return events.sort((a, b) => new Date(a.unlockDate) - new Date(b.unlockDate)).slice(0, 100);
}

async function syncCryptoPanic() {
  if (!process.env.CRYPTOPANIC_API_KEY) {
    connectorOk("cryptopanic", { message: "缺少 CRYPTOPANIC_API_KEY，已跳过真实新闻源" });
    return { source: "cryptopanic", count: 0, skipped: true };
  }

  const currencies = state.watchlist.assets.slice(0, 8).join(",");
  const url = `https://cryptopanic.com/api/v1/posts/?auth_token=${encodeURIComponent(process.env.CRYPTOPANIC_API_KEY)}&public=true&currencies=${encodeURIComponent(currencies)}`;
  try {
    const data = await fetchJson(url);
    const posts = Array.isArray(data.results) ? data.results.slice(0, 20) : [];
    let count = 0;
    for (const post of posts) {
      const title = post.title || "";
      const asset = extractAssetFromText(title) || post.currencies?.[0]?.code || state.watchlist.assets[0] || "BTC";
      await ingest({
        source: "cryptopanic",
        type: "news",
        asset,
        title: currentLanguage() === "zh" ? await titleForLanguage(title, "zh", "CryptoPanic") : title,
        body: post.domain || post.source?.title || "",
        url: post.url || post.slug,
        socialVelocity: Number(post.votes?.important || 0) * 12 + Number(post.votes?.positive || 0) * 5,
        observedAt: post.published_at,
        fingerprint: `cryptopanic:${post.id || post.url || title}`
      });
      count += 1;
    }
    connectorOk("cryptopanic", { count, message: localText(`已同步 ${count} 条新闻`, `Synced ${count} news items`) });
    return { source: "cryptopanic", count };
  } catch (error) {
    connectorFail("cryptopanic", error);
    return { source: "cryptopanic", count: 0, error: error.message };
  }
}

async function syncWeb3News() {
  const feeds = [
    { source: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
    { source: "Cointelegraph", url: "https://cointelegraph.com/rss" },
    { source: "Decrypt", url: "https://decrypt.co/feed" }
  ];
  const results = await Promise.allSettled(feeds.map((feed) => fetchWeb3NewsFeed(feed)));
  const items = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  const sorted = items
    .sort((a, b) => b.importance - a.importance || new Date(b.observedAt || 0) - new Date(a.observedAt || 0))
    .slice(0, 20);
  let count = 0;
  for (const item of sorted) {
    const fingerprint = eventFingerprint(item);
    const existing = state.normalizedEvents.find((event) => event.fingerprint === fingerprint || (item.url && event.url === item.url));
    if (existing) {
      Object.assign(existing, {
        fingerprint,
        title: item.title,
        body: item.body,
        url: item.url,
        observedAt: item.observedAt,
        source: item.source,
        asset: item.asset
      });
      persistEvent(existing);
    } else {
      const ingested = await ingest(item);
      if (!ingested.duplicate) count += 1;
    }
  }
  connectorOk("web3news", { count: sorted.length, message: `已同步 ${sorted.length} 条 Web3 大事件` });
  return { source: "web3_news", count: sorted.length, inserted: count };
}

async function fetchWeb3NewsFeed(feed) {
  try {
    const xml = await fetchText(feed.url, { cacheMs: 5 * 60 * 1000, timeoutMs: 10000 });
    return await Promise.all(
      parseRssItems(xml)
        .map((item) => ({
          ...item,
          source: feed.source,
          importance: web3NewsImportance(`${item.title} ${item.description}`)
        }))
        .filter((item) => item.title && item.link)
        .sort((a, b) => b.importance - a.importance || new Date(b.pubDate || 0) - new Date(a.pubDate || 0))
        .slice(0, 12)
        .map(async (item) => {
          const title = await chineseNewsTitle(item.title, item.source, item.description, item.link);
          const body = summarizeNewsBody(item.description, item.source);
          const asset = extractAssetFromText(item.title) || extractAssetFromText(item.description) || "WEB3";
          return {
            source: "web3_news",
            type: "news",
            asset,
            title,
            body,
            url: item.link,
            observedAt: normalizeNewsDate(item.pubDate),
            socialVelocity: Math.min(100, 35 + item.importance * 8),
            fingerprint: `web3news:${item.link || item.guid || item.title}`
          };
        })
    );
  } catch (error) {
    connectorFail(`web3news:${feed.source}`, error);
    return [];
  }
}

async function chineseNewsTitle(title, source, description = "", url = "") {
  if (isChineseText(title) && !hasUntranslatedEnglish(title)) return normalizeChineseSurface(title);
  const text = `${title} ${description} ${url}`.toLowerCase();
  if (text.includes("barstool") || text.includes("portnoy")) return "Barstool 创始人 Portnoy 表示将长期持有比特币";
  if (text.includes("vitalik") && text.includes("lean") && text.includes("ethereum")) return "Vitalik Buterin 分享 Lean Ethereum 路线图优先事项";
  const patterns = [
    [/binance.*outflows.*eth.*withdrawals/, "币安出现大额 ETH 流出，提现规模创阶段新高"],
    [/barstool.*portnoy.*hold.*bitcoin.*zero/, "Barstool 创始人 Portnoy 表示将长期持有比特币"],
    [/what-happened-in-crypto-today/, "今日加密市场要闻汇总"],
    [/vitalik.*lean.*ethereum.*roadmap/, "Vitalik Buterin 分享 Lean Ethereum 路线图优先事项"],
    [/kraken.*tokenized-stocks.*collateral.*leveraged/, "Kraken 支持使用代币化股票作为杠杆交易抵押品"],
    [/bitcoin.*jumps.*63.*000/, "比特币突破 63,000 美元并收复近期跌幅"],
    [/freeze.*satoshi.*bitcoin.*quantum/, "量子威胁升温，中本聪比特币是否冻结引发争议"],
    [/ethical-hackers.*flaw.*70-billion/, "白帽黑客发现可能危及 700 亿美元加密资产的漏洞"],
    [/sec|cftc|regulation|lawsuit/, "加密监管与诉讼出现重要进展"],
    [/hack|exploit|breach|stolen/, "Web3 安全事件出现新进展"],
    [/bitcoin|btc/, "比特币市场出现重要动态"],
    [/ethereum|vitalik|eth/, "以太坊生态出现重要动态"],
    [/stablecoin|usdt|usdc/, "稳定币市场出现重要动态"],
    [/exchange|binance|coinbase|kraken|okx|bybit/, "交易所业务出现重要动态"],
    [/funding|raises|acquisition|ipo/, "Web3 融资或资本市场出现重要动态"]
  ];
  const hit = patterns.find(([pattern]) => pattern.test(text));
  if (hit) return hit[1];
  const translated = await titleForLanguage(title, "zh", source);
  if (translated && !/活动公告$/.test(translated) && !hasUntranslatedEnglish(translated)) return translated;
  const tokens = tokensFromTitle(`${title} ${description}`).slice(0, 3).join(" / ");
  return tokens ? `${tokens} 相关 Web3 大事件` : `${source} Web3 大事件`;
}

function parseRssItems(xml) {
  const items = [];
  const itemBlocks = String(xml || "").match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const block of itemBlocks) {
    items.push({
      title: decodeXmlText(xmlTag(block, "title")),
      link: decodeXmlText(xmlTag(block, "link")),
      guid: decodeXmlText(xmlTag(block, "guid")),
      pubDate: decodeXmlText(xmlTag(block, "pubDate") || xmlTag(block, "dc:date")),
      description: stripHtml(decodeXmlText(xmlTag(block, "description") || xmlTag(block, "content:encoded")))
    });
  }
  return items;
}

function xmlTag(block, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(block || "").match(new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i"));
  return match ? match[1].replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim() : "";
}

function decodeXmlText(text) {
  return String(text || "")
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripHtml(text) {
  return String(text || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function summarizeNewsBody(description, source) {
  const clean = localizeStoredText(description, "zh");
  if (clean && isChineseText(clean) && clean.length <= 160 && !/活动公告$/.test(clean)) return `${source}：${clean}`;
  return `${source} 新闻，已归入今日 Web3 大事件。`;
}

function normalizeNewsDate(value) {
  const parsed = Date.parse(value || "");
  return Number.isNaN(parsed) ? nowIso() : new Date(parsed).toISOString();
}

function web3NewsImportance(text) {
  const lower = String(text || "").toLowerCase();
  let score = 1;
  if (/(sec|cftc|lawsuit|etf|fed|interest rate|regulation|监管|诉讼|批准|政策)/.test(lower)) score += 5;
  if (/(hack|exploit|security|breach|stolen|攻击|漏洞|被盗|安全)/.test(lower)) score += 5;
  if (/(bitcoin|ethereum|btc|eth|solana|stablecoin|usdt|usdc)/.test(lower)) score += 3;
  if (/(exchange|binance|coinbase|okx|bybit|上市|交易所)/.test(lower)) score += 2;
  if (/(funding|raises|acquisition|ipo|merger|融资|收购|上市)/.test(lower)) score += 2;
  if (/(airdrop|token launch|mainnet|upgrade|空投|主网|升级)/.test(lower)) score += 2;
  return score;
}

async function syncXKolPosts() {
  if (!process.env.X_BEARER_TOKEN) {
    connectorOk("x", {
      message: localText("缺少 X_BEARER_TOKEN，已跳过币圈意见领袖动态", "Missing X_BEARER_TOKEN; skipped crypto KOL posts")
    });
    return { source: "x", count: 0, skipped: true };
  }

  const handles = (state.watchlist.kols || []).map((handle) => handle.replace(/^@/, "")).filter(Boolean).slice(0, 12);
  if (!handles.length) return { source: "x", count: 0 };

  const fromQuery = handles.map((handle) => `from:${handle}`).join(" OR ");
  const assetQuery = state.watchlist.assets.slice(0, 8).join(" OR ");
  const keywordQuery = state.watchlist.keywords.slice(0, 8).join(" OR ");
  const query = `(${fromQuery}) (${assetQuery} OR ${keywordQuery} OR crypto OR bitcoin OR ethereum) -is:retweet`;
  const params = new URLSearchParams({
    query,
    max_results: "25",
    "tweet.fields": "created_at,author_id,public_metrics,lang",
    expansions: "author_id",
    "user.fields": "username,name,verified"
  });

  try {
    const data = await fetchJson(`https://api.x.com/2/tweets/search/recent?${params.toString()}`, {
      headers: { authorization: `Bearer ${process.env.X_BEARER_TOKEN}` }
    });
    const users = new Map((data.includes?.users || []).map((user) => [user.id, user]));
    let count = 0;
    for (const post of data.data || []) {
      const author = users.get(post.author_id);
      const title = post.text.split("\n").find(Boolean)?.slice(0, 160) || post.text.slice(0, 160);
      const asset = extractAssetFromText(post.text) || state.watchlist.assets[0] || "BTC";
      const metrics = post.public_metrics || {};
      const socialVelocity =
        Number(metrics.like_count || 0) * 0.2 +
        Number(metrics.retweet_count || 0) * 0.8 +
        Number(metrics.reply_count || 0) * 0.4 +
        Number(metrics.quote_count || 0) * 0.6;
      await ingest({
        source: "x_kol",
        type: "social_spike",
        asset,
        author: author?.username || post.author_id,
        title: currentLanguage() === "zh" ? await titleForLanguage(title, "zh", `X @${author?.username || post.author_id}`) : title,
        body: post.text,
        url: author?.username ? `https://x.com/${author.username}/status/${post.id}` : `https://x.com/i/web/status/${post.id}`,
        socialVelocity: Math.min(socialVelocity, 100),
        observedAt: post.created_at,
        fingerprint: `x:${post.id}`
      });
      count += 1;
    }
    connectorOk("x", { count, message: localText(`已同步 ${count} 条币圈意见领袖动态`, `Synced ${count} crypto KOL posts`) });
    return { source: "x", count };
  } catch (error) {
    connectorFail("x", error);
    return { source: "x", count: 0, error: error.message };
  }
}

async function syncWhaleTransfers() {
  if (!process.env.ETHERSCAN_API_KEY) {
    connectorOk("etherscan", {
      message: localText("缺少 ETHERSCAN_API_KEY，巨鲸转账依赖 Alchemy/Moralis 回调或模拟数据", "Missing ETHERSCAN_API_KEY; whale transfers rely on webhooks or simulation")
    });
    return { source: "etherscan", count: 0, skipped: true };
  }

  const thresholdUsd = Number(process.env.WHALE_TRANSFER_USD_THRESHOLD || 1_000_000);
  let count = 0;
  for (const wallet of state.watchlist.wallets.slice(0, 8)) {
    const params = new URLSearchParams({
      chainid: "1",
      module: "account",
      action: "txlist",
      address: wallet.address,
      page: "1",
      offset: "20",
      sort: "desc",
      apikey: process.env.ETHERSCAN_API_KEY
    });
    try {
      const data = await fetchJson(`https://api.etherscan.io/v2/api?${params.toString()}`);
      for (const tx of data.result || []) {
        const amount = Number(tx.value || 0) / 1e18;
        const amountUsd = amount * (market.ETH?.price || 0);
        if (amountUsd < thresholdUsd) continue;
        await ingest({
          source: "etherscan",
          type: "large_transfer",
          chain: "ethereum",
          asset: "ETH",
          amount,
          amountUsd,
          from: tx.from,
          to: tx.to,
          txHash: tx.hash,
          title: localText(`巨鲸 ETH 转账 ${currency(amountUsd)}`, `Whale ETH transfer ${currency(amountUsd)}`),
          url: `https://etherscan.io/tx/${tx.hash}`,
          observedAt: new Date(Number(tx.timeStamp || Date.now() / 1000) * 1000).toISOString(),
          fingerprint: `etherscan:${tx.hash}:${tx.from}:${tx.to}`
        });
        count += 1;
      }
    } catch (error) {
      connectorFail("etherscan", error);
    }
  }
  connectorOk("etherscan", { count, message: localText(`已同步 ${count} 条巨鲸转账`, `Synced ${count} whale transfers`) });
  return { source: "etherscan", count };
}

function extractAssetFromText(text) {
  const upper = String(text || "").toUpperCase();
  return state.watchlist.assets.find((asset) => upper.includes(asset));
}

async function getAssetPrice(asset) {
  const symbol = String(asset || "").toUpperCase();
  const id = coinIds[symbol];
  if (!id) return market[symbol]?.price || 0;
  try {
    const base = process.env.COINGECKO_API_KEY ? "https://pro-api.coingecko.com/api/v3" : "https://api.coingecko.com/api/v3";
    const headers = process.env.COINGECKO_API_KEY ? { "x-cg-pro-api-key": process.env.COINGECKO_API_KEY } : {};
    const data = await fetchJson(`${base}/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd`, { headers, timeoutMs: 8000 });
    const price = Number(data?.[id]?.usd || 0);
    if (price) {
      market[symbol] = { ...(market[symbol] || {}), price };
      return price;
    }
  } catch {
    // Fall back to last known price; journal entries should still be created in offline demos.
  }
  return market[symbol]?.price || 0;
}

async function dailyReport(language = currentLanguage()) {
  await syncCoinGecko();
  const btc = market.BTC || {};
  const eth = market.ETH || {};
  const isEn = language === "en";
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const recentAnnouncements = localizedExchangeAnnouncements(language).filter((item) => new Date(item.publishedAt || 0).getTime() >= since);
  const byCategory = new Map();
  for (const item of recentAnnouncements) {
    const key = item.opsCategory || item.category || (isEn ? "Other" : "其他");
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key).push(item);
  }
  const whales = whaleTransfers()
    .filter((item) => new Date(item.observedAt || 0).getTime() >= since)
    .slice(0, 5)
    .map((item) => localizeEventRecord(item, language));
  const important = recentAnnouncements
    .filter((item) => ["listing", "campaign"].includes(item.opsCategoryId))
    .slice(0, 8)
    .map((item) => `- ${item.exchange}: ${item.title}`)
    .join("\n") || (isEn ? "- No major listings or campaigns in the last 24 hours." : "- 过去24小时暂无重点新币或活动。");
  const categories = [...byCategory.entries()]
    .map(([category, rows]) => `### ${category}\n${rows.slice(0, 6).map((item) => `- ${item.exchange}: ${item.title}`).join("\n")}`)
    .join("\n\n") || (isEn ? "### None\n- No announcements in the last 24 hours." : "### 暂无\n- 过去24小时暂无公告。");
  const whaleBlock = whales.length
    ? whales.map((item) => `- ${item.asset} ${currency(item.amountUsd)}: ${item.fromLabel || "-"} -> ${item.toLabel || "-"} (${item.source})`).join("\n")
    : isEn ? "- No notable large on-chain moves." : "- 暂无显著大额链上异动。";
  const criticalRegulations = state.alerts
    .filter((alert) => alert.severity === "critical" && alert.event?.opsCategoryId === "regulation")
    .slice(0, 5)
    .map((alert) => `- ${alert.title}: ${alert.summary}`)
    .join("\n") || "- 暂无高危监管动态。";
  const benchmarkBlock = benchmarkReminders(language).join("\n") || `- 暂无明显对标缺口。当前我所：${exchangeName(myExchangeId())}。`;
  const unlockBlock = (state.unlockEvents || [])
    .filter((item) => item.isLarge)
    .slice(0, 5)
    .map((item) => `- ${item.project} ${item.symbol || ""}: ${new Date(item.unlockDate).toLocaleDateString("zh-CN")} 解锁约 ${currency(item.valueUsd || 0)}。`)
    .join("\n") || "- 暂无未来30天大额解锁数据。";
  let report = isEn
    ? `# Web3 Ops Daily Brief\n\nGenerated at: ${new Date().toLocaleString("en-US")}\n\n## 1. Market Overview\n\n- BTC: ${currency(btc.price || 0)}\n- ETH: ${currency(eth.price || 0)}\n\n## 2. Key Exchange Updates\n\n${important}\n\n${categories}\n\n## 3. Large On-chain Moves\n\n${whaleBlock}\n\n## 4. Watchlist for Today\n\n- Prioritize listing and campaign changes across major exchanges, then prepare content, activity, and support talking points.\n- Manually verify announcements that match subscribed keywords before publishing.\n- Data is for operations research only and does not constitute investment advice.\n`
    : `# Web3 Ops 运营晨报\n\n生成时间：${new Date().toLocaleString("zh-CN")}\n\n## ① 市场概况\n\n- BTC: ${currency(btc.price || 0)}\n- ETH: ${currency(eth.price || 0)}\n\n## ② 高危监管动态\n\n${criticalRegulations}\n\n## ③ 20所重点动态\n\n${important}\n\n${categories}\n\n## ④ 对标提醒\n\n${benchmarkBlock}\n\n## ⑤ 大额链上异动\n\n${whaleBlock}\n\n## ⑥ 解锁日历关注\n\n${unlockBlock}\n\n## ⑦ 今日关注建议\n\n- 优先跟进20所新币上线与活动节奏，确认自家是否需要同步内容、活动或客服话术。\n- 对命中关键词和监管高危词的公告做二次人工核验，避免误读活动规则。\n- 数据仅供运营研究，不构成投资建议。\n`;
  const usedAi = Boolean(process.env.OPENAI_API_KEY);
  if (usedAi) {
    report = await polishDailyReport(report, language);
  }
  return { report, generatedAt: nowIso(), language, usedAi };
}

async function weeklyReport(language = currentLanguage()) {
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const isEn = language === "en";
  const announcements = localizedExchangeAnnouncements(language).filter((item) => new Date(item.publishedAt || 0).getTime() >= since);
  const campaigns = getCampaigns(language).filter((item) => new Date(item.publishedAt || 0).getTime() >= since);
  const race = listingRace(language).filter((item) => new Date(item.firstAt || 0).getTime() >= since);
  const byExchange = exchangeSources
    .map((source) => {
      const rows = announcements.filter((item) => item.exchangeId === source.id);
      const listingCount = rows.filter((item) => item.opsCategoryId === "listing").length;
      const campaignCount = rows.filter((item) => item.opsCategoryId === "campaign").length;
      return isEn ? `- ${source.name}: listings ${listingCount}, campaigns ${campaignCount}` : `- ${source.name}: 上币 ${listingCount}，活动 ${campaignCount}`;
    })
    .join("\n");
  const winners = race.reduce((map, item) => {
    map[item.firstExchange] = (map[item.firstExchange] || 0) + 1;
    return map;
  }, {});
  const winnerText = Object.entries(winners).map(([name, count]) => `- ${name}: ${count}`).join("\n") || (isEn ? "- No listing race data." : "- 暂无可统计上币竞速。");
  const report = isEn
    ? `# Web3 Ops Weekly Report\n\n## Exchange Activity\n\n${byExchange}\n\n## Campaigns\n\n- Structured campaigns: ${campaigns.length}\n\n## Listing Race Winners\n\n${winnerText}\n\nData is for operations research only and does not constitute investment advice.\n`
    : `# Web3 Ops 运营周报\n\n## 各所动态\n\n${byExchange}\n\n## 活动沉淀\n\n- 结构化活动数：${campaigns.length}\n\n## 上币竞速胜负\n\n${winnerText}\n\n数据仅供运营研究，不构成投资建议。\n`;
  return { report, generatedAt: nowIso(), language };
}

async function polishDailyReport(markdown, language) {
  if (!rateLimit({ socket: { remoteAddress: "daily-report" } }, "daily-report", 5, 60 * 60 * 1000)) return markdown;
  try {
    const response = await fetchWithRetry("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_REPORT_MODEL || "gpt-5.4-nano",
        store: false,
        instructions: `Polish this Web3 exchange operations daily brief in ${language === "en" ? "English" : "Simplified Chinese"}. Keep all facts, numbers, links and markdown structure. Do not add investment advice.`,
        input: markdown
      })
    }, { timeoutMs: 15000, retries: 1 });
    if (!response.ok) throw new Error(`OpenAI report ${response.status} ${response.statusText}`);
    const data = await response.json();
    if (data.usage) {
      state.metrics.aiInputTokens += Number(data.usage.input_tokens || 0);
      state.metrics.aiOutputTokens += Number(data.usage.output_tokens || 0);
    }
    return extractResponseText(data) || markdown;
  } catch (error) {
    connectorFail("dailyReport", error);
    return markdown;
  }
}

function signalDirection(event) {
  const text = `${event.title || ""} ${event.body || ""} ${event.keywordHits?.join(" ") || ""}`.toLowerCase();
  if (event.type === "large_transfer") {
    if (exchangeAddresses.has(String(event.to || "").toLowerCase())) return "bearish";
    if (exchangeAddresses.has(String(event.from || "").toLowerCase())) return "bullish";
    return "neutral";
  }
  if (event.type === "protocol_tvl_change") {
    if (event.metrics?.tvlChangePct > 0) return "bullish";
    if (event.metrics?.tvlChangePct < 0) return "bearish";
  }
  if (event.type === "market_move") {
    if (text.includes("-")) return "bearish";
    return "bullish";
  }
  if (/(exploit|hack|suspicious|unlock|下架|暂停|攻击|漏洞|解锁|可疑)/.test(text)) return "bearish";
  if (/(airdrop|reward|listing|launch|earn|奖励|空投|上线|活动|瓜分)/.test(text)) return "bullish";
  return "neutral";
}

async function createJournalEntry(alert) {
  const event = alert.event || {};
  const entryPrice = await getAssetPrice(event.asset);
  const entry = {
    id: id("sig"),
    alertId: alert.id,
    eventId: event.id,
    createdAt: alert.createdAt || nowIso(),
    asset: event.asset || "",
    signalType: event.type || "unknown",
    direction: signalDirection(event),
    entryPrice,
    score: alert.score,
    reasons: alert.reasons || [],
    price1h: null,
    return1h: null,
    outcome1h: null,
    price24h: null,
    return24h: null,
    outcome24h: null,
    price7d: null,
    return7d: null,
    outcome7d: null
  };
  persistSignal(entry);
}

function persistSignal(entry) {
  const json = JSON.stringify(entry);
  db.prepare(
    `INSERT OR IGNORE INTO signals (
      id, alert_id, event_id, created_at, asset, signal_type, direction, entry_price, score, reasons,
      price_1h, return_1h, outcome_1h, price_24h, return_24h, outcome_24h, price_7d, return_7d, outcome_7d, json
    ) VALUES (
      @id, @alertId, @eventId, @createdAt, @asset, @signalType, @direction, @entryPrice, @score, @reasons,
      @price1h, @return1h, @outcome1h, @price24h, @return24h, @outcome24h, @price7d, @return7d, @outcome7d, @json
    )`
  ).run({ ...entry, reasons: JSON.stringify(entry.reasons || []), json });
}

function signalFromRow(row) {
  if (!row) return null;
  const json = JSON.parse(row.json);
  return {
    ...json,
    price1h: row.price_1h,
    return1h: row.return_1h,
    outcome1h: row.outcome_1h,
    price24h: row.price_24h,
    return24h: row.return_24h,
    outcome24h: row.outcome_24h,
    price7d: row.price_7d,
    return7d: row.return_7d,
    outcome7d: row.outcome_7d
  };
}

function classifyOutcome(direction, returnPct) {
  if (direction === "neutral" || returnPct == null || !Number.isFinite(returnPct)) return "neutral";
  if (Math.abs(returnPct) < 0.5) return "neutral";
  if (direction === "bullish") return returnPct > 0 ? "hit" : "miss";
  if (direction === "bearish") return returnPct < 0 ? "hit" : "miss";
  return "neutral";
}

async function updateJournalOutcomes() {
  const rows = db
    .prepare(
      `SELECT * FROM signals
       WHERE (price_1h IS NULL OR price_24h IS NULL OR price_7d IS NULL)
       ORDER BY created_at DESC LIMIT 200`
    )
    .all();
  const now = Date.now();
  for (const row of rows) {
    const entry = signalFromRow(row);
    const ageMs = now - new Date(entry.createdAt).getTime();
    const patch = {};
    const price = await getAssetPrice(entry.asset);
    for (const horizon of [
      ["1h", 60 * 60 * 1000],
      ["24h", 24 * 60 * 60 * 1000],
      ["7d", 7 * 24 * 60 * 60 * 1000]
    ]) {
      const [key, dueMs] = horizon;
      const priceKey = `price${key}`;
      if (ageMs < dueMs || entry[priceKey] != null || !entry.entryPrice || !price) continue;
      const returnPct = ((price - entry.entryPrice) / entry.entryPrice) * 100;
      patch[key] = { price, returnPct, outcome: classifyOutcome(entry.direction, returnPct) };
    }
    if (!Object.keys(patch).length) continue;
    const merged = {
      ...entry,
      ...(patch["1h"] ? { price1h: patch["1h"].price, return1h: patch["1h"].returnPct, outcome1h: patch["1h"].outcome } : {}),
      ...(patch["24h"] ? { price24h: patch["24h"].price, return24h: patch["24h"].returnPct, outcome24h: patch["24h"].outcome } : {}),
      ...(patch["7d"] ? { price7d: patch["7d"].price, return7d: patch["7d"].returnPct, outcome7d: patch["7d"].outcome } : {})
    };
    db.prepare(
      `UPDATE signals SET
        price_1h = @price1h, return_1h = @return1h, outcome_1h = @outcome1h,
        price_24h = @price24h, return_24h = @return24h, outcome_24h = @outcome24h,
        price_7d = @price7d, return_7d = @return7d, outcome_7d = @outcome7d,
        json = @json
       WHERE id = @id`
    ).run({ ...merged, json: JSON.stringify(merged) });
  }
}

function getJournal() {
  return db.prepare("SELECT * FROM signals ORDER BY created_at DESC LIMIT 1000").all().map(signalFromRow);
}

function journalStats(entries = getJournal()) {
  const completed = entries.filter((entry) => entry.outcome24h && entry.outcome24h !== "neutral");
  const hits = completed.filter((entry) => entry.outcome24h === "hit").length;
  const averageReturn =
    completed.reduce((sum, entry) => sum + Number(entry.return24h || 0) * (entry.direction === "bearish" ? -1 : 1), 0) /
    Math.max(completed.length, 1);
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
        averageReturn:
          done.reduce((sum, entry) => sum + Number(entry.return24h || 0) * (entry.direction === "bearish" ? -1 : 1), 0) /
          Math.max(done.length, 1)
      };
    });
  };
  return {
    total: entries.length,
    evaluated: completed.length,
    hits,
    hitRate: completed.length ? hits / completed.length : 0,
    averageReturn,
    bySignalType: group("signalType"),
    byAsset: group("asset")
  };
}

function evaluate(event) {
  if (event.opsCategoryId === "regulation" && event.regulationHighRisk) {
    const displayTitle = regulationDisplayTitle(`${event.title || ""} ${event.body || ""}`, event.regulationRegion || "OTHER", event.asset || "Web3");
    return {
      id: id("alert"),
      eventId: event.id,
      severity: "critical",
      score: 0.96,
      title: `严重: ${displayTitle}`,
      summary: `${displayTitle} 命中高危监管词，需要运营、法务和客服口径优先核验。`,
      reasons: ["监管动态", "高危词命中", event.regulationRegion || "OTHER"],
      sources: [event.source, event.url].filter(Boolean),
      createdAt: nowIso(),
      status: "open",
      event
    };
  }

  const financialImpact = clamp(Math.log10(Math.max(event.amountUsd, 1)) / 8);
  const anomalyScore = clamp(Math.log10(Math.max(event.metrics.anomalyMultiple, 1)) / 2);
  const sourceScore = event.metrics.reliability;
  const socialVelocity = clamp(event.metrics.socialVelocity / 100);
  const keywordScore = clamp(event.keywordHits.length * 0.18);
  const protocolMove = clamp(Math.abs(event.metrics.tvlChangePct) / 12);
  const exchangeRisk = exchangeAddresses.has(String(event.to || "").toLowerCase()) ? 0.18 : 0;
  const sentimentRisk = event.sentiment === "negative" && event.metrics.socialVelocity >= 50 ? 0.22 : 0;
  const typeBoost = {
    large_transfer: 0.08,
    dex_swap: 0.06,
    protocol_tvl_change: 0.08,
    social_spike: 0.04,
    news: 0.03
  }[event.type] || 0;

  const score = clamp(
    sourceScore * 0.24 +
      financialImpact * 0.25 +
      anomalyScore * 0.2 +
      Math.max(socialVelocity, keywordScore, protocolMove) * 0.2 +
      exchangeRisk +
      sentimentRisk +
      typeBoost
  );

  const severity = score >= 0.78 ? "critical" : score >= 0.62 ? "high" : score >= 0.45 ? "medium" : "low";
  if (score < 0.45) return null;

  return {
    id: id("alert"),
    eventId: event.id,
    severity,
    score: Number(score.toFixed(3)),
    title: alertTitle(event, severity),
    summary: analystSummary(event, score),
    reasons: reasonsFor(event),
    sources: [event.source, event.url].filter(Boolean),
    createdAt: nowIso(),
    status: "open",
    event
  };
}

function alertTitle(event, severity, language = currentLanguage()) {
  const zh = language === "zh";
  const prefix = zh
    ? severity === "critical" ? "严重" : severity === "high" ? "高优先级" : "中优先级"
    : severity === "critical" ? "Critical" : severity === "high" ? "High priority" : "Medium priority";
  if (event.type === "social_spike" && event.sentiment === "negative") {
    return `${prefix}: ${zh ? "舆情告警" : "sentiment alert"} ${event.brandHits?.join(", ") || event.asset}`;
  }
  if (event.type === "large_transfer") {
    return `${prefix}: ${event.asset} ${currency(event.amountUsd)} ${zh ? "大额转账" : "large transfer"}`;
  }
  if (event.type === "protocol_tvl_change") {
    return `${prefix}: ${event.protocol || (zh ? "协议" : "protocol")} ${zh ? "总锁仓量变化" : "total value locked changed"} ${event.metrics.tvlChangePct.toFixed(2)}%`;
  }
  if (event.type === "social_spike") {
    return `${prefix}: ${event.asset} ${zh ? "社交热度异动" : "social activity spike"}`;
  }
  if (event.type === "market_move") {
    return `${prefix}: ${event.asset} ${zh ? "市场价格异动" : "market price move"}`;
  }
  return `${prefix}: ${localizeStoredText(event.title, language)}`;
}

function analystSummary(event, score, language = currentLanguage()) {
  const zh = language === "zh";
  const lines = [];
  if (event.amountUsd > 0) {
    lines.push(zh ? `${event.asset} 事件规模约 ${currency(event.amountUsd)}。` : `${event.asset} event size is about ${currency(event.amountUsd)}.`);
  }
  if (event.from || event.to) {
    lines.push(zh ? `资金路径：${event.fromLabel || "未知"} -> ${event.toLabel || "未知"}。` : `Fund path: ${event.fromLabel || "unknown"} -> ${event.toLabel || "unknown"}.`);
  }
  if (event.metrics.anomalyMultiple >= 2) {
    lines.push(zh ? `相对近期基线放大 ${event.metrics.anomalyMultiple.toFixed(1)} 倍。` : `Above the recent baseline by ${event.metrics.anomalyMultiple.toFixed(1)}x.`);
  }
  if (event.metrics.tvlChangePct) {
    lines.push(zh ? `协议指标变化 ${event.metrics.tvlChangePct.toFixed(2)}%，需要和价格/新闻交叉验证。` : `Protocol metric changed ${event.metrics.tvlChangePct.toFixed(2)}%; cross-check with price and news.`);
  }
  if (event.keywordHits.length) {
    const keywords = event.keywordHits.map((keyword) => localizeKeywordTerm(keyword, language)).join(", ");
    lines.push(zh ? `命中关键词：${keywords}。` : `Matched keywords: ${keywords}.`);
  }
  lines.push(zh ? `综合置信/优先级评分 ${score.toFixed(2)}。` : `Composite confidence/priority score: ${score.toFixed(2)}.`);
  return lines.join(" ");
}

function reasonsFor(event, language = currentLanguage()) {
  const zh = language === "zh";
  const reasons = [];
  if (event.amountUsd >= 5_000_000) reasons.push(zh ? "金额较大" : "Large amount");
  if (event.metrics.anomalyMultiple >= 3) reasons.push(zh ? "高于历史基线" : "Above historical baseline");
  if (exchangeAddresses.has(String(event.to || "").toLowerCase())) reasons.push(zh ? "流向中心化交易所" : "To centralized exchange");
  if (event.keywordHits.length) reasons.push(zh ? "命中关键词" : "Keyword match");
  if (Math.abs(event.metrics.tvlChangePct) >= 5) reasons.push(zh ? "协议指标异动" : "Protocol metric move");
  if (event.metrics.socialVelocity >= 60) reasons.push(zh ? "社交热度较高" : "Elevated social activity");
  if (event.sentiment === "negative") reasons.push(zh ? "负面舆情" : "Negative sentiment");
  if (event.brandHits?.length) reasons.push(zh ? `品牌词命中:${event.brandHits.join(",")}` : `Brand term hit: ${event.brandHits.join(",")}`);
  return reasons.length ? reasons : [zh ? "规则评分达标" : "Rule score threshold met"];
}

async function deliverAlert(alert) {
  const message = `[${severityLabel(alert.severity)}] ${alert.title}\n${alert.summary}`;
  const route = alert.event?.type === "announcement_keyword" || alert.event?.type === "listing" ? "listing" : alert.event?.sentiment === "negative" ? "sentiment" : "default";
  const targets = [sendTelegram(message, route), sendDiscord(alert, message)];
  if (alert.severity === "critical") targets.push(sendFeishu(message, route), sendWecom(message, route));
  await Promise.allSettled(targets);
}

async function attachAiAnalysis(alert) {
  if (!process.env.OPENAI_API_KEY || !["high", "critical"].includes(alert.severity)) return;
  const now = Date.now();
  if (now - aiWindowStart >= 60 * 60 * 1000) {
    aiWindowStart = now;
    aiCallsThisHour = 0;
  }
  if (aiCallsThisHour >= 10) return;
  aiCallsThisHour += 1;
  try {
    const response = await fetchWithRetry("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_ANALYST_MODEL || "gpt-5.4-nano",
        store: false,
        instructions:
          "You are a Web3 research analyst. Return exactly three short sentences: what happened, why it matters, and what similar historical situations usually require checking. Do not give investment advice.",
        input: JSON.stringify({
          title: alert.title,
          summary: alert.summary,
          reasons: alert.reasons,
          event: {
            type: alert.event?.type,
            asset: alert.event?.asset,
            amountUsd: alert.event?.amountUsd,
            source: alert.event?.source
          }
        })
      })
    }, { timeoutMs: 10000, retries: 1 });
    if (!response.ok) throw new Error(`OpenAI analyst ${response.status} ${response.statusText}`);
    const data = await response.json();
    if (data.usage) {
      state.metrics.aiInputTokens += Number(data.usage.input_tokens || 0);
      state.metrics.aiOutputTokens += Number(data.usage.output_tokens || 0);
    }
    state.metrics.aiAnalystCalls += 1;
    alert.aiAnalysis = extractResponseText(data);
  } catch (error) {
    connectorFail("aiAnalyst", error);
  }
}

function severityLabel(severity) {
  return { critical: "严重", high: "高", medium: "中", low: "低" }[severity] || severity;
}

async function sendTelegram(message, route = "default") {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const routeChatIds = {
    daily: process.env.TELEGRAM_DAILY_CHAT_ID,
    listing: process.env.TELEGRAM_LISTING_CHAT_ID,
    sentiment: process.env.TELEGRAM_SENTIMENT_CHAT_ID
  };
  const chatId = routeChatIds[route] || process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message, disable_web_page_preview: true })
  });
}

async function sendFeishu(message, route = "default") {
  const url = process.env.FEISHU_WEBHOOK_URL;
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      msg_type: "interactive",
      card: {
        config: { wide_screen_mode: true },
        header: {
          title: { tag: "plain_text", content: route === "daily" ? "Web3 Ops 运营晨报" : "Web3 Ops 严重告警" },
          template: route === "daily" ? "blue" : "red"
        },
        elements: [{ tag: "markdown", content: String(message || "").slice(0, 8000) }]
      }
    })
  });
}

async function sendWecom(message, route = "default") {
  const url = process.env.WECOM_WEBHOOK_URL;
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      msgtype: "markdown",
      markdown: {
        content: `**${route === "daily" ? "Web3 Ops 运营晨报" : "Web3 Ops 严重告警"}**\n\n${message}`.slice(0, 8000)
      }
    })
  });
}

async function sendDiscord(alert, message) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      content: message,
      embeds: [
        {
          title: alert.title,
          description: alert.summary,
          color: alert.severity === "critical" ? 14177041 : alert.severity === "high" ? 15105570 : 3447003
        }
      ]
    })
  });
}

async function pushDailyReport(message) {
  await Promise.allSettled([sendTelegram(message, "daily"), sendFeishu(message, "daily"), sendWecom(message, "daily")]);
}

async function simulateBatch() {
  return loadDemoScenario();
}

async function loadDemoScenario() {
  const base = Date.now();
  const at = (days) => new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
  const results = [];
  state.settings.myExchangeId = "bitget";
  if (!state.watchlist.assets.includes("COINX")) state.watchlist.assets = ["COINX", ...state.watchlist.assets];
  const announcements = [
    demoAnnouncement("binance", "Binance 将上线 COINX 并开放 Launchpool", "listing", at(-1.0), ["COINX"], "launchpool"),
    demoAnnouncement("okx", "OKX 将上线 COINX 现货交易", "listing", at(0.0), ["COINX"]),
    demoAnnouncement("bybit", "Bybit 开启 COINX 充值瓜分活动", "campaign", at(0.2), ["COINX"], "deposit_campaign"),
    demoAnnouncement("bitget", "Bitget 上线 COINX 合约交易", "listing", at(0.8), ["COINX"]),
    demoAnnouncement("binance", "Binance COINX Launchpool 开放投入", "campaign", at(0.1), ["COINX"], "launchpool"),
    demoAnnouncement("okx", "OKX COINX 交易赛瓜分 100,000 USDT", "campaign", at(0.4), ["COINX"], "trading_competition")
  ];
  for (const item of announcements) {
    state.exchangeAnnouncements = trimList([item, ...state.exchangeAnnouncements.filter((row) => row.id !== item.id)], 600);
    persistAnnouncement(item);
    createAnnouncementKeywordAlert(item);
  }
  results.push(await ingest({
    source: "x_api_simulator",
    type: "news",
    asset: "COINX",
    title: "CoinX 将被头部交易所上线的传闻升温",
    body: "T-3 天，多位 KOL 提到 CoinX 可能进入头部交易所上线窗口。",
    observedAt: at(-3),
    socialVelocity: 74,
    fingerprint: "demo:coinx:rumor"
  }));
  results.push(await ingest({
    source: "x_api_simulator",
    type: "social_spike",
    asset: "COINX",
    title: "COINX 出现负面舆情升温",
    body: "T+1 天，社区出现 FUD、无法提现和做市质疑，需要客服与社群口径同步。",
    observedAt: at(1),
    socialVelocity: 92,
    fingerprint: "demo:coinx:fud"
  }));
  const regulationEvents = [
    ["US", "BTC", "美国 SEC 对某加密交易所发起诉讼并提出罚款要求", "SEC lawsuit fine"],
    ["HK", "OPS", "香港 SFC 更新虚拟资产平台牌照合规检查清单", "SFC license compliance"],
    ["SG", "USDT", "新加坡 MAS 提醒稳定币发行方完成合规披露", "MAS stablecoin compliance"],
    ["EU", "ETH", "欧盟 MiCA 进入执行窗口，交易所需补充用户风险披露", "MiCA compliance"],
    ["OTHER", "COINX", "海外市场传出针对 COINX 的临时禁令讨论", "ban penalty"]
  ];
  for (const [region, asset, title, body] of regulationEvents) {
    results.push(await ingest({
      source: "regulation_simulator",
      type: "news",
      asset,
      title,
      body,
      observedAt: at(-0.2),
      socialVelocity: 82,
      fingerprint: `demo:regulation:${region}:${asset}`
    }));
  }
  const unlocks = [
    ["CoinX", "coinx", "COINX", 2, "团队/投资人", 40_000_000, 18_000_000, 1.8],
    ["Arbitrum", "arbitrum", "ARB", 4, "投资人", 92_000_000, 84_000_000, 2.1],
    ["Aptos", "aptos", "APT", 6, "核心贡献者", 11_300_000, 65_000_000, 1.2],
    ["Optimism", "optimism", "OP", 9, "生态基金", 31_000_000, 48_000_000, 0.9],
    ["Sui", "sui", "SUI", 12, "社区储备", 64_000_000, 52_000_000, 1.4],
    ["Immutable", "immutable", "IMX", 16, "项目储备", 24_000_000, 31_000_000, 0.8],
    ["Starknet", "starknet", "STRK", 21, "早期贡献者", 38_000_000, 27_000_000, 1.1],
    ["Celestia", "celestia", "TIA", 28, "私募投资人", 18_000_000, 71_000_000, 2.4]
  ].map(([project, slug, symbol, days, category, tokensUnlocked, valueUsd, percentOfSupply]) => ({
    id: `demo:${slug}:unlock`,
    project,
    slug,
    symbol,
    token: symbol,
    unlockDate: at(days),
    category,
    tokensUnlocked,
    valueUsd,
    percentOfSupply,
    isLarge: valueUsd >= 10_000_000 || percentOfSupply >= 1,
    url: `https://defillama.com/unlocks/${slug}`
  }));
  const unlockIds = new Set(unlocks.map((item) => item.id));
  state.unlockEvents = [...unlocks, ...(state.unlockEvents || []).filter((item) => !unlockIds.has(item.id))]
    .sort((a, b) => new Date(a.unlockDate) - new Date(b.unlockDate));
  results.push(await ingest({
    source: "defillama_unlocks_simulator",
    type: "news",
    asset: "COINX",
    title: "CoinX 未来48小时将发生大额解锁",
    body: "T+2 天预计解锁 1,800 万美元，占供应量 1.8%。",
    amountUsd: 18_000_000,
    observedAt: at(1.5),
    fingerprint: "demo:coinx:unlock-alert"
  }));
  connectorOk("demo", { count: results.length + announcements.length, message: "已载入 CoinX 运营演示剧本" });
  await saveState();
  return results;
}

function demoAnnouncement(exchangeId, title, opsCategoryId, publishedAt, tokens = [], campaignTypeId = "") {
  const exchange = exchangeName(exchangeId);
  return {
    id: `demo:${exchangeId}:${opsCategoryId}:${tokens.join("-")}:${publishedAt.slice(0, 10)}:${campaignTypeId || "listing"}`,
    exchangeId,
    exchange,
    language: "zh",
    title,
    originalTitle: title,
    category: opsCategoryLabel(opsCategoryId, "zh"),
    opsCategoryId,
    opsCategory: opsCategoryLabel(opsCategoryId, "zh"),
    campaignTypeId,
    tokens,
    tags: opsCategoryId === "campaign" ? [campaignTypeLabel(campaignTypeId || "other", "zh")] : ["上新"],
    matchedAssets: tokens,
    activityScore: opsCategoryId === "campaign" ? 92 : 82,
    publishedAt,
    fetchedAt: nowIso(),
    url: `https://demo.local/${exchangeId}/${tokens[0] || "ops"}-${opsCategoryId}`
  };
}

function sampleLargeTransfer() {
  const asset = pick(state.watchlist.assets);
  const amountUsd = randomBetween(450_000, asset === "BTC" ? 16_000_000 : 9_000_000);
  const price = market[asset]?.price || 1;
  const to = Math.random() > 0.45 ? "0x28C6c06298d514Db089934071355E5743bf21d60" : randomWallet();
  return {
    source: "alchemy_notify_simulator",
    type: "large_transfer",
    chain: asset === "SOL" ? "solana" : "ethereum",
    asset,
    amount: amountUsd / price,
    amountUsd,
    from: randomWallet(),
    to,
    txHash: `0x${crypto.randomBytes(32).toString("hex")}`
  };
}

function sampleDexSwap() {
  const asset = pick(state.watchlist.assets);
  const amountUsd = randomBetween(120_000, 4_500_000);
  return {
    source: "moralis_streams_simulator",
    type: "dex_swap",
    chain: asset === "SOL" ? "solana" : "base",
    asset,
    amount: amountUsd / (market[asset]?.price || 1),
    amountUsd,
    protocol: pick(["Uniswap", "Jupiter", "Aerodrome"]),
    from: randomWallet(),
    to: randomWallet(),
    socialVelocity: Math.random() > 0.75 ? randomBetween(50, 95) : 0
  };
}

function sampleNews() {
  const asset = pick(state.watchlist.assets);
  const topic = pick([
    "治理投票开启，讨论金库资金部署",
    "ETF 相关新闻影响市场预期",
    "代币解锁计划进入最终确认",
    "生态项目报告可疑活动",
    "空投领取窗口开放"
  ]);
  return {
    source: "cryptopanic_simulator",
    type: "news",
    asset,
    title: `${asset}: ${topic}`,
    body: `${asset} 监控项，需要和价格、钱包流向、协议指标交叉验证。`,
    url: "https://cryptopanic.com/",
    socialVelocity: randomBetween(10, 88)
  };
}

function sampleTvlMove() {
  const protocol = pick(state.watchlist.protocols);
  const asset = pick(state.watchlist.assets);
  return {
    source: "defillama_simulator",
    type: "protocol_tvl_change",
    asset,
    protocol,
    title: `${protocol} 总锁仓量异动`,
    body: `${protocol} 的变化速度高于 7 日基线。`,
    tvlChangePct: randomBetween(-11, 12),
    amountUsd: randomBetween(1_000_000, 14_000_000)
  };
}

function sampleSocialSpike() {
  const asset = pick(state.watchlist.assets);
  return {
    source: "x_api_simulator",
    type: "social_spike",
    asset,
    title: `${asset} 讨论热度升高`,
    body: `${asset} 围绕 ${pick(state.watchlist.keywords)} 的提及加速。`,
    socialVelocity: randomBetween(45, 100),
    url: "https://docs.x.com/x-api/introduction"
  };
}

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function randomWallet() {
  return `0x${crypto.randomBytes(20).toString("hex")}`;
}

async function handleApi(req, res, pathname) {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (req.method === "GET" && pathname === "/api/health") {
    return json(res, 200, { ok: true, metrics: state.metrics, uptime: process.uptime() });
  }

  if (req.method === "GET" && pathname === "/api/state") {
    return json(res, 200, publicState());
  }

  if (req.method === "POST" && pathname === "/api/settings") {
    const body = await readBody(req);
    const requestedExchange = body.myExchangeId || body.settings?.myExchangeId || state.settings.myExchangeId;
    const nextExchange = exchangeSources.some((source) => source.id === requestedExchange) ? requestedExchange : myExchangeId();
    state.settings = { ...state.settings, language: "zh", myExchangeId: nextExchange };
    await saveState();
    return json(res, 200, { settings: state.settings, state: publicState() });
  }

  if (req.method === "POST" && pathname === "/api/sync") {
    const result = await syncLiveSources();
    return json(res, 201, { result, state: publicState() });
  }

  if (req.method === "GET" && pathname === "/api/events") {
    return json(res, 200, { events: state.normalizedEvents.slice(0, 100) });
  }

  if (req.method === "GET" && pathname === "/api/web3-news") {
    return json(res, 200, { news: web3NewsEvents().slice(0, 20) });
  }

  if (req.method === "GET" && pathname === "/api/regulation") {
    return json(res, 200, { items: regulationItems("zh").slice(0, 100) });
  }

  if (req.method === "GET" && pathname === "/api/unlocks") {
    return json(res, 200, { unlocks: unlockEventsForDisplay().slice(0, 100) });
  }

  if (req.method === "GET" && pathname === "/api/search") {
    return json(res, 200, searchMemory({
      q: requestUrl.searchParams.get("q") || "",
      from: requestUrl.searchParams.get("from") || "",
      to: requestUrl.searchParams.get("to") || "",
      type: requestUrl.searchParams.get("type") || ""
    }));
  }

  if (req.method === "GET" && pathname === "/api/alerts") {
    return json(res, 200, { alerts: state.alerts.slice(0, 100) });
  }

  if (req.method === "GET" && pathname === "/api/journal") {
    await updateJournalOutcomes();
    return json(res, 200, { signals: getJournal(), stats: journalStats() });
  }

  if (req.method === "GET" && pathname === "/api/journal/stats") {
    await updateJournalOutcomes();
    return json(res, 200, journalStats());
  }

  if (req.method === "GET" && pathname === "/api/daily-report") {
    const report = await dailyReport("zh");
    if (requestUrl.searchParams.get("push")) {
      await pushDailyReport(report.report);
    }
    return json(res, 200, report);
  }

  if (req.method === "GET" && pathname === "/api/weekly-report") {
    return json(res, 200, await weeklyReport("zh"));
  }

  if (req.method === "GET" && pathname === "/api/exchange-announcements") {
    return json(res, 200, { announcements: localizedExchangeAnnouncements("zh").slice(0, 200) });
  }

  if (req.method === "GET" && pathname === "/api/listing-race") {
    return json(res, 200, { listings: listingRace("zh") });
  }

  if (req.method === "GET" && pathname === "/api/campaigns") {
    return json(res, 200, { campaigns: getCampaigns("zh") });
  }

  if (req.method === "POST" && pathname === "/api/sync-web3-news") {
    const result = await syncWeb3News();
    await saveState();
    return json(res, 201, { result, news: web3NewsEvents().slice(0, 20), state: publicState() });
  }

  if (req.method === "POST" && pathname === "/api/sync-unlocks") {
    const result = await syncUnlockCalendar();
    return json(res, 201, { result, unlocks: unlockEventsForDisplay().slice(0, 100), state: publicState() });
  }

  if (req.method === "POST" && pathname === "/api/sync-exchanges") {
    const result = await syncExchangeAnnouncements();
    await saveState();
    return json(res, 201, { result, announcements: localizedExchangeAnnouncements().slice(0, 200), state: publicState() });
  }

  if (req.method === "GET" && pathname === "/api/watchlist") {
    return json(res, 200, { watchlist: state.watchlist });
  }

  if (req.method === "POST" && pathname === "/api/watchlist") {
    const body = await readBody(req);
    state.watchlist = sanitizeWatchlist(body.watchlist || body);
    for (const wallet of state.watchlist.wallets) {
      addressBook.set(wallet.address.toLowerCase(), wallet.label || shorten(wallet.address));
    }
    await saveState();
    return json(res, 200, { watchlist: state.watchlist });
  }

  if (req.method === "POST" && pathname === "/api/ingest") {
    if (!rateLimit(req, "ingest", 60, 60_000)) {
      return json(res, 429, { error: "rate_limited" });
    }
    const body = await readBody(req);
    const validationError = validateIngestPayload(body);
    if (validationError) return json(res, 400, { error: validationError });
    const result = await ingest(body);
    return json(res, 201, result);
  }

  if (req.method === "POST" && pathname === "/api/webhooks/alchemy") {
    const rawBody = await readRawBody(req);
    if (!verifyAlchemySignature(req, rawBody)) {
      return json(res, 401, { error: "invalid_signature" });
    }
    const payload = JSON.parse(rawBody.toString("utf8") || "{}");
    const events = adaptAlchemyWebhook(payload);
    const results = [];
    for (const event of events) results.push(await ingest(event));
    connectorOk("alchemy", { count: results.length, message: `收到 ${results.length} 条 Alchemy 回调事件` });
    return json(res, 201, { results });
  }

  if (req.method === "POST" && pathname === "/api/webhooks/moralis") {
    const rawBody = await readRawBody(req);
    if (!verifySharedSecret(req, process.env.MORALIS_STREAM_SECRET)) {
      return json(res, 401, { error: "invalid_signature" });
    }
    const payload = JSON.parse(rawBody.toString("utf8") || "{}");
    const events = adaptMoralisWebhook(payload);
    const results = [];
    for (const event of events) results.push(await ingest(event));
    connectorOk("moralis", { count: results.length, message: `收到 ${results.length} 条 Moralis 回调事件` });
    return json(res, 201, { results });
  }

  if (req.method === "POST" && pathname === "/api/simulate") {
    const results = await simulateBatch();
    return json(res, 201, { results, state: publicState() });
  }

  if (req.method === "POST" && pathname === "/api/feedback") {
    const body = await readBody(req);
    state.feedback = trimList([
      { id: id("fb"), createdAt: nowIso(), alertId: body.alertId, rating: body.rating, note: body.note || "" },
      ...state.feedback
    ]);
    await saveState();
    return json(res, 201, { ok: true });
  }

  return json(res, 404, { error: "not_found" });
}

function verifyAlchemySignature(req, rawBody) {
  const signingKey = process.env.ALCHEMY_SIGNING_KEY;
  if (!signingKey) return true;
  const header = req.headers["x-alchemy-signature"] || req.headers["x-webhook-signature"] || "";
  if (!header) return false;
  const expected = crypto.createHmac("sha256", signingKey).update(rawBody).digest("hex");
  return timingSafeEqual(String(header).replace(/^sha256=/, ""), expected);
}

function verifySharedSecret(req, secret) {
  if (!secret) return true;
  const header = req.headers["x-signature"] || req.headers["x-moralis-signature"] || req.headers.authorization || "";
  const normalized = String(header).replace(/^Bearer\s+/i, "");
  return timingSafeEqual(normalized, secret);
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function adaptAlchemyWebhook(payload) {
  const activity = payload.event?.activity || payload.activity || [];
  return activity.map((item) => {
    const asset = String(item.asset || item.rawContract?.symbol || "ETH").toUpperCase();
    const amount = Number(item.value || item.amount || 0);
    return {
      source: "alchemy_notify",
      type: "large_transfer",
      chain: payload.event?.network || payload.network || "ethereum",
      asset,
      amount,
      amountUsd: amount * (market[asset]?.price || 1),
      from: item.fromAddress,
      to: item.toAddress,
      txHash: item.hash,
      url: item.hash ? `https://etherscan.io/tx/${item.hash}` : "",
      fingerprint: item.hash ? `alchemy:${item.hash}:${item.fromAddress}:${item.toAddress}:${asset}:${amount}` : ""
    };
  });
}

function adaptMoralisWebhook(payload) {
  const transfers = [
    ...(payload.erc20Transfers || []),
    ...(payload.nativeTransfers || []),
    ...(payload.nftTransfers || [])
  ];
  return transfers.map((item) => {
    const asset = String(item.tokenSymbol || item.symbol || payload.tokenSymbol || "ETH").toUpperCase();
    const decimals = Number(item.tokenDecimals || item.decimals || 18);
    const rawValue = Number(item.valueWithDecimals || item.value_decimal || 0);
    const amount = rawValue || Number(item.value || 0) / 10 ** decimals;
    const txHash = item.transactionHash || payload.txHash || payload.hash;
    return {
      source: "moralis_streams",
      type: item.possibleSpam ? "security_signal" : "large_transfer",
      chain: payload.chainId || payload.chain || "ethereum",
      asset,
      amount,
      amountUsd: amount * (market[asset]?.price || 1),
      from: item.from || item.fromAddress,
      to: item.to || item.toAddress,
      txHash,
      fingerprint: txHash ? `moralis:${txHash}:${item.from || item.fromAddress}:${item.to || item.toAddress}:${asset}:${amount}` : ""
    };
  });
}

function sanitizeWatchlist(input) {
  const list = {
    assets: cleanArray(input.assets).map((item) => item.toUpperCase()),
    wallets: Array.isArray(input.wallets)
      ? input.wallets
          .filter((item) => item && item.address)
          .map((item) => ({ address: String(item.address).trim(), label: String(item.label || "").trim() }))
      : [],
    protocols: cleanArray(input.protocols),
    keywords: cleanArray(input.keywords),
    kols: cleanArray(input.kols).map((item) => item.replace(/^@/, "")),
    brandTerms: cleanArray(input.brandTerms)
  };
  return {
    assets: list.assets.length ? list.assets : defaultState.watchlist.assets,
    wallets: list.wallets,
    protocols: list.protocols.length ? list.protocols : defaultState.watchlist.protocols,
    keywords: list.keywords.length ? list.keywords : defaultState.watchlist.keywords,
    kols: list.kols.length ? list.kols : defaultState.watchlist.kols,
    brandTerms: list.brandTerms.length ? list.brandTerms : defaultState.watchlist.brandTerms
  };
}

function cleanArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function localizedExchangeAnnouncements(language = currentLanguage()) {
  const seen = new Set();
  const grouped = new Map();
  for (const item of state.exchangeAnnouncements) {
    const key = item.url ? `${item.exchangeId}:${item.url}` : `${item.exchangeId}:${item.title}`;
    const current = grouped.get(key);
    if (!current || item.language === language) grouped.set(key, item);
  }
  return [...grouped.values()]
    .map((item) => localizeAnnouncementRecord(enrichAnnouncementRecord(item), language))
    .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
    .filter((item) => {
      const key = item.url ? `${item.exchangeId}:${item.url}` : `${item.exchangeId}:${item.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function localizeAnnouncementRecord(item, language = currentLanguage()) {
  const title = language === "zh" ? chineseAnnouncementTitle(item) : localizeStoredText(item.title, language);
  const originalTitle = item.originalTitle || item.title;
  const opsId = item.opsCategoryId || opsCategoryFor(`${title} ${item.category || ""}`, language).id;
  return {
    ...item,
    language,
    title,
    originalTitle,
    category: opsCategoryLabel(opsId, language),
    opsCategoryId: opsId,
    opsCategory: opsCategoryLabel(opsId, language),
    tags: (item.tags || tagsForAnnouncement(title, language)).map((tag) => localizeStoredText(tag, language)),
    tokens: item.tokens?.length ? item.tokens : tokensFromTitle(title)
  };
}

function chineseAnnouncementTitle(item) {
  const originalTitle = item.originalTitle || item.title || "";
  if (isChineseText(originalTitle) && !hasUntranslatedEnglish(originalTitle)) return normalizeChineseSurface(originalTitle);
  const translated = localizeStoredText(originalTitle || item.title, "zh");
  if (translated && !/外部公告|活动公告$/.test(translated)) return translated;
  const opsId = item.opsCategoryId || opsCategoryFor(`${item.title || ""} ${originalTitle}`, "zh").id;
  const tokens = (item.tokens?.length ? item.tokens : tokensFromTitle(`${item.title || ""} ${originalTitle}`)).slice(0, 3).join(" / ");
  const subject = tokens || opsCategoryLabel(opsId, "zh");
  return `${item.exchange} ${subject}公告`;
}

function enrichAnnouncementRecord(item) {
  if (item.opsCategoryId && item.tokens) return item;
  const language = item.language || currentLanguage();
  const text = `${item.title || ""} ${item.originalTitle || ""} ${item.category || ""}`;
  const regulation = regulationMetaFor(text);
  const opsCategory = regulation.isRegulation ? { id: "regulation", label: opsCategoryLabel("regulation", language) } : opsCategoryFor(text, language);
  return {
    ...item,
    originalTitle: item.originalTitle || item.title,
    opsCategoryId: item.opsCategoryId || opsCategory.id,
    opsCategory: item.opsCategory || opsCategory.label,
    regulationRegion: item.regulationRegion || regulation.region || "",
    regulationHighRisk: Boolean(item.regulationHighRisk || regulation.highRisk),
    tokens: item.tokens?.length ? item.tokens : tokensFromTitle(item.title)
  };
}

function listingRace(language = currentLanguage()) {
  const benchmarkId = myExchangeId();
  const listings = localizedExchangeAnnouncements(language)
    .filter((item) => item.opsCategoryId === "listing" && item.tokens?.length)
    .flatMap((item) =>
      item.tokens.map((token) => ({
        token,
        exchange: item.exchange,
        exchangeId: item.exchangeId,
        publishedAt: item.publishedAt,
        title: item.title,
        url: item.url
      }))
    );
  const grouped = new Map();
  for (const item of listings) {
    if (!grouped.has(item.token)) grouped.set(item.token, []);
    grouped.get(item.token).push(item);
  }
  const now = Date.now();
  return [...grouped.entries()]
    .map(([token, rows]) => {
      const sorted = rows.sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt));
      const firstAt = sorted[0]?.publishedAt || "";
      const mine = sorted.find((row) => row.exchangeId === benchmarkId);
      const lagDays = mine?.publishedAt && firstAt ? (new Date(mine.publishedAt).getTime() - new Date(firstAt).getTime()) / (24 * 60 * 60 * 1000) : null;
      return {
        token,
        firstExchange: sorted[0]?.exchange || "",
        firstAt,
        myExchange: exchangeName(benchmarkId),
        myExchangeId: benchmarkId,
        myPublishedAt: mine?.publishedAt || "",
        lagDays,
        lagLabel: lagDays == null ? "未跟进" : lagDays <= 0 ? "领先/同步" : `落后 ${lagDays.toFixed(1)} 天`,
        isNew24h: sorted.some((row) => now - new Date(row.publishedAt).getTime() <= 24 * 60 * 60 * 1000),
        exchanges: exchangeSources.map((source) => {
          const hit = sorted.find((row) => row.exchangeId === source.id);
          return hit || { exchange: source.name, exchangeId: source.id, publishedAt: "", title: "", url: "" };
        })
      };
    })
    .sort((a, b) => new Date(b.firstAt || 0) - new Date(a.firstAt || 0));
}

function getCampaigns(language = currentLanguage()) {
  const rows = db.prepare("SELECT json FROM campaigns ORDER BY published_at DESC LIMIT 1000").all().map((row) => {
    const item = JSON.parse(row.json);
    const originalTitle = item.originalTitle || item.title;
    const translatedTitle = localizeStoredText(originalTitle, "zh");
    const title = isChineseText(originalTitle) && !hasUntranslatedEnglish(originalTitle)
      ? normalizeChineseSurface(originalTitle)
      : /外部公告|活动公告$/.test(translatedTitle)
        ? `${item.exchange} ${campaignTypeLabel(item.campaignTypeId, "zh")}公告${item.tokens?.length ? `：${item.tokens.slice(0, 3).join(" / ")}` : ""}`
        : translatedTitle;
    return {
      ...item,
      campaignType: campaignTypeLabel(item.campaignTypeId, "zh"),
      title,
      originalTitle,
      localizedTitle: ""
    };
  });
  const grouped = new Map();
  for (const item of rows) {
    const key = item.url ? `${item.exchangeId}:${item.url}` : `${item.exchangeId}:${item.originalTitle}`;
    const current = grouped.get(key);
    if (!current || campaignTitleQuality(item) > campaignTitleQuality(current)) grouped.set(key, item);
  }
  return [...grouped.values()].sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
}

function campaignFrequencyComparison(language = currentLanguage()) {
  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const mine = myExchangeId();
  const campaigns = getCampaigns(language).filter((item) => new Date(item.publishedAt || 0).getTime() >= since);
  const types = [...new Set(campaigns.map((item) => item.campaignType).filter(Boolean))].slice(0, 8);
  const rows = exchangeSources.map((source) => {
    const sourceRows = campaigns.filter((item) => item.exchangeId === source.id);
    const byType = Object.fromEntries(types.map((type) => [type, sourceRows.filter((item) => item.campaignType === type).length]));
    return {
      exchangeId: source.id,
      exchange: source.name,
      isMine: source.id === mine,
      total: sourceRows.length,
      byType
    };
  });
  return { myExchangeId: mine, myExchange: exchangeName(mine), types, rows };
}

function benchmarkReminders(language = currentLanguage()) {
  const mine = myExchangeId();
  const race = listingRace(language)
    .filter((row) => row.myExchangeId === mine && row.lagDays == null)
    .slice(0, 5)
    .map((row) => `- 上币未跟进：${row.token} 已由 ${row.firstExchange} 首发。`);
  const since = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const campaigns = getCampaigns(language)
    .filter((item) => item.exchangeId !== mine && new Date(item.publishedAt || 0).getTime() >= since)
    .sort((a, b) => (b.structured || 0) - (a.structured || 0) || new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
    .slice(0, 5)
    .map((item) => `- 活动可对标：${item.exchange} ${item.campaignType}「${item.title}」。`);
  return [...race, ...campaigns].slice(0, 8);
}

function regulationItems(language = currentLanguage()) {
  const announcements = localizedExchangeAnnouncements(language)
    .filter((item) => item.opsCategoryId === "regulation")
    .map((item) => ({
      id: item.id,
      kind: "announcement",
      title: item.title,
      source: item.exchange,
      region: item.regulationRegion || "OTHER",
      severity: item.regulationHighRisk ? "critical" : "medium",
      url: item.url,
      observedAt: item.publishedAt
    }));
  const events = state.normalizedEvents
    .filter((event) => event.opsCategoryId === "regulation")
    .map((event) => {
      const row = localizeEventRecord(event, language);
      const title = /活动公告$/.test(row.title || "") || /[A-Za-z]{3,}.*[A-Za-z]{3,}/.test(row.title || "")
        ? regulationDisplayTitle(`${event.title || ""} ${event.body || ""}`, row.regulationRegion || "OTHER", row.asset || "Web3")
        : row.title;
      return {
        id: row.id,
        kind: "event",
        title,
        source: row.source,
        region: row.regulationRegion || "OTHER",
        severity: row.regulationHighRisk ? "critical" : "medium",
        url: row.url,
        observedAt: row.observedAt
      };
    });
  const seen = new Set();
  const rows = [...announcements, ...events]
    .filter((item) => {
      const key = item.url || item.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b.observedAt || 0) - new Date(a.observedAt || 0));
  if (rows.length >= 8) return rows;
  const existing = new Set(rows.map((item) => item.id));
  return [
    ...rows,
    ...defaultRegulationItems().filter((item) => !existing.has(item.id)).slice(0, 8 - rows.length)
  ];
}

function defaultRegulationItems() {
  const now = Date.now();
  const at = (hoursAgo) => new Date(now - hoursAgo * 60 * 60 * 1000).toISOString();
  return [
    ["demo:reg:us:sec", "US", "US 监管诉讼动态：交易所合规", "SEC / CFTC 相关执法和诉讼进展，运营侧需关注上架资产、地区访问和客服口径。", "critical", at(3)],
    ["demo:reg:hk:sfc", "HK", "HK 牌照合规动态：虚拟资产平台", "香港 SFC 牌照、代币尽调和投资者保护规则更新，适合纳入日报观察。", "medium", at(6)],
    ["demo:reg:sg:mas", "SG", "SG 稳定币合规动态：披露与储备", "新加坡 MAS 稳定币、托管和支付牌照要求变化，需关注公告措辞。", "medium", at(9)],
    ["demo:reg:eu:mica", "EU", "EU MiCA 执行动态：用户风险披露", "欧盟 MiCA 进入执行阶段，交易所活动和资产宣传需避免绝对化表述。", "medium", at(12)],
    ["demo:reg:other:ban", "OTHER", "OTHER 监管禁令动态：地区访问限制", "部分市场出现访问限制、禁令或罚款传闻，适合作为舆情与法务联动观察项。", "critical", at(18)]
  ].map(([id, region, title, summary, severity, observedAt]) => ({
    id,
    kind: "demo",
    title,
    source: "演示样例",
    summary,
    region,
    severity,
    url: "",
    observedAt
  }));
}

function unlockEventsForDisplay() {
  const rows = (state.unlockEvents || []).slice();
  if (rows.length >= 8) return rows.sort((a, b) => new Date(a.unlockDate) - new Date(b.unlockDate));
  const existing = new Set(rows.map((item) => item.id));
  return [
    ...rows,
    ...defaultUnlockEvents().filter((item) => !existing.has(item.id)).slice(0, 8 - rows.length)
  ].sort((a, b) => new Date(a.unlockDate) - new Date(b.unlockDate));
}

function defaultUnlockEvents() {
  const base = Date.now();
  const at = (days) => new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
  return [
    ["demo:unlock:arb", "Arbitrum", "arbitrum", "ARB", 3, "投资人", 84_000_000, 2.1],
    ["demo:unlock:apt", "Aptos", "aptos", "APT", 5, "核心贡献者", 65_000_000, 1.2],
    ["demo:unlock:op", "Optimism", "optimism", "OP", 8, "生态基金", 48_000_000, 0.9],
    ["demo:unlock:sui", "Sui", "sui", "SUI", 11, "社区储备", 52_000_000, 1.4],
    ["demo:unlock:imx", "Immutable", "immutable", "IMX", 15, "项目储备", 31_000_000, 0.8],
    ["demo:unlock:strk", "Starknet", "starknet", "STRK", 20, "早期贡献者", 27_000_000, 1.1],
    ["demo:unlock:tia", "Celestia", "celestia", "TIA", 27, "私募投资人", 71_000_000, 2.4],
    ["demo:unlock:coinx", "CoinX", "coinx", "COINX", 2, "团队/投资人", 18_000_000, 1.8]
  ].map(([id, project, slug, symbol, days, category, valueUsd, percentOfSupply]) => ({
    id,
    project,
    slug,
    symbol,
    token: symbol,
    unlockDate: at(days),
    category,
    tokensUnlocked: 0,
    valueUsd,
    percentOfSupply,
    isLarge: valueUsd >= 10_000_000 || percentOfSupply >= 1,
    url: `https://defillama.com/unlocks/${slug}`,
    isDemo: true
  }));
}

function searchMemory({ q = "", from = "", to = "", type = "" } = {}) {
  const keyword = `%${String(q || "").trim()}%`;
  const hasQuery = String(q || "").trim().length > 0;
  const inRange = (value) => {
    const time = new Date(value || 0).getTime();
    if (from && time < new Date(from).getTime()) return false;
    if (to && time > new Date(`${to}T23:59:59`).getTime()) return false;
    return true;
  };
  const like = (text) => !hasQuery || String(text || "").toLowerCase().includes(String(q || "").toLowerCase());
  // SQLite LIKE is enough for now. If this grows, replace these scans with an FTS5 virtual table.
  const announcements = type && type !== "announcements" ? [] : db.prepare("SELECT json FROM announcements WHERE (? = 0 OR json LIKE ?) ORDER BY published_at DESC LIMIT 800").all(hasQuery ? 1 : 0, keyword)
    .map((row) => JSON.parse(row.json))
    .filter((item) => inRange(item.publishedAt) && like(`${item.title} ${item.originalTitle || ""} ${item.exchange}`))
    .slice(0, 50)
    .map((item) => ({ kind: "announcements", title: chineseAnnouncementTitle(item), source: item.exchange, url: item.url, observedAt: item.publishedAt }));
  const campaigns = type && type !== "campaigns" ? [] : db.prepare("SELECT json FROM campaigns WHERE (? = 0 OR json LIKE ?) ORDER BY published_at DESC LIMIT 800").all(hasQuery ? 1 : 0, keyword)
    .map((row) => JSON.parse(row.json))
    .filter((item) => inRange(item.publishedAt) && like(`${item.title} ${item.originalTitle || ""} ${item.exchange} ${item.campaignType}`))
    .slice(0, 50)
    .map((item) => ({ kind: "campaigns", title: item.title, source: item.exchange, url: item.url, observedAt: item.publishedAt }));
  const events = type && type !== "events" ? [] : db.prepare("SELECT json FROM events WHERE (? = 0 OR json LIKE ?) ORDER BY observed_at DESC LIMIT 800").all(hasQuery ? 1 : 0, keyword)
    .map((row) => JSON.parse(row.json))
    .filter((item) => inRange(item.observedAt) && like(`${item.title} ${item.body || ""} ${item.source}`))
    .slice(0, 50)
    .map((item) => ({ kind: "events", title: localizeStoredText(item.title, "zh"), source: localizeSourceLabel(item.source, "zh"), url: item.url, observedAt: item.observedAt }));
  return { q, from, to, type, groups: { announcements, campaigns, events } };
}

function campaignTitleQuality(item) {
  const title = String(item.originalTitle || item.title || "");
  let score = title.length;
  if (/^【机器翻译】/.test(title)) score -= 1000;
  if (/外部公告/.test(title)) score -= 1000;
  if (isChineseText(title) && hasUntranslatedEnglish(title)) score -= 200;
  if (/[A-Za-z]{3,}/.test(title)) score += 50;
  return score;
}

function whaleTransfers() {
  return state.normalizedEvents
    .filter((event) => event.type === "large_transfer" && Number(event.amountUsd || 0) >= Number(process.env.WHALE_TRANSFER_USD_THRESHOLD || 1_000_000))
    .sort((a, b) => new Date(b.observedAt || 0) - new Date(a.observedAt || 0));
}

function web3NewsEvents() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const news = state.normalizedEvents.filter((event) => event.type === "news" && event.source === "web3_news");
  const today = news.filter((event) => new Date(event.observedAt || 0).getTime() >= start.getTime());
  const seen = new Set(today.map((event) => event.url || event.fingerprint || event.title));
  const rows = [
    ...today,
    ...news.filter((event) => {
      const key = event.url || event.fingerprint || event.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
  ];
  return rows
    .map((event) => {
      const row = localizeEventRecord(event, "zh");
      if (/^(活动公告|外部公告|.*相关活动公告)$/.test(row.title || "")) {
        row.title = fallbackChineseNewsTitleFromUrl(row.url, row.source);
      }
      if (/活动公告$/.test(row.body || "")) {
        row.body = `${row.source || "Web3新闻"} 新闻，已归入今日 Web3 大事件。`;
      }
      return row;
    })
    .sort((a, b) => web3NewsImportance(`${b.title} ${b.body}`) - web3NewsImportance(`${a.title} ${a.body}`) || new Date(b.observedAt || 0) - new Date(a.observedAt || 0));
}

function fallbackChineseNewsTitleFromUrl(url, source = "Web3新闻") {
  const text = String(url || "").toLowerCase();
  if (text.includes("barstool") || text.includes("portnoy")) return "Barstool 创始人 Portnoy 表示将长期持有比特币";
  if (text.includes("vitalik") && text.includes("lean") && text.includes("ethereum")) return "Vitalik Buterin 分享 Lean Ethereum 路线图优先事项";
  if (text.includes("zcash") && text.includes("ironwood")) return "Zcash Ironwood 升级进展引发市场关注";
  if (text.includes("claude") || text.includes("fable")) return "AI 模型与 Web3 应用生态出现新动态";
  return `${source || "Web3新闻"} 重要动态`;
}

function localizeEventRecord(event, language = currentLanguage()) {
  return {
    ...event,
    title: localizeStoredText(event.title, language),
    body: localizeStoredText(event.body, language),
    fromLabel: localizeStoredText(event.fromLabel, language),
    toLabel: localizeStoredText(event.toLabel, language),
    source: localizeSourceLabel(event.source, language)
  };
}

function localizeKeywordTerm(keyword, language = currentLanguage()) {
  const keywordMapZh = { exploit: "漏洞攻击", airdrop: "空投", unlock: "解锁", governance: "治理", fud: "负面舆情" };
  const keywordMapEn = { 漏洞攻击: "exploit", 空投: "airdrop", 解锁: "unlock", 治理: "governance", 负面舆情: "FUD" };
  const key = String(keyword || "");
  return language === "zh" ? keywordMapZh[key.toLowerCase()] || key : keywordMapEn[key] || key;
}

function localizeAlertRecord(alert, language = currentLanguage()) {
  const event = localizeEventRecord(alert.event || {}, language);
  if (event.type === "announcement_keyword") {
    const keywordText = (event.keywordHits || []).map((keyword) => localizeKeywordTerm(keyword, language)).join(", ");
    const title = language === "zh"
      ? `关键词命中：${event.source || ""} ${keywordText}`
      : `Keyword hit: ${event.source || ""} ${keywordText}`;
    const summary = language === "zh"
      ? `${localizeStoredText(event.title, language)} 命中订阅关键词：${keywordText}。`
      : `${localizeStoredText(event.title, language)} matched subscribed keywords: ${keywordText}.`;
    return {
      ...alert,
      title,
      summary,
      reasons: [language === "zh" ? "关键词订阅" : "Keyword subscription", opsCategoryLabel(event.opsCategoryId || "other", language)],
      event
    };
  }
  return {
    ...alert,
    title: alert.event ? alertTitle(event, alert.severity, language) : localizeStoredText(alert.title, language),
    summary: alert.event ? analystSummary(event, alert.score || 0, language) : localizeStoredText(alert.summary, language),
    reasons: alert.event ? reasonsFor(event, language) : (alert.reasons || []).map((reason) => localizeStoredText(reason, language)),
    event
  };
}

function localizeSourceLabel(source, language = currentLanguage()) {
  const value = String(source || "");
  if (language === "en") return value;
  const map = {
    manual_test: "手动测试",
    simulation: "模拟数据",
    coingecko: "CoinGecko",
    cryptopanic: "CryptoPanic",
    defillama: "DefiLlama",
    x_recent_search: "X 最近搜索",
    etherscan: "Etherscan",
    moralis_streams_simulator: "Moralis 模拟器",
    alchemy_notify_simulator: "Alchemy 模拟器",
    defillama_simulator: "DefiLlama 模拟器",
    cryptopanic_simulator: "CryptoPanic 模拟器",
    web3_news: "Web3新闻",
    x_api_simulator: "X 模拟器",
    x_test: "X 测试",
    alchemy_notify: "Alchemy 通知",
    moralis_streams: "Moralis 流"
  };
  return map[value] || value;
}

function localizeWatchlistRecord(watchlist, language = currentLanguage()) {
  return {
    ...watchlist,
    keywords: watchlist.keywords.map((keyword) => localizeKeywordTerm(keyword, language)),
    wallets: watchlist.wallets.map((wallet) => ({ ...wallet, label: localizeStoredText(wallet.label, language) }))
  };
}

function localizeConnectorMessage(message, language = currentLanguage()) {
  return localizeStoredText(message, language)
    .replace(/English/g, language === "zh" ? "英文" : "English")
    .replace(/中文/g, language === "en" ? "Chinese" : "中文");
}

function publicState() {
  const language = currentLanguage();
  return {
    settings: { ...state.settings, language: "zh" },
    capabilities: {
      aiContent: Boolean(process.env.OPENAI_API_KEY)
    },
    watchlist: localizeWatchlistRecord(state.watchlist, language),
    metrics: state.metrics,
    market,
    alerts: state.alerts.slice(0, 30).map((alert) => localizeAlertRecord(alert, language)),
    events: state.normalizedEvents.slice(0, 60).map((event) => localizeEventRecord(event, language)),
    web3News: web3NewsEvents().slice(0, 20),
    regulationItems: regulationItems(language).slice(0, 100),
    unlockEvents: unlockEventsForDisplay().slice(0, 100),
    whaleTransfers: whaleTransfers().slice(0, 20).map((event) => localizeEventRecord(event, language)),
    journal: getJournal().slice(0, 200),
    journalStats: journalStats(),
    exchangeAnnouncements: localizedExchangeAnnouncements(language).slice(0, 80),
    listingRace: listingRace(language).slice(0, 100),
    campaignFrequency: campaignFrequencyComparison(language),
    campaigns: getCampaigns(language).slice(0, 200),
    feedback: state.feedback.slice(0, 20),
    connectors: [
      { name: "Alchemy Notify", status: "ready", mode: process.env.ALCHEMY_SIGNING_KEY ? "live" : "simulated" },
      { name: "Moralis Streams", status: "ready", mode: process.env.MORALIS_STREAM_SECRET ? "live" : "simulated" },
      { name: "CoinGecko", status: "ready", mode: process.env.COINGECKO_API_KEY ? "pro_api" : "public_api" },
      { name: "CryptoPanic", status: "ready", mode: process.env.CRYPTOPANIC_API_KEY ? "live_api" : "needs_key" },
      { name: "DefiLlama", status: "ready", mode: "public_api_ready" },
      { name: "X KOL", status: "ready", mode: process.env.X_BEARER_TOKEN ? "live_api" : "needs_key" },
      { name: "Etherscan Whales", status: "ready", mode: process.env.ETHERSCAN_API_KEY ? "live_api" : "needs_key" }
    ].map((connector) => {
      const key = connector.name.startsWith("X ") ? "x" : connector.name.startsWith("Etherscan") ? "etherscan" : connector.name.split(" ")[0].toLowerCase();
      const health = state.connectorHealth[key] || {};
      return {
        ...connector,
        status: health.ok === false ? "error" : connector.status,
        message: localizeConnectorMessage(health.message || "", language),
        checkedAt: health.checkedAt || "",
        docs: connectorDocs[key] || ""
      };
    }),
    exchangeSources: exchangeSources.map((source) => {
      const health = state.connectorHealth[source.id] || {};
      return {
        ...source,
        status: health.ok === false ? "error" : "ready",
        message: localizeConnectorMessage(health.message || "", language),
        checkedAt: health.checkedAt || ""
      };
    })
  };
}

function serveStatic(req, res, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(publicDir, requested));
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const ext = path.extname(filePath);
  res.writeHead(200, { "content-type": contentTypes[ext] || "application/octet-stream" });
  createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url.pathname);
      return;
    }
    serveStatic(req, res, url.pathname);
  } catch (error) {
    json(res, 500, { error: "internal_error", message: error.message });
  }
});

setInterval(() => {
  updateJournalOutcomes().catch((error) => connectorFail("journal", error));
}, 5 * 60 * 1000).unref();

server.listen(port, () => {
  console.log(`Web3 Ops Console running at http://localhost:${port}`);
});
