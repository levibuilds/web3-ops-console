const trusted = new Set(["binance", "okx", "bybit", "bitget"]);
const demoPattern = /demo:|_simulator|coinx|"isDemo":true|"is_demo":true/i;

export function validateProductionSnapshot(payload) {
  const { state, report } = payload;
  const announcements = state?.exchangeAnnouncements || [];
  const campaigns = state?.campaigns || [];
  if (!announcements.length) throw new Error("No trusted announcement records");
  if (state.dataMode !== "snapshot") throw new Error("Snapshot mode required");
  const ids = new Set(announcements.map((item) => item.id));
  for (const item of announcements) {
    if (!trusted.has(item.exchangeId) || !item.url?.startsWith("https://") || !item.originalTitle || !item.publishedAt || !item.fetchedAt) {
      throw new Error("Unverified announcement in snapshot");
    }
  }
  for (const item of campaigns) {
    if (!ids.has(item.announcementId) || !item.url?.startsWith("https://")) throw new Error("Unverified campaign in snapshot");
  }
  if (demoPattern.test(JSON.stringify([announcements, campaigns, state.alerts, state.events, report]))) {
    throw new Error("Demo record in production snapshot");
  }
  if ((state.connectors || []).some((item) => ["ready", "live", "simulated"].includes(item.status) || ["ready", "live", "simulated"].includes(item.mode))) {
    throw new Error("Unverified connector presented as active");
  }
  return {
    announcements: announcements.length,
    exchanges: new Set(announcements.map((item) => item.exchangeId)).size,
    campaignRecords: campaigns.length,
    structuredCampaigns: campaigns.filter((item) => item.structured === 1 || item.structured === true).length
  };
}
