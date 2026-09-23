import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const endpoint = process.argv[2] || "http://127.0.0.1:4177";
const url = new URL(endpoint);
if (!["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("Export only from a local collector");
const response = await fetch(new URL("/api/state", url));
if (!response.ok) throw new Error(`Collector returned ${response.status}`);
const state = await response.json();
if (state.dataMode !== "live") throw new Error("Collector must contain real records");

const trusted = new Set(["binance", "okx", "bybit", "bitget"]);
const announcements = (state.exchangeAnnouncements || [])
  .filter((item) => trusted.has(item.exchangeId) && item.url?.startsWith("https://") && item.originalTitle && item.publishedAt)
  .map((item) => ({ ...item, title: item.originalTitle }));
const ids = new Set(announcements.map((item) => item.id));
const campaigns = (state.campaigns || [])
  .filter((item) => ids.has(item.announcementId) && item.url?.startsWith("https://"))
  .map((item) => ({ ...item, title: item.originalTitle || item.title }));
const sourceIds = new Set(announcements.map((item) => item.exchangeId));
const snapshotAt = state.exchangeSources
  .filter((source) => sourceIds.has(source.id))
  .map((source) => source.checkedAt)
  .filter(Boolean).sort().at(-1);
if (!announcements.length || !snapshotAt) throw new Error("No verifiable announcement snapshot to export");

const cleanState = {
  ...state,
  dataMode: "snapshot",
  snapshotAt,
  market: {},
  watchlist: { assets: [], wallets: [], protocols: [], keywords: [], kols: [], brandTerms: [] },
  exchangeAnnouncements: announcements,
  campaigns,
  alerts: (state.alerts || []).filter((alert) => ids.has(alert.event?.announcementId)),
  events: [],
  web3News: [],
  regulationItems: [],
  unlockEvents: [],
  whaleTransfers: [],
  journal: [],
  exchangeSources: state.exchangeSources.map((source) => sourceIds.has(source.id) ? source : { ...source, status: "unverified", message: "", checkedAt: "" })
};
const listings = announcements.filter((item) => item.opsCategoryId === "listing").slice(0, 5);
const recentCampaigns = campaigns.slice(0, 5);
const lines = (items) => items.length ? items.map((item) => `- ${item.exchange}：${item.title}（${item.publishedAt.slice(0, 10)}）`).join("\n") : "- 当前快照无对应记录。";
const report = {
  report: `# Operations Brief / 运营情报简报

快照采集时间：${snapshotAt}
生成方式：规则汇总，未调用模型。公告分类需要核对原文。

## Executive Summary

已收录 ${announcements.length} 条公告，来自 ${sourceIds.size} 个有记录的交易所；结构化活动 ${campaigns.length} 条。

## Important Listings

${lines(listings)}

## Exchange Campaigns

${lines(recentCampaigns)}

## Market Events

- 本次快照未采集可核验的市场事件。

## Competitive Moves

- 按交易所和公告类别查看收录记录；数量仅代表本次采集范围。

## Risks / Watchlist

- 页面抓取来源未纳入本快照；公告时间以来源提供的发布时间为准。
- 上币公告时间不等于开放交易时间。

## Suggested Follow-ups

- 打开公告原文，核对规则、日期及适用地区后再做运营决策。`,
  generatedAt: snapshotAt,
  language: "zh",
  usedAi: false
};
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "production-snapshot.json");
await writeFile(file, JSON.stringify({ provenance: { snapshot_at: snapshotAt, trusted_source_ids: [...sourceIds], announcement_count: announcements.length, campaign_count: campaigns.length }, state: cleanState, report }, null, 2) + "\n");
console.log(JSON.stringify({ file, snapshotAt, sources: [...sourceIds], announcements: announcements.length, campaigns: campaigns.length }));
