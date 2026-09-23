// Read-only Sites review of the existing Ops Console UI. All records are marked demo.
window.SITES_REVIEW = true;
const originalFetch = window.fetch.bind(window);
const demoState = originalFetch('./demo-state.json').then((response) => response.json());
const demoReport = originalFetch('./demo-report.json').then((response) => response.json());
const asJson = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

window.fetch = async (input, options = {}) => {
  const url = new URL(input, location.href);
  if (!url.pathname.startsWith('/api/')) return originalFetch(input, options);
  if (options.method && options.method !== 'GET') return asJson({ error: 'read_only_demo' }, 403);
  const state = await demoState;
  if (url.pathname === '/api/state') return asJson(state);
  if (url.pathname === '/api/daily-report') {
    const report = await demoReport;
    return asJson({ ...report, report: `演示日报快照 · ${report.generatedAt || '2026-09-24'}\n不会自动更新，不包含实时采集。\n\n${report.report}` });
  }
  if (url.pathname === '/api/search') {
    const q = (url.searchParams.get('q') || '').toLowerCase();
    const match = (item) => `${item.title || ''} ${item.exchange || ''} ${item.source || ''}`.toLowerCase().includes(q);
    const rows = (records, date) => records.filter(match).slice(0, 50).map((item) => ({ title: item.title, source: item.exchange || item.source || '演示数据', url: '', observedAt: item[date] }));
    return asJson({ q, groups: {
      announcements: rows(state.exchangeAnnouncements || [], 'publishedAt'),
      campaigns: rows(state.campaigns || [], 'publishedAt'),
      events: rows(state.events || [], 'observedAt')
    } });
  }
  return asJson({ error: 'read_only_demo' }, 403);
};

document.addEventListener('DOMContentLoaded', () => {
  for (const view of ['web3news', 'regulation', 'unlocks', 'watchlist', 'events', 'pipeline', 'settings']) {
    document.querySelector(`.nav-item[data-view="${view}"]`)?.setAttribute('hidden', '');
  }
  for (const id of ['refresh-btn', 'sync-btn', 'simulate-btn', 'sync-exchanges-btn', 'sync-news-btn', 'sync-unlocks-btn', 'generate-weekly-btn']) {
    document.getElementById(id)?.setAttribute('hidden', '');
  }
  document.querySelector('.connector-list')?.setAttribute('hidden', '');
  const banner = document.createElement('p');
  banner.className = 'disclaimer';
  banner.textContent = 'Sites 静态审查：仅演示数据快照；筛选、搜索和浏览可操作。无自动采集、真实通知或数据保存。';
  document.querySelector('.toolbar > div')?.append(banner);
  const badge = document.getElementById('mode-badge');
  const showExchanges = () => {
    if (badge.textContent !== '演示数据模式') return;
    observer.disconnect();
    document.querySelector('.nav-item[data-view="exchanges"]')?.click();
  };
  const observer = new MutationObserver(showExchanges);
  observer.observe(badge, { childList: true });
  showExchanges();
});
