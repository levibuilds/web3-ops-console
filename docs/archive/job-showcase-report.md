# Web3 Ops Console 求职展示版：本地交付记录

> 本文记录 GitHub 发布前的本地交付状态；发布验收以 [ACCEPTANCE.md](../ACCEPTANCE.md) 为准。

日期：2026-09-24（Asia/Bangkok）

## 当前入口

- 工作台只读快照：[http://127.0.0.1:4178/](http://127.0.0.1:4178/)
- Levi Labs 三产品区：[http://127.0.0.1:4193/levi/?opsDemo=4178#projects](http://127.0.0.1:4193/levi/?opsDemo=4178#projects)
- 案例页：[http://127.0.0.1:4193/levi/projects/web3-ops-console.html?opsDemo=4178](http://127.0.0.1:4193/levi/projects/web3-ops-console.html?opsDemo=4178)

均只绑定本机。未推送 GitHub、未改生产站点或 DNS、未公开部署。

## 修改范围

- 保留原生 Node/JavaScript/CSS 和既有运营模式；新增只读快照模式。
- 重做 Overview 的视觉层级、来源时间与数量展示、情报/活动/交易所/简报入口，保留现有功能视图。
- 快照模式只返回已保存的数据、搜索和规则简报；POST 返回 403，未列出的 GET API 返回 404；内存数据库不写本地数据文件。
- Levi Labs 第三张产品卡、案例页、公开资料检索与 Bot facts 更新为真实快照口径。
- README、截图和快照导出脚本同步更新。

## 数据证据

快照文件：[../public/production-snapshot.json](../../public/production-snapshot.json)

采集时间：`2026-09-23T22:40:29.339Z`（曼谷时间 2026-09-24 05:40）。本轮使用原工程的 Binance、Bybit、Bitget 公告 API 与 OKX 带日期的公告列表，保留原始标题、来源 URL、发布时间和抓取时间。快照展示 34 条去重公告：Binance 20、Bitget 10、Bybit 3、OKX 1；从这些公告整理出 20 条活动。

第一次全量同步还返回了新闻和通用网页抓取结果，但通用抓取把页面文字推断为公告，并把抓取时间当成发布时间；新闻中文兜底标题也有人工预设。它们没有进入求职展示快照。OKX 当前指向公告列表页，其余三个来源提供文章链接。20 个配置来源不等于 20 个已验证来源。

## 验证结果

| 项目 | 结果 |
| --- | --- |
| Ops `npm run check` | 通过 |
| Ops `npm test` | 15/15 通过 |
| Labs `npm test` | 24/24 通过 |
| `git diff --check`（两个仓库） | 通过 |
| 快照状态、搜索、日报、活动 API | HTTP 200；浏览器交互通过 |
| 快照写入/同步 | HTTP 403 |
| 未列出的快照 API | HTTP 404 |
| 1440、1280、1024、768、390、360 宽度 | Overview、活动库、竞品情报无页面横向溢出 |
| Labs → 案例 → 本地工作台 | 链接和页面打开通过 |
| Bot 真模型回答 | 未通过：本地未配置模型凭证，页面明确提示不可用 |
| 真实通知 | 未验证；只读模式禁止通知 |
| 公网发布 | 未执行 |

## 实际页面截图

- [1440 Overview](../screenshots/overview-viewport-1440.png)
- [Intelligence](../screenshots/intelligence-production-1440.png)
- [Campaigns](../screenshots/campaigns-production-1440.png)
- [Reports](../screenshots/reports-production-1440.png)
- [Search](../screenshots/search-production-1440.png)
- [390 Mobile](../screenshots/overview-production-390.png)
- [Levi Labs 三产品](../screenshots/levi-three-products-1440.png)
- [案例页](../screenshots/levi-ops-case-1440.png)
- [Bot 未配置时的真实状态](../screenshots/levi-bot-ops-status-1440.png)

## 尚缺资源与后续

用户给出的 `/mnt/data/web3_ops_console_asset_pack.zip` 与 `/mnt/data/web3_ops_console_asset_pack/prompts.md` 在本机不存在；工作区、下载目录、桌面与 Codex 附件目录也未找到指定的四张 PNG。因此本轮实际使用的是产品运行截图，尚未使用 wordmark、emblem、icon pack、hero concept；当前应用图标和 favicon 是 W3 临时占位，Levi Labs 封面为真实界面截图。收到资源包后，应以原图替换这些占位视觉，并重新截图核对。

Bot facts 已更新，但真实模型问答截图需要服务端模型凭证和实际调用；不能用预设答案替代。项目仍只在本机运行，不能称为已上线。

## 启停

启动工作台：`HOST=127.0.0.1 PORT=4178 SNAPSHOT_MODE=1 npm run dev`（在 Ops 仓库）。

启动 Levi Labs：`HOST=127.0.0.1 PORT=4193 LOCAL_PREVIEW=1 npm run bot`（在 Labs 仓库）。

当前两个服务已实际启动并保持运行。停止时在对应终端按 Ctrl+C；也可查找监听 4178 和 4193 的本地进程后停止。
