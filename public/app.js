const state = {
  data: null,
  currentView: "overview",
  exchangeFilter: "all"
};

const copy = {
  zh: {
    nav: { overview: "总览", web3news: "Web3大事件", regulation: "监管动态", unlocks: "解锁日历", daily: "运营日报", campaigns: "活动库", watchlist: "监控列表", exchanges: "竞品情报", events: "事件流", pipeline: "处理链路", settings: "设置" },
    titles: {
      overview: ["总览", "信号、评分和数据源状态。"],
      web3news: ["Web3大事件", "每天自动汇总最重要的20条 Web3 新闻。"],
      regulation: ["监管动态", "按地区跟踪 SEC、SFC、MAS、FCA 等监管与执法变化。"],
      unlocks: ["解锁日历", "跟踪未来30天大额代币解锁和运营关注点。"],
      daily: ["运营日报", "10分钟完成市场概况、20所动态和今日关注。"],
      campaigns: ["活动情报库", "交易赛、充值赛、Launchpool 与新手任务归档。"],
      watchlist: ["监控状态", "当前运营监控范围、连接器和关键词订阅状态。"],
      exchanges: ["竞品情报", "20所公告分类、关键词命中和上币竞速。"],
      events: ["事件流", "进入告警判断前的标准化事实。"],
      pipeline: ["处理链路", "真实数据同步、回调和手动事件入口。"],
      settings: ["设置", "设置我的交易所，用于竞速、活动频次和日报对标。"]
    },
    metrics: ["已采集", "已标准化", "告警数", "打开中"],
    buttons: {
      sync: "同步真实数据",
      syncing: "同步中...",
      simulate: "载入演示剧本",
      simulating: "载入中...",
      syncExchanges: "刷新交易所公告",
      syncNews: "刷新大事件",
      syncUnlocks: "刷新解锁日历",
      refreshing: "刷新中..."
    },
    labels: {
      alerts: "优先告警",
      signals: "信号分布",
      assets: "资产",
      protocols: "协议",
      keywords: "关键词",
      wallets: "钱包",
      kols: "X 币圈意见领袖",
      brands: "品牌词",
      whales: "巨鲸转账",
      saveWatchlist: "保存监控列表",
      table: ["时间", "类型", "资产", "规模", "路径", "来源"],
      pipeline: ["采集", "标准化", "补全", "评分", "研判", "推送"],
      manual: "手动写入事件",
      ingestJson: "写入事件数据"
    },
    daily: { heading: "运营晨报", generate: "生成晨报", weekly: "生成周报", copy: "复制", empty: "点击生成晨报，自动汇总过去24小时市场、20所动态和链上异动。" },
    web3news: { heading: "今日 Web3 大事件", empty: "暂无今日 Web3 新闻，点击刷新大事件获取最新内容。" },
    regulation: { heading: "监管动态雷达", empty: "暂无监管动态。同步新闻、公告或手动写入 SEC 诉讼等事件后会出现在这里。" },
    unlocks: { heading: "解锁日历", empty: "暂无未来30天解锁数据。数据源不可用时会自动降级为空状态。", week: "未来7天解锁分布" },
    campaigns: { heading: "活动情报库", allExchanges: "全部交易所", allTypes: "全部类型", empty: "暂无活动。同步交易所公告后会自动结构化入库。", calendar: "本周/下周活动分布", heads: ["交易所", "类型", "代币", "时间", "活动标题"] },
    listingRace: "上币公告时间对比",
    frequency: "近30天活动频次对比",
    monitorCards: ["交易所源", "关键词订阅", "品牌词", "X 意见领袖"],
    alertsVisible: (count) => `${count} 条`,
    noAlerts: "暂无告警。可以同步真实数据、生成模拟数据，或手动写入事件。",
    noEvents: "暂无事件。",
    noSignals: "暂无信号分布。",
    noWhales: "暂无巨鲸转账。接入 Alchemy 或 Moralis 回调，或配置 Etherscan 密钥后会自动进入这里。",
    filterAllAssets: "全部资产",
    filterAllTypes: "全部类型",
    noAnnouncements: "暂无交易所公告。点击刷新交易所公告获取最新活动。",
    typeLabels: {
      large_transfer: "巨鲸转账",
      dex_swap: "去中心化交易所大额兑换",
      protocol_tvl_change: "协议总锁仓量异动",
      social_spike: "社交 / 意见领袖动态",
      news: "新闻",
      market_move: "市场价格异动",
      security_signal: "安全信号",
      unknown: "未知"
    },
    all: "全部",
    ready: "就绪",
    error: "异常",
    needsKey: "待配置",
    announcement: "公告",
    listingRaceHeads: ["代币", "最早公告", "我所公告时差"],
    modes: { live_api: "实时接口", live: "实时", pro_api: "专业接口", public_api: "公开接口", public_api_ready: "公开接口就绪", needs_key: "待配置密钥", simulated: "模拟" },
    monitorOn: "运行",
    monitorWait: "等待",
    disclaimer: "数据仅供研究，不构成投资建议。",
    demoMode: "模拟数据模式",
    liveMode: "实时数据模式"
  }
};

const samplePayload = {
  source: "manual_test",
  type: "large_transfer",
  chain: "ethereum",
  asset: "ETH",
  amountUsd: 7200000,
  from: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  to: "0x28C6c06298d514Db089934071355E5743bf21d60",
  txHash: "0x..."
};

document.addEventListener("DOMContentLoaded", () => {
  bindNavigation();
  document.querySelectorAll("[data-jump]").forEach((button) => button.addEventListener("click", () => {
    document.querySelector(`.nav-item[data-view="${button.dataset.jump}"]`)?.click();
  }));
  document.getElementById("refresh-btn").addEventListener("click", load);
  document.getElementById("sync-btn").addEventListener("click", syncLive);
  document.getElementById("sync-exchanges-btn").addEventListener("click", syncExchanges);
  document.getElementById("sync-news-btn").addEventListener("click", syncWeb3News);
  document.getElementById("sync-unlocks-btn").addEventListener("click", syncUnlocks);
  document.getElementById("simulate-btn").addEventListener("click", simulate);
  document.getElementById("watchlist-form").addEventListener("submit", saveWatchlist);
  document.getElementById("settings-form").addEventListener("submit", saveSettings);
  document.getElementById("global-search-form").addEventListener("submit", globalSearch);
  document.getElementById("regulation-region-filter").addEventListener("change", renderRegulation);
  document.getElementById("manual-form").addEventListener("submit", ingestManual);
  document.getElementById("generate-report-btn").addEventListener("click", generateDailyReport);
  document.getElementById("generate-weekly-btn").addEventListener("click", generateWeeklyReport);
  document.getElementById("copy-report-btn").addEventListener("click", copyDailyReport);
  document.getElementById("campaign-exchange-filter").addEventListener("change", renderCampaigns);
  document.getElementById("campaign-type-filter").addEventListener("change", renderCampaigns);
  document.getElementById("manual-json").value = JSON.stringify(samplePayload, null, 2);
  load();
});

function bindNavigation() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.view;
      state.currentView = view;
      document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item === button));
      document.querySelectorAll(".view").forEach((item) => item.classList.remove("active"));
      document.getElementById(`${view}-view`).classList.add("active");
      updateStaticText();
    });
  });
}

function lang() {
  return "zh";
}

function t() {
  return copy[lang()];
}

async function load() {
  const response = await fetch("/api/state");
  state.data = await response.json();
  render();
}

async function simulate() {
  const button = document.getElementById("simulate-btn");
  button.disabled = true;
  button.textContent = t().buttons.simulating;
  try {
    const response = await fetch("/api/simulate", { method: "POST" });
    const payload = await response.json();
    state.data = payload.state;
    render();
  } finally {
    button.disabled = false;
    button.textContent = t().buttons.simulate;
  }
}

async function syncLive() {
  const button = document.getElementById("sync-btn");
  button.disabled = true;
  button.textContent = t().buttons.syncing;
  try {
    const response = await fetch("/api/sync", { method: "POST" });
    const payload = await response.json();
    state.data = payload.state;
    render();
  } finally {
    button.disabled = false;
    button.textContent = t().buttons.sync;
  }
}

async function syncExchanges() {
  const button = document.getElementById("sync-exchanges-btn");
  button.disabled = true;
  button.textContent = t().buttons.refreshing;
  try {
    const response = await fetch("/api/sync-exchanges", { method: "POST" });
    const payload = await response.json();
    state.data = payload.state;
    render();
  } finally {
    button.disabled = false;
    button.textContent = t().buttons.syncExchanges;
  }
}

async function syncWeb3News() {
  const button = document.getElementById("sync-news-btn");
  button.disabled = true;
  button.textContent = t().buttons.refreshing;
  try {
    const response = await fetch("/api/sync-web3-news", { method: "POST" });
    const payload = await response.json();
    state.data = payload.state;
    render();
  } finally {
    button.disabled = false;
    button.textContent = t().buttons.syncNews;
  }
}

async function syncUnlocks() {
  const button = document.getElementById("sync-unlocks-btn");
  button.disabled = true;
  button.textContent = t().buttons.refreshing;
  try {
    const response = await fetch("/api/sync-unlocks", { method: "POST" });
    const payload = await response.json();
    state.data = payload.state;
    render();
  } finally {
    button.disabled = false;
    button.textContent = t().buttons.syncUnlocks;
  }
}

async function generateDailyReport() {
  const button = document.getElementById("generate-report-btn");
  button.disabled = true;
  button.textContent = t().buttons.syncing;
  try {
    const response = await fetch(`/api/daily-report?lang=${lang()}`);
    const payload = await response.json();
    document.getElementById("daily-report-preview").textContent = payload.report;
  } finally {
    button.disabled = false;
    button.textContent = t().daily.generate;
  }
}

async function generateWeeklyReport() {
  const button = document.getElementById("generate-weekly-btn");
  button.disabled = true;
  button.textContent = t().buttons.syncing;
  try {
    const response = await fetch(`/api/weekly-report?lang=${lang()}`);
    const payload = await response.json();
    document.getElementById("daily-report-preview").textContent = payload.report;
  } finally {
    button.disabled = false;
    button.textContent = t().daily.weekly;
  }
}

async function copyDailyReport() {
  await navigator.clipboard.writeText(document.getElementById("daily-report-preview").textContent || "");
}

async function saveWatchlist(event) {
  event.preventDefault();
  const wallets = document
    .getElementById("wallets-input")
    .value.split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [address, ...label] = line.split(",");
      return { address: address.trim(), label: label.join(",").trim() };
    });

  const watchlist = {
    assets: linesOrComma("assets-input"),
    protocols: linesOrComma("protocols-input"),
    keywords: linesOrComma("keywords-input"),
    wallets,
    kols: linesOrComma("kols-input"),
    brandTerms: linesOrComma("brands-input")
  };

  const response = await fetch("/api/watchlist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ watchlist })
  });
  const payload = await response.json();
  state.data.watchlist = payload.watchlist;
  hydrateWatchlist();
}

async function saveSettings(event) {
  event.preventDefault();
  const myExchangeId = document.getElementById("my-exchange-select").value;
  const response = await fetch("/api/settings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ myExchangeId })
  });
  const payload = await response.json();
  state.data = payload.state;
  render();
}

async function globalSearch(event) {
  event.preventDefault();
  const q = document.getElementById("global-search-input").value.trim();
  const panel = document.getElementById("global-search-results");
  if (!q) {
    panel.classList.add("hidden");
    panel.innerHTML = "";
    return;
  }
  const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
  const payload = await response.json();
  renderSearchResults(payload.groups || {});
}

async function ingestManual(event) {
  event.preventDefault();
  const body = JSON.parse(document.getElementById("manual-json").value);
  await fetch("/api/ingest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  await load();
}

function linesOrComma(id) {
  return document
    .getElementById(id)
    .value.split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function render() {
  if (!state.data) return;
  updateStaticText();
  renderMetrics();
  renderOverview();
  renderMonitorStatus();
  renderWeb3News();
  renderRegulation();
  renderUnlocks();
  renderCampaigns();
  renderAlerts();
  renderEvents();
  renderMix();
  renderWhaleTransfers();
  renderConnectors();
  renderExchangeAnnouncements();
  hydrateWatchlist();
  hydrateSettings();
}

function updateStaticText() {
  const language = lang();
  const text = t();
  document.documentElement.lang = "zh-CN";
  document.getElementById("disclaimer").textContent = text.disclaimer;
  const mode = state.data.dataMode || "empty";
  const live = mode === "live";
  const badge = document.getElementById("mode-badge");
  badge.textContent = { demo: "演示数据模式", mixed: "混合数据模式", live: "已采集数据", snapshot: "Operational Snapshot", empty: "暂无采集数据" }[mode];
  badge.classList.toggle("live", live || mode === "snapshot");
  for (const id of ["sync-btn", "sync-exchanges-btn", "sync-news-btn", "sync-unlocks-btn"]) document.getElementById(id).hidden = mode === "demo" || mode === "snapshot";
  document.getElementById("simulate-btn").hidden = mode !== "demo" || Boolean(window.SITES_REVIEW);
  document.getElementById("sync-btn").textContent = text.buttons.sync;
  document.getElementById("simulate-btn").textContent = text.buttons.simulate;
  document.getElementById("sync-exchanges-btn").textContent = text.buttons.syncExchanges;
  document.getElementById("sync-news-btn").textContent = text.buttons.syncNews;
  document.getElementById("sync-unlocks-btn").textContent = text.buttons.syncUnlocks;
  document.getElementById("alerts-heading").textContent = text.labels.alerts;
  document.getElementById("signal-heading").textContent = text.labels.signals;
  document.getElementById("assets-label").textContent = text.labels.assets;
  document.getElementById("protocols-label").textContent = text.labels.protocols;
  document.getElementById("keywords-label").textContent = text.labels.keywords;
  document.getElementById("wallets-label").textContent = text.labels.wallets;
  document.getElementById("kols-label").textContent = text.labels.kols;
  document.getElementById("brands-label").textContent = text.labels.brands;
  document.getElementById("whale-heading").textContent = text.labels.whales;
  document.getElementById("save-watchlist-btn").textContent = text.labels.saveWatchlist;
  ["th-time", "th-type", "th-asset", "th-value", "th-path", "th-source"].forEach((id, index) => {
    document.getElementById(id).textContent = text.labels.table[index];
  });
  ["pipe-ingest", "pipe-normalize", "pipe-enrich", "pipe-score", "pipe-analyze", "pipe-deliver"].forEach((id, index) => {
    document.getElementById(id).textContent = text.labels.pipeline[index];
  });
  document.getElementById("manual-heading").textContent = text.labels.manual;
  document.getElementById("manual-submit-btn").textContent = text.labels.ingestJson;
  document.getElementById("daily-heading").textContent = text.daily.heading;
  document.getElementById("web3news-heading").textContent = text.web3news.heading;
  document.getElementById("regulation-heading").textContent = text.regulation.heading;
  document.getElementById("unlocks-heading").textContent = text.unlocks.heading;
  document.getElementById("generate-report-btn").textContent = mode === "snapshot" ? "查看快照简报" : window.SITES_REVIEW ? "查看演示日报快照" : text.daily.generate;
  document.getElementById("generate-weekly-btn").textContent = text.daily.weekly;
  document.getElementById("generate-weekly-btn").hidden = mode === "snapshot";
  document.getElementById("watchlist-form").querySelector("button[type=submit]").hidden = mode === "snapshot";
  document.getElementById("settings-form").querySelector("button[type=submit]").hidden = mode === "snapshot";
  document.getElementById("manual-form").hidden = mode === "snapshot";
  document.getElementById("copy-report-btn").textContent = text.daily.copy;
  document.getElementById("campaigns-heading").textContent = text.campaigns.heading;
  ["campaign-th-exchange", "campaign-th-type", "campaign-th-token", "campaign-th-time", "campaign-th-title"].forEach((id, index) => {
    document.getElementById(id).textContent = text.campaigns.heads[index];
  });
  document.getElementById("listing-race-heading").textContent = text.listingRace;
  document.getElementById("settings-heading").textContent = "设置";
  if (!document.getElementById("daily-report-preview").textContent.trim()) {
    document.getElementById("daily-report-preview").textContent = mode === "snapshot" ? "点击查看基于已收录公告生成的规则版快照简报。" : window.SITES_REVIEW ? "点击查看按演示数据生成的静态日报快照。" : text.daily.empty;
  }
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.textContent = text.nav[button.dataset.view];
  });
  document.getElementById("view-title").textContent = text.titles[state.currentView][0];
  document.getElementById("view-subtitle").textContent = state.currentView === "overview" ? "交易所运营情报与工作流中枢" : text.titles[state.currentView][1];
}

function renderMetrics() {
  const announcements = state.data.exchangeAnnouncements || [];
  const campaigns = state.data.campaigns || [];
  const sources = new Set(announcements.map((item) => item.exchangeId).filter(Boolean));
  const dates = announcements.map((item) => item.publishedAt).filter(Boolean).sort();
  const cards = [
    ["已收录公告", announcements.length, "可检索的交易所记录"],
    ["有记录的交易所", sources.size, "按当前快照统计"],
    ["结构化活动", campaigns.length, "从收录公告提取"],
    ["最早公告日期", dates.length ? dates[0].slice(0, 10) : "—", "已收录范围"]
  ];
  document.getElementById("metrics").innerHTML = cards
    .map(([label, value, detail]) => `<article class="metric"><span>${label}</span><strong>${escapeHtml(value)}</strong><small>${detail}</small></article>`)
    .join("");
}

function renderOverview() {
  const announcements = state.data.exchangeAnnouncements || [];
  const campaigns = state.data.campaigns || [];
  const snapshotAt = state.data.snapshotAt;
  document.getElementById("snapshot-time").textContent = snapshotAt ? `Last synchronized · ${formatTime(snapshotAt)}` : "尚无采集时间";
  document.getElementById("snapshot-summary").textContent = `${new Set(announcements.map((item) => item.exchangeId)).size} 个来源有记录 · ${announcements.length} 条公告`;
  document.getElementById("overview-feed").innerHTML = announcements.slice(0, 5).map((item) => `
    <article class="feed-row">
      <div><span class="feed-source">${escapeHtml(item.exchange)}</span><span class="feed-category">${escapeHtml(item.opsCategory || item.category || "公告")}</span></div>
      <h4>${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>` : escapeHtml(item.title)}</h4>
      <time>${item.publishedAt ? formatTime(item.publishedAt) : "发布时间未提供"}</time>
    </article>`).join("") || '<div class="empty-state"><strong>尚无收录记录</strong><p>采集完成后，最近的交易所公告将在这里出现。</p></div>';
  document.getElementById("overview-campaigns").innerHTML = campaigns.slice(0, 3).map((item) => `
    <article class="radar-row"><span>${escapeHtml(item.exchange)}</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.campaignType || "活动")} · ${formatTime(item.publishedAt)}</small></div></article>`).join("") || '<div class="empty-state"><strong>暂无活动更新</strong><p>当前快照中没有可结构化的活动记录。</p></div>';
  const counts = new Map();
  announcements.forEach((item) => counts.set(item.exchange, (counts.get(item.exchange) || 0) + 1));
  const rows = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = Math.max(1, ...rows.map((row) => row[1]));
  document.getElementById("overview-comparison").innerHTML = rows.map(([name, count]) => `
    <div class="compare-row"><span>${escapeHtml(name)}</span><div class="compare-track"><i style="width:${(count / max) * 100}%"></i></div><strong>${count}</strong></div>`).join("") || '<div class="empty-state"><strong>尚无交易所对比</strong><p>收录公告后可按来源查看数量。</p></div>';
}

function renderMonitorStatus() {
  const watchlist = state.data.watchlist || {};
  const sources = state.data.exchangeSources || [];
  const announcements = state.data.exchangeAnnouncements || [];
  const activeSourceIds = new Set(announcements.map((item) => item.exchangeId).filter(Boolean));
  const liveConnectors = sources.filter((source) => source.status === "ready").length;
  const trackedExchanges = sources
    .slice(0, 8)
    .map((source) => `${source.name}:${activeSourceIds.has(source.id) ? t().monitorOn : t().monitorWait}`)
    .join("  ");
  const cards = [
    [t().monitorCards[0], `${liveConnectors}/${sources.length}`, trackedExchanges],
    [t().monitorCards[1], (watchlist.keywords || []).length, (watchlist.keywords || []).slice(0, 5).join(", ")],
    [t().monitorCards[2], (watchlist.brandTerms || []).length, (watchlist.brandTerms || []).slice(0, 5).join(", ")],
    [t().monitorCards[3], (watchlist.kols || []).length, (watchlist.kols || []).slice(0, 5).join(", ")]
  ];
  document.getElementById("monitor-status").innerHTML = cards
    .map(([title, value, detail]) => `<article class="monitor-card"><strong><i class="status-dot"></i>${escapeHtml(title)} · ${escapeHtml(value)}</strong><span>${escapeHtml(detail || "-")}</span></article>`)
    .join("");
}

function renderWeb3News() {
  const rows = state.data.web3News || [];
  document.getElementById("web3news-list").innerHTML =
    rows
      .slice(0, 20)
      .map(
        (item, index) => `
      <article class="news-item">
        <span class="news-rank">${index + 1}</span>
        <div>
          <h4><a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a></h4>
          <p>${escapeHtml(item.body || item.source || "")}</p>
          <div class="news-meta">
            <span>${formatTime(item.observedAt)}</span>
            <span>${escapeHtml(item.source)}</span>
            ${item.asset ? `<span>${escapeHtml(item.asset)}</span>` : ""}
          </div>
        </div>
      </article>
    `
      )
      .join("") || (state.data.dataMode === "snapshot" ? '<div class="empty-state"><strong>本次快照未收录新闻</strong><p>此模块需要单独核验新闻来源后再展示。</p></div>' : `<div class="empty action-empty"><p>${t().web3news.empty}</p><button type="button" onclick="syncWeb3News()">${t().buttons.syncNews}</button></div>`);
}

function renderRegulation() {
  const region = document.getElementById("regulation-region-filter").value;
  const rows = (state.data.regulationItems || []).filter((item) => !region || item.region === region);
  document.getElementById("regulation-list").innerHTML =
    rows
      .map(
        (item) => `
      <article class="news-item ${item.severity === "critical" ? "critical-border" : ""}">
        <span class="news-rank">${escapeHtml(item.region || "OTHER")}</span>
        <div>
          <h4>${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a>` : escapeHtml(item.title)}</h4>
          ${item.url ? "" : '<p class="empty">演示数据，无原文链接</p>'}
          <p>${escapeHtml(item.summary || item.source || "")} · ${item.severity === "critical" ? "高危" : "关注"}</p>
          <div class="news-meta"><span>${formatTime(item.observedAt)}</span><span>${item.kind === "announcement" ? "公告" : item.kind === "demo" ? "演示样例" : "事件"}</span></div>
        </div>
      </article>`
      )
      .join("") || `<div class="empty">${t().regulation.empty}</div>`;
}

function renderUnlocks() {
  const rows = state.data.unlockEvents || [];
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    const count = rows.filter((item) => (item.unlockDate || "").slice(0, 10) === key).length;
    return `<div><strong>${date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}</strong><span>${count}</span></div>`;
  });
  document.getElementById("unlock-week").innerHTML = `<p>${t().unlocks.week}</p><div>${days.join("")}</div>`;
  document.getElementById("unlock-list").innerHTML =
    rows
      .slice(0, 50)
      .map(
        (item) => `
      <article class="news-item ${item.isLarge ? "critical-border" : ""}">
        <span class="news-rank">${escapeHtml(item.symbol || "-")}</span>
        <div>
          <h4>${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.project || item.token || "解锁事件")}</a>` : escapeHtml(item.project || item.token || "解锁事件")}</h4>
          ${item.url ? "" : '<p class="empty">演示数据，无原文链接</p>'}
          <p>${escapeHtml(item.category || "解锁")} · ${formatUsd(item.valueUsd || 0)} · ${item.percentOfSupply ? `${Number(item.percentOfSupply).toFixed(2)}%` : "占比未知"}</p>
          <div class="news-meta"><span>${formatTime(item.unlockDate)}</span><span>${item.isDemo ? "演示样例" : item.isLarge ? "大额解锁" : "普通解锁"}</span></div>
        </div>
      </article>`
      )
      .join("") || (state.data.dataMode === "snapshot" ? '<div class="empty-state"><strong>本次快照无解锁数据</strong><p>已保留采集入口，当前展示不补造记录。</p></div>' : `<div class="empty action-empty"><p>${t().unlocks.empty}</p><button type="button" onclick="syncUnlocks()">${t().buttons.syncUnlocks}</button></div>`);
}

function renderAlerts() {
  const alerts = state.data.alerts;
  document.getElementById("alert-count").textContent = t().alertsVisible(alerts.length);
  document.getElementById("alerts").innerHTML =
    alerts
      .map(
        (alert) => `
        <article class="alert ${alert.severity}">
          <div class="alert-head">
            <h4>${escapeHtml(alert.title)}</h4>
            <span class="score">${Math.round(alert.score * 100)}</span>
          </div>
          <p>${escapeHtml(alert.summary)}</p>
          <div class="reason-bars">
            ${alert.reasons.map((reason, index) => `<div><span>${escapeHtml(reason)}</span><i style="width:${Math.max(28, Math.min(100, Math.round(alert.score * 100) - index * 8))}%"></i></div>`).join("")}
          </div>
          <div class="chips">
            ${alert.reasons.map((reason) => `<span class="chip">${escapeHtml(reason)}</span>`).join("")}
          </div>
        </article>
      `
      )
      .join("") || (state.data.dataMode === "snapshot" ? '<div class="empty-state"><strong>本次快照无优先告警</strong><p>没有符合当前规则的高优先级事件。</p></div>' : `<div class="empty action-empty"><p>${t().noAlerts}</p><button type="button" onclick="simulate()">${t().buttons.simulate}</button></div>`);
}

function renderEvents() {
  document.getElementById("events-table").innerHTML =
    state.data.events
      .map(
        (event) => `
      <tr>
        <td>${formatTime(event.observedAt)}</td>
        <td>${escapeHtml(eventTypeLabel(event.type))}</td>
        <td>${escapeHtml(event.asset)}</td>
        <td>${formatUsd(event.amountUsd)}</td>
        <td>${escapeHtml(event.fromLabel || "-")} -> ${escapeHtml(event.toLabel || "-")}</td>
        <td>${escapeHtml(event.source)}</td>
      </tr>
    `
      )
      .join("") || `<tr><td colspan="6">${t().noEvents}</td></tr>`;
}

function renderMix() {
  const counts = {};
  for (const event of state.data.events) counts[event.type] = (counts[event.type] || 0) + 1;
  const max = Math.max(1, ...Object.values(counts));
  document.getElementById("signal-mix").innerHTML =
    Object.entries(counts)
      .map(
        ([type, count]) => `
      <div class="bar">
        <div class="bar-row"><span>${escapeHtml(eventTypeLabel(type))}</span><strong>${count}</strong></div>
        <div class="bar-track"><div class="bar-fill" style="width:${(count / max) * 100}%"></div></div>
      </div>
    `
      )
      .join("") || `<p class="empty">${t().noSignals}</p>`;
}

function renderWhaleTransfers() {
  const whales = (state.data.whaleTransfers || []).slice(0, 6);
  document.getElementById("whale-transfers").innerHTML =
    whales
      .map(
        (event) => `
      <article class="whale-item">
        <strong>${escapeHtml(event.asset)} · ${formatUsd(event.amountUsd)}</strong>
        <span>${escapeHtml(event.fromLabel || "-")} -> ${escapeHtml(event.toLabel || "-")}</span>
        <span>${formatTime(event.observedAt)} · ${escapeHtml(event.source)}</span>
      </article>
    `
      )
      .join("") || `<p class="empty">${t().noWhales}</p>`;
}

function renderCampaigns() {
  const campaigns = state.data.campaigns || [];
  const exchangeSelect = document.getElementById("campaign-exchange-filter");
  const typeSelect = document.getElementById("campaign-type-filter");
  const selectedExchange = exchangeSelect.value;
  const selectedType = typeSelect.value;
  const exchanges = [...new Set(campaigns.map((item) => item.exchange).filter(Boolean))].sort();
  const types = [...new Set(campaigns.map((item) => item.campaignType).filter(Boolean))].sort();
  exchangeSelect.innerHTML = `<option value="">${t().campaigns.allExchanges}</option>${exchanges.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}`;
  typeSelect.innerHTML = `<option value="">${t().campaigns.allTypes}</option>${types.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}`;
  exchangeSelect.value = exchanges.includes(selectedExchange) ? selectedExchange : "";
  typeSelect.value = types.includes(selectedType) ? selectedType : "";
  const filtered = campaigns.filter((item) => (!exchangeSelect.value || item.exchange === exchangeSelect.value) && (!typeSelect.value || item.campaignType === typeSelect.value));
  document.getElementById("campaign-table").innerHTML =
    filtered
      .map(
        (item) => {
          return `
      <tr>
        <td>${escapeHtml(item.exchange)}</td>
        <td>${escapeHtml(item.campaignType)}</td>
        <td>${escapeHtml((item.tokens || []).join(", ") || "-")}</td>
        <td>${escapeHtml(formatCampaignTime(item))}</td>
        <td>${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a>` : escapeHtml(item.title)}</td>
      </tr>`;
        }
      )
      .join("") || `<tr><td colspan="5">${t().campaigns.empty}</td></tr>`;
  renderCampaignCalendar(filtered);
  renderCampaignFrequency();
}

function renderCampaignCalendar(campaigns) {
  const now = new Date();
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    const count = campaigns.filter((item) => (item.startsAt || item.publishedAt || "").slice(0, 10) === key).length;
    return `<div><strong>${date.toLocaleDateString(lang() === "zh" ? "zh-CN" : "en-US", { month: "numeric", day: "numeric" })}</strong><span>${count}</span></div>`;
  });
  document.getElementById("campaign-calendar").innerHTML = `<p>${t().campaigns.calendar}</p><div>${days.join("")}</div>`;
}

function renderCampaignFrequency() {
  const data = state.data.campaignFrequency || { rows: [], types: [] };
  const rows = (data.rows || []).filter((row) => row.total > 0 || row.isMine).slice(0, 8);
  const max = Math.max(1, ...rows.map((row) => row.total));
  const width = 460;
  const rowHeight = 20;
  const height = Math.max(82, rows.length * rowHeight + 32);
  const bars = rows
    .map((row, index) => {
      const y = 26 + index * rowHeight;
      const barWidth = Math.max(2, (row.total / max) * 220);
      return `
        <text x="10" y="${y + 12}" class="svg-label">${escapeHtml(row.exchange)}${row.isMine ? "（我所）" : ""}</text>
        <rect x="132" y="${y}" width="${barWidth}" height="12" rx="3" class="${row.isMine ? "svg-bar-mine" : "svg-bar"}"></rect>
        <text x="${140 + barWidth}" y="${y + 11}" class="svg-value">${row.total}</text>`;
    })
    .join("");
  document.getElementById("campaign-frequency").innerHTML = `
    <div class="panel-head compact"><h3>${t().frequency}</h3><span>${escapeHtml(data.myExchange || "")}</span></div>
    <svg viewBox="0 0 ${width} ${height}" role="img">
      <text x="10" y="15" class="svg-title">我所 vs 竞对活动数量</text>
      ${bars}
    </svg>`;
}

function formatCampaignTime(item) {
  if (item.startsAt || item.endsAt) return `${item.startsAt ? formatTime(item.startsAt) : "-"} ~ ${item.endsAt ? formatTime(item.endsAt) : "-"}`;
  return item.structured ? formatTime(item.publishedAt) : "未结构化";
}

function eventTypeLabel(type) {
  return t().typeLabels[type] || type;
}

function renderConnectors() {
  if (state.data.dataMode === "snapshot") {
    const counts = new Map();
    (state.data.exchangeAnnouncements || []).forEach((item) => counts.set(item.exchangeId, (counts.get(item.exchangeId) || 0) + 1));
    document.getElementById("connectors").innerHTML = (state.data.exchangeSources || [])
      .filter((source) => counts.has(source.id))
      .map((source) => `<div class="connector"><strong>${escapeHtml(source.name)}</strong><span>已收录 ${counts.get(source.id)} 条公告</span></div>`).join("");
    return;
  }
  document.getElementById("connectors").innerHTML = state.data.connectors
    .map(
      (connector) => `
        <div class="connector">
          <strong>${escapeHtml(connector.name)}</strong>
          <span>${connectorStatus(connector)} · ${escapeHtml(connectorMode(connector.mode))}</span>
          ${connector.message ? `<small>${escapeHtml(connector.message)}</small>` : ""}
        </div>
      `
    )
    .join("");
}

function connectorStatus(connector) {
  if (connector.status === "error") return t().error;
  if (connector.mode === "needs_key") return t().needsKey;
  if (connector.status !== "ready") return "未验证";
  return t().ready;
}

function connectorMode(mode) {
  return t().modes[mode] || mode;
}

function renderExchangeAnnouncements() {
  renderExchangeFilters();
  renderListingRace();
  const announcements = state.data.exchangeAnnouncements || [];
  const filtered =
    state.exchangeFilter === "all" ? announcements : announcements.filter((item) => item.exchangeId === state.exchangeFilter);

  document.getElementById("exchange-announcements").innerHTML =
    filtered
      .map(
        (item) => `
      <article class="exchange-card">
        <div class="exchange-card-head">
          <span class="exchange-name">${escapeHtml(item.exchange)}</span>
          <span class="score">${Math.round(item.activityScore || 0)}</span>
        </div>
        <h4>${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a>` : escapeHtml(item.title)}</h4>
        ${item.url ? "" : '<p class="empty">演示数据，无原文链接</p>'}
        <div class="exchange-meta">
          <span>${escapeHtml(item.category || t().announcement)}</span>
          <span>${formatTime(item.publishedAt)}</span>
        </div>
        <div class="chips">
          ${(item.tags || []).map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join("")}
          ${(item.matchedAssets || []).map((asset) => `<span class="chip asset">${escapeHtml(asset)}</span>`).join("")}
        </div>
      </article>
    `
      )
      .join("") || `<p class="empty">${t().noAnnouncements}</p>`;
}

function renderListingRace() {
  const rows = state.data.listingRace || [];
  const sources = state.data.exchangeSources || [];
  document.getElementById("listing-race-head").innerHTML = `<tr><th>${t().listingRaceHeads[0]}</th><th>${t().listingRaceHeads[1]}</th><th>${t().listingRaceHeads[2]}</th>${sources
    .map((source) => `<th>${escapeHtml(source.name)}</th>`)
    .join("")}</tr>`;
  document.getElementById("listing-race-table").innerHTML =
    rows
      .slice(0, 30)
      .map((row) => {
        const cells = sources.map((source) => {
          const hit = row.exchanges.find((item) => item.exchangeId === source.id);
          return `<td class="${row.isNew24h && hit?.publishedAt ? "fresh" : ""}">${hit?.publishedAt ? formatTime(hit.publishedAt) : "未采集到公告"}</td>`;
        });
        const lagClass = row.lagDays == null ? "lag-missing" : row.lagDays <= 0 ? "lag-lead" : "lag-behind";
        return `<tr><td>${escapeHtml(row.token)}</td><td>${escapeHtml(row.firstExchange || "-")}</td><td class="${lagClass}">${escapeHtml(row.lagLabel || "-")}</td>${cells.join("")}</tr>`;
      })
      .join("") || `<tr><td colspan="${Math.max(3, sources.length + 3)}">-</td></tr>`;
}

function renderExchangeFilters() {
  const sources = [{ id: "all", name: t().all }, ...(state.data.exchangeSources || [])];
  document.getElementById("exchange-filters").innerHTML = sources
    .map((source) => {
      const active = source.id === state.exchangeFilter ? "active" : "";
      const message = source.message ? ` title="${escapeHtml(source.message)}"` : "";
      return `<button class="filter-pill ${active}" data-exchange="${escapeHtml(source.id)}"${message}>${escapeHtml(source.name)}</button>`;
    })
    .join("");
  document.querySelectorAll(".filter-pill").forEach((button) => {
    button.addEventListener("click", () => {
      state.exchangeFilter = button.dataset.exchange;
      renderExchangeAnnouncements();
    });
  });
}

function hydrateWatchlist() {
  const watchlist = state.data.watchlist;
  document.getElementById("assets-input").value = watchlist.assets.join("\n");
  document.getElementById("protocols-input").value = watchlist.protocols.join("\n");
  document.getElementById("keywords-input").value = watchlist.keywords.join("\n");
  document.getElementById("wallets-input").value = watchlist.wallets
    .map((wallet) => `${wallet.address}, ${wallet.label || ""}`)
    .join("\n");
  document.getElementById("kols-input").value = (watchlist.kols || []).join("\n");
  document.getElementById("brands-input").value = (watchlist.brandTerms || []).join("\n");
}

function hydrateSettings() {
  const select = document.getElementById("my-exchange-select");
  const current = state.data.settings?.myExchangeId || "binance";
  select.innerHTML = (state.data.exchangeSources || [])
    .map((source) => `<option value="${escapeHtml(source.id)}">${escapeHtml(source.name)}</option>`)
    .join("");
  select.value = current;
}

function renderSearchResults(groups) {
  const labels = { announcements: "公告", campaigns: "活动", events: "事件" };
  const html = Object.entries(groups)
    .map(([key, rows]) => {
      const items = (rows || [])
        .slice(0, 8)
        .map((item) => `<li>${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a>` : escapeHtml(item.title)}<span>${escapeHtml(item.source || "")} · ${formatTime(item.observedAt)}${item.url ? " · 原文 ↗" : ""}</span>${item.summary ? `<span>${escapeHtml(item.summary)}</span>` : ""}</li>`)
        .join("");
      return `<div><h4>${labels[key] || key}</h4><ul>${items || "<li>无结果</li>"}</ul></div>`;
    })
    .join("");
  const panel = document.getElementById("global-search-results");
  panel.innerHTML = html || "<div>无结果</div>";
  panel.classList.remove("hidden");
}

function formatUsd(value) {
  return new Intl.NumberFormat(lang() === "zh" ? "zh-CN" : "en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2
  }).format(value || 0);
}

function formatTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString(lang() === "zh" ? "zh-CN" : "en-US");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
