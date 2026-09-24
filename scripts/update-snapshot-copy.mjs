import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateProductionSnapshot } from "./snapshot-validation.mjs";

const root = path.resolve(import.meta.dirname, "..");
const snapshot = JSON.parse(await readFile(path.join(root, "public/production-snapshot.json"), "utf8"));
const counts = validateProductionSnapshot(snapshot);
const timestamp = snapshot.provenance.snapshot_at.slice(0, 16).replace("T", " ");
const updates = [
  ["README.md", `The current [production snapshot](./public/production-snapshot.json) contains **${counts.announcements} announcements from ${counts.exchanges} verified exchange sources, ${counts.campaignRecords} campaign records, ${counts.structuredCampaigns} structured**; collected at ${timestamp} UTC.`],
  ["README.zh.md", `**Operational Snapshot。** [快照文件](./public/production-snapshot.json)当前记录 ${counts.announcements} 条去重公告、${counts.exchanges} 个已验证来源、${counts.campaignRecords} 条活动记录，其中 ${counts.structuredCampaigns} 条完成结构化识别；采集时间为 ${timestamp} UTC。`]
];
for (const [file, line] of updates) {
  const target = path.join(root, file);
  const old = await readFile(target, "utf8");
  const next = old.replace(/<!-- SNAPSHOT_COUNTS_START -->[\s\S]*?<!-- SNAPSHOT_COUNTS_END -->/, `<!-- SNAPSHOT_COUNTS_START -->\n${line}\n<!-- SNAPSHOT_COUNTS_END -->`);
  if (next === old && !old.includes(line)) throw new Error(`Missing snapshot markers in ${file}`);
  if (next !== old) await writeFile(target, next);
}
