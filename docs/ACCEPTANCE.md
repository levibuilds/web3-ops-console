# Web3 Ops Console · GitHub 发布验收

验收日期：2026-09-24（Asia/Bangkok）。本文件记录实际执行结果。由于 Git commit 不能在自身内容中记录自身 SHA，下面的 SHA 是已验证的**代码提交**；包含本文件的最终 `main` SHA 以 GitHub `main` 和交付摘要为准。

## Repository

- GitHub URL: https://github.com/levibuilds/web3-ops-console
- Visibility: **Public**（GitHub API 已核对）
- 唯一远端：`origin` → `https://github.com/levibuilds/web3-ops-console.git`
- 沿用已有仓库和历史，没有新建重复仓库，也没有强制推送。

## Commit / Branch / Local path

- 已验证代码提交：`3887fd89a6942eb7b6345eeb0d571573dd2cfdaf`
- Branch / default branch: `main`
- 本地工程：`/Users/levi/Downloads/交易所工作台/web3-ops-console`

## Runtime / Commands

- Node.js `v22.23.1`；npm `10.9.8`。
- 已实际执行：`npm ci`、`npm run check`、`npm test`、`git diff --check`、Gitleaks 当前目录/暂存文件/历史扫描、GitHub API 与公开原始文件检查。
- `package.json` 没有 `lint` script，因此无单独 lint 结果。
- 已实际启动 `HOST=127.0.0.1 PORT=4178 SNAPSHOT_MODE=1 npm run dev`，本地入口：`http://127.0.0.1:4178/`。该本机地址不是公网部署。

## Tests

- `npm ci`：成功；39 个依赖包完成审计，npm 报告 0 vulnerabilities。
- `npm run check`：通过。
- `npm test`：**15 passed / 0 failed**。原先通知测试固定使用 4193 端口，与已运行的 Levi Labs 本地服务冲突；改为自动选择空闲端口后整套重跑通过。
- GitHub Actions `CI`：代码提交 `3887fd8` 的工作流完成，结论 **success**。

## Features checked

| 项目 | 结果 | 证据 / 限制 |
| --- | --- | --- |
| Overview | PASS | 本地首页 HTTP 200，实际运行截图；显示来源数量、公告数量和快照时间。 |
| Search | PASS | `/api/search` HTTP 200，浏览器搜索交互及截图已核对。 |
| Reports | PASS | `/api/daily-report` HTTP 200；这是已保存记录的规则版快照简报，不是模型生成。 |
| Data snapshot | PASS | `/api/state` HTTP 200，34 条公告、20 条活动记录（17 条已结构化），模式为 `snapshot`；同步 POST 返回 403。 |
| Assets | PASS / 部分缺失 | 实际产品截图及临时 W3 favicon 可访问；指定品牌资源包的四张 PNG 本机未找到，正式 Logo 未验收。 |
| README | PASS | 英文和中文 README 公开原始链接 HTTP 200，案例、截图相对路径可访问。 |
| Mobile | PASS | 390/360 像素宽度浏览器布局已检查，无页面横向溢出；390 像素截图已保存。 |
| API / static files | PASS | `/api/health`、`/api/campaigns`、`/app.js`、`/styles.css`、`/favicon.svg` 均 HTTP 200；快照写入被服务端拒绝。 |
| Real model call | NOT TESTED | 无服务端模型凭证，本轮没有声称 Bot 或日报的真实模型调用通过。 |
| Real notifications / continuous scheduler | NOT TESTED | 通知 mock 测试通过；快照模式禁止真实通知和自动采集。 |

## Data

- [公开快照](../public/production-snapshot.json)采集时间：`2026-09-23T22:40:29.339Z`（曼谷时间 2026-09-24 05:40）。
- 来源：项目原有 Binance、Bitget、Bybit 公告 API，以及 OKX 带日期的公告列表页。去重后 Binance 20、Bitget 10、Bybit 3、OKX 1；从已收录公告整理 20 条活动记录，其中 17 条完成结构化识别。原始标题、来源 URL、发布时间、抓取时间保留在数据中。
- 公开快照**不含 mock 记录**；单独的 [`site-demo-state.json`](./archive/site-demo-state.json) 是显式标注的演示样例，未作为本次 README 的真实数据证据。
- 当前快照不会持续实时更新。源码配置 20 个交易所来源，不等于 20 个已验证成功采集。通用网页抓取和新闻兜底结果因识别/时间问题没有进入公开快照。

## Security

- `.env` 不存在且受 `.gitignore` 排除；本地 SQLite `data/`、日志、缓存、`node_modules/` 未提交。公开的是经检查的 JSON 快照，不是整个数据库。
- Gitleaks 对当前工作区和暂存内容均为 **0 findings**；另对历史 Git blobs 与当前文件做了多类敏感模式扫描。
- Gitleaks 历史扫描有 **1 个误报**：旧提交的 `.env.example` 中空的 `CRYPTOPANIC_API_KEY=` 与下一行 `DEFILLAMA_ENABLED=true` 被跨行识别为 generic API key；并无密钥值。当前 `.env.example` 已调整，历史未改写。未发现真实 API key、token、私钥、seed phrase 或私人 webhook。
- 截图经人工查看为公开产品界面；没有把概念视觉标成真实运行截图。

## GitHub

- 仓库： https://github.com/levibuilds/web3-ops-console
- 账号身份：`levibuilds`；具备 push 权限。
- `main` 为默认分支；仓库为 Public。
- 代码提交 `3887fd89a6942eb7b6345eeb0d571573dd2cfdaf` 已实际推送并由 GitHub API 核对；GitHub `pushed_at` 为 `2026-09-23T23:33:47Z`。本验收文件的后续文档提交会形成新的最终 SHA。
- Description：`A Web3 exchange operations intelligence console for announcements, campaigns, market signals and operations briefs.`
- Topics：`ai`、`crypto`、`dashboard`、`exchange`、`intelligence`、`operations`、`product`、`web3`。
- README 中文入口和公开截图原始 URL 均已检查，返回 HTTP 200。`package.json` repository 指向本仓库。

## Screenshots

- [Overview desktop](./screenshots/overview-viewport-1440.png)
- [Intelligence](./screenshots/intelligence-production-1440.png)
- [Campaigns](./screenshots/campaigns-production-1440.png)
- [Reports](./screenshots/reports-production-1440.png)
- [Search](./screenshots/search-production-1440.png)
- [Overview mobile](./screenshots/overview-production-390.png)
- [Levi Labs 案例入口](./screenshots/levi-ops-case-1440.png)

## Remaining Issues

- 用户之前提供的视觉资源包在当前机器未找到，因此真实品牌 Logo、emblem、icon pack、hero concept 尚未入库；当前 W3 图标是临时占位。
- 此次完成 GitHub 源码发布，**未完成 Sites 或其他公网服务部署**。本机运行地址不能用于远程访问。
- 真实模型问答、真实通知投递、持续调度和全部 20 个配置来源的稳定采集未通过本轮验收；不能据此宣称 24/7 实时运行。
- 旧版 [演示模式审计](./archive/web3-ops-console-audit.md) 与 [本地展示记录](./archive/job-showcase-report.md) 是历史过程文件；当前公开状态以本文件及主分支代码为准。
