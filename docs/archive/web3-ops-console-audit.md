# Web3 Ops Console 源码与验证审计（2026-09-24）

> 这是早期演示模式的审计记录；当前公开快照与发布验收以 [ACCEPTANCE.md](../ACCEPTANCE.md) 为准。

- 仓库：`levibuilds/web3-ops-console`；本轮基线 HEAD：`e4d5eb3db6e59e7f2b08e69af89593dbabe37c51`，分支 `main`。
- 对象：交易所与 Web3 运营人员；问题是竞品公告、活动记录与日报分散在多处，难以核验和检索。
- 工作流：查看竞品公告 → 按交易所筛选 → 检索公告/活动/事件 → 生成规则汇总日报 → 核验原文。

| 能力 | 源码实现 | 本轮运行验证 | 数据性质与边界 |
| --- | --- | --- | --- |
| 20 所交易所来源 | `src/server.mjs` 的 `exchangeSources`、`syncExchangeAnnouncements` | 只验证配置和演示 API；未逐所真实采集 | 20 是配置数量，不是成功数量。 |
| 公告分类与上币对比 | `classifyAnnouncement`、`listingRace` | 本地演示接口与界面通过 | 按公告发布时间和市场类型比较；实际交易开放时间未知，缺失公告不等于未上线。 |
| 活动情报与检索 | `parseCampaign`、`searchMemory`、`public/app.js` | 演示活动、筛选、搜索通过 | 本地存 SQLite；Sites 静态审查仅用明确标注的样例快照。检索是关键词/SQLite LIKE，不是向量 RAG。 |
| 运营日报 | `dailyReport`、`weeklyReport` | 演示模式下规则日报通过 | 可选 OpenAI 润色未真实调用；未验证的市场价显示“未验证”。 |
| 告警、通知 | `ingest`、`deliverAlert`、`sendTelegram`/`sendFeishu`/`sendWecom`/`sendDiscord` | 原有通知 mock 测试通过；真实投递未测试 | 演示模式服务端禁止真实投递。 |
| 外部采集与模型 | `fetchWithRetry`、`sync*`、`attachAiAnalysis`、`polishDailyReport` | 演示模式网络阻断测试通过；真实外部调用未测 | 密钥可选，仅放服务端；配置不代表成功。规则与可选模型分别负责分类/汇总和翻译/润色/部分研判。 |
| 持久化与定时器 | `better-sqlite3` + `data/app.db`、`data/state.json`，5 分钟 journal 定时器 | 独立演示目录重启后记录保留 | 原生 SQLite 和本地文件不能原样迁入 Sites D1；定时器不是可靠的云调度。 |

演示截图：`docs/screenshots/local-exchanges-2026-09-24.png`、`local-campaigns-2026-09-24.png`、`local-daily-2026-09-24.png`。本机 `DEMO_MODE=1`、独立 `DATA_DIR`、`127.0.0.1:4173` 运行后截取。所有样例无真实公告原文链接。

本轮基线 `npm run check` 与 `npm test` 为 13/13 通过；增量后为 14/14 通过。新增测试覆盖实际服务路径上的演示数据持久化、外部采集与收费模型/通知阻断。尚未验证真实模型、20 所稳定采集、调度连续性、真实通知投递、真实用户数与业务效果。需 Levi 补充本人职责、项目演化关系及可公开的业务结果证据。
