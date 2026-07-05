# Web3 Ops Console

[English README](./README.md)

面向交易所/Web3 项目方运营团队的 AI 运营操作台：竞品情报、Web3 大事件、运营日报、活动情报库。

> 寻求 Web3 运营 / AI 运营相关机会。联系入口：[@levi2277999-gif](https://github.com/levi2277999-gif)

> 数据仅供运营研究，不构成投资建议。

## 运营场景

```text
盯竞品 -> 看大事件 -> 读日报 -> 扒活动
```

## 架构

```text
交易所公告 / Web3 新闻 / CoinGecko / DefiLlama / X / Etherscan / 回调
        -> 采集
        -> 标准化
        -> 分类
        -> 告警
        -> Web3大事件 / 运营日报 / 活动库 / 竞品情报
```

## 截图

稍后补图：

- `docs/screenshots/web3-news.png`
- `docs/screenshots/competitor-intel.png`
- `docs/screenshots/daily-brief.png`
- `docs/screenshots/campaign-library.png`

## 功能

- Web3 大事件：每天自动汇总最重要的 20 条 Web3 新闻。
- 20 所交易所公告聚合：覆盖 Binance、OKX、Bybit、Bitget 等主流平台。
- 公告自动分类：新币上线、交易大赛、充值赠币、Launchpool、学习赚币、新手任务、合约与费率变更、维护、下架、其他。
- 上币竞速表：对比同一代币在多所的上线时间，识别谁先上。
- 关键词订阅：命中后生成站内运营告警。
- 运营晨报：市场概况、20 所重点动态、大额链上异动、今日关注建议。
- 活动情报库：保留中文活动标题、交易所、活动类型、涉及代币、时间和原文链接。
- 舆情雷达：X/KOL 与品牌词监控，负面高热内容触发告警。
- SQLite 持久化、GitHub Actions CI、Dockerfile、部署文档。

## 快速开始

```bash
npm install
cp .env.example .env
npm run dev
```

打开：

```text
http://localhost:4173
```

没有接口密钥时会明确显示模拟数据模式。

## API

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/state` | 前端状态聚合 |
| `POST` | `/api/sync` | 同步真实数据源 |
| `POST` | `/api/sync-web3-news` | 同步 Web3 大事件 |
| `GET` | `/api/web3-news` | 今日 Web3 大事件 |
| `POST` | `/api/sync-exchanges` | 同步交易所公告 |
| `GET` | `/api/exchange-announcements` | 已分类竞品公告 |
| `GET` | `/api/listing-race` | 上币竞速表 |
| `GET` | `/api/campaigns` | 活动情报库 |
| `GET` | `/api/daily-report` | 24 小时运营晨报 |
| `GET` | `/api/weekly-report` | 运营周报 |
| `POST` | `/api/ingest` | 写入单条事件 |

## Roadmap

- 补充截图和公开演示。
- 从公告正文进一步解析活动起止时间。
- 增强中文标题翻译和活动类型识别。
- 针对品牌和地区扩展舆情词典。

## License

MIT
