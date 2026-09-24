# Web3 Ops Console · Product Case Study

## Problem

交易所运营需要跨平台跟踪公告、上币、活动、竞品变化和日报。信息分散增加了检索、核对时间与复盘成本。

## Product

Web3 Ops Console 将公开公告收录、规则分类、活动整理、关键词检索、交易所对比和运营简报放在一个工作台。它展示的是交易所运营工作流的产品化实现，不是客户数或商业成果证明。

![实际运行的 Overview](./screenshots/overview-viewport-1440.png)

## Workflow

```text
Collect → Normalize → Classify → Search / Compare → Analyze → Operations Brief
```

## Verified data

2026-09-23 22:40 UTC 的 [Operational Snapshot](../public/production-snapshot.json) 收录了 4 个交易所来源的 34 条去重公告和 20 条活动记录，其中 17 条完成结构化识别。Binance 20、Bitget 10、Bybit 3、OKX 1。来源记录保留原始标题、来源 URL、发布时间与抓取时间。OKX 链接到公告列表页，其余三个来源提供文章链接。

源码另配置 20 个来源；配置数量不等于已验证采集数量。首页不宣称实时更新，快照模式也不会重新采集或发送通知。

## Modules

公告情报、活动雷达、交易所对比、关键词搜索、规则版运营简报、优先告警、事件分析与监控列表。当前快照中没有通过核验的新闻、解锁或市场事件，因此对应模块展示空状态。原有 Node 运营模式仍保留采集、SQLite 持久化和可选通知。

## AI boundary

本轮快照的分类、检索、对比和简报由规则和数据处理完成，未调用模型。源码中的模型功能需要服务端密钥，主要用于可选翻译、日报润色和部分告警研判。

## Product screens

- [Overview](./screenshots/overview-viewport-1440.png)
- [Intelligence](./screenshots/intelligence-production-1440.png)
- [Campaigns](./screenshots/campaigns-production-1440.png)
- [Reports](./screenshots/reports-production-1440.png)
- [Search](./screenshots/search-production-1440.png)
- [Mobile](./screenshots/overview-production-390.png)

## Status and limits

Functional prototype / operational snapshot。通用网页抓取结果因公告识别和发布时间问题未进入公开快照。上币比较使用公告发布时间，不等于开放交易时间。真实通知、持续调度、模型真实调用和业务效果没有在这次公开快照验收中通过验证。
