# Web3 Ops Console · Final Sites Release Acceptance

日期：2026-09-24（Asia/Bangkok）。本文件记录本轮实际验证结果。Git commit 无法在自己的内容中记录自身 SHA；下方为经验证的实现提交，包含本文件的最终提交 SHA 请以 GitHub `main` 为准。

## GitHub

- Repository: https://github.com/levibuilds/web3-ops-console
- Branch / default branch: `main`
- Verified implementation commit: `d169b0978382e5c432ea20b037cb12bbc43d3ecf`
- Visibility: Public；沿用现有仓库与历史，没有新建第二个仓库或强制推送。
- Local path: `/Users/levi/Downloads/交易所工作台/web3-ops-console`

## Snapshot

- File: [public/production-snapshot.json](../public/production-snapshot.json)
- Collected: `2026-09-23T22:40:29.339Z`（曼谷时间 2026-09-24 05:40）
- Announcements: **34**；verified exchange sources: **4**（Binance 20、Bitget 10、Bybit 3、OKX 1）
- Campaign records: **20**；structured campaign records: **17**
- Public snapshot contains no demo records. Archived demo fixtures live only in [docs/archive](./archive/README.md).
- Collection: **on demand only**. Static Sites does not collect automatically. `npm run refresh-snapshot` and the manual GitHub Action provide a validated refresh path; no cron schedule is configured.

## Security

- The Node `SNAPSHOT_MODE=1` API rejects all non-GET requests and `?push` GET requests with HTTP 403. Sites deploys static assets only, with no write API or SQLite writer.
- Alchemy and Moralis webhooks reject requests without a configured secret; valid and invalid signatures are covered by integration tests. `No secret = webhook disabled`.
- `.env`, local SQLite, logs and `node_modules` are excluded from Git. Gitleaks current/staged scan: **0 findings**. Historical scan's one finding is a documented false positive across an empty example key and a boolean setting; no real secret was identified.
- The Sites bundle contains only `index.html`, browser JS/CSS, favicon, snapshot JSON and hosting metadata. No model or notification credentials are required.
- Unauthenticated requests to the published Sites URL returned HTTP 403 for `/api/sync`, `/api/settings`, `/api/ingest`, `/api/webhooks/alchemy`, and `/api/daily-report?push=1`.

## AI / Notifications

- OpenAI remains optional in the full Node service; the public snapshot and rules brief do not call a model. **DeepSeek is not used.** Real model call: **NOT TESTED** (no server credential configured).
- Feishu and WeCom mock notification test: **PASS**. Real notification delivery: **NOT TESTED**. Sites cannot send notifications.

## Tests and interaction checks

- Node `v22.23.1`, npm `10.9.8`.
- `npm ci`: success, npm reported 0 vulnerabilities. `npm run check`: PASS. `npm test`: **19 passed / 0 failed**. `npm run build:showcase`: PASS. `git diff --check`: PASS. No `lint` script exists.
- GitHub Actions CI for implementation commit `d169b09`: **success**. GitHub repository Homepage metadata was updated to the Sites URL.
- Published Sites and local static showcase: Overview 34/4/20/17 from JSON; Campaign Radar filter for Binance returned 18 linked records locally; published keyword search for “Binance” returned 17 results; published saved rules brief opened; published mobile width 390 px had no page overflow.
- Browser loaded `/styles.css`, `/app.js`, and `/production-snapshot.json` only; it did not call the operational `/api/*` endpoints.

## Sites

- Existing Sites project reused: `appgprj_6ab45252471881919a13b36a9ce430f2`. Project title and slug updated to Web3 Ops Console.
- URL: https://web3-ops-console.levi3399.chatgpt.site
- Publish status: **PUBLISHED**；Sites deployment `appgdep_6ab46bda4f388191bd3c663d1b4a3fc8` returned `succeeded` with this URL
- Public access: **PASS**；Sites access mode is `public`
- Anonymous access checked: **PASS (unauthenticated HTTP)**；without cookies or Authorization, public homepage, JSON, JavaScript, CSS, and favicon returned HTTP 200. A separate private-browser session was not available.
- The public version is a static read-only snapshot application. It requires no VPS, running laptop, SQLite persistence, model key, webhook, or scheduled collector.

## Screenshots

The following four screenshots were taken from the published Sites URL.

- [Sites Overview desktop](./screenshots/sites-public-overview-desktop.png)
- [Sites Overview mobile](./screenshots/sites-public-overview-mobile.png)
- [Sites Search](./screenshots/sites-public-search.png)
- [Sites Reports](./screenshots/sites-public-reports.png)

## Remaining issues

- Requested brand PNG assets were not present in the workspace; the existing W3 favicon remains a placeholder. Actual product screenshots are used instead.
- All 20 configured exchanges are not verified data sources. The current published snapshot has four verified sources; other sources and connectors are not represented as live.
- Live model calls, real notifications, and continuous collection were not tested or enabled for the public version.
