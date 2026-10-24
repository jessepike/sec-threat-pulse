import type { AdapterResult, ObservationInput, SourceAdapter } from "@/lib/ladder/types";
import { getJson } from "../http";
import { isoOrUndefined } from "../util";

const BASE = "https://efts.sec.gov/LATEST/search-index";
const PAGE_SIZE = 100;
const MAX_PAGES = 3;
const FIRST_RUN_DAYS = 30;

interface Hit {
  _id: string;
  _source: {
    ciks?: string[];
    display_names?: string[];
    file_date?: string;
    adsh?: string;
    form?: string;
    items?: string[];
    period_ending?: string;
  };
}

export function parseSecHits(hits: Hit[]): ObservationInput[] {
  const out: ObservationInput[] = [];
  for (const h of hits) {
    const s = h._source;
    if (!s?.adsh || !s.items?.includes("1.05")) continue;
    const org = (s.display_names?.[0] ?? "").replace(/\s+\(.*$/, "").trim();
    const cik = s.ciks?.[0] ? String(Number(s.ciks[0])) : undefined;
    const file = h._id.split(":")[1];
    const url =
      cik && file
        ? `https://www.sec.gov/Archives/edgar/data/${cik}/${s.adsh.replace(/-/g, "")}/${file}`
        : `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik ?? ""}&type=8-K`;
    out.push({
      sourceId: "sec-8k",
      dedupeKey: `sec-8k:${s.adsh}`,
      kind: "damage",
      strength: "confirmed",
      cveIds: [],
      orgName: org || undefined,
      title: `${org || "A public company"} disclosed a material cybersecurity incident (Form ${s.form ?? "8-K"}, Item 1.05)`,
      summary: "Filed with the SEC under Item 1.05. The filing is the company's own statement.",
      url,
      publishedAt: isoOrUndefined(s.file_date),
      metadata: { adsh: s.adsh, cik, items: s.items, periodEnding: s.period_ending },
    });
  }
  return out;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export const sec8kAdapter: SourceAdapter = {
  id: "sec-8k",
  name: "SEC EDGAR 8-K Item 1.05",
  intervalMinutes: 60,
  async run(ctx): Promise<AdapterResult> {
    const start = ctx.cursor ? new Date(`${ctx.cursor}T00:00:00Z`) : new Date(ctx.now.getTime() - FIRST_RUN_DAYS * 86400000);
    const startdt = ymd(new Date(start.getTime() - 86400000));
    const enddt = ymd(ctx.now);
    const hits: Hit[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const url = `${BASE}?q=%22Item%201.05%22&forms=8-K&startdt=${startdt}&enddt=${enddt}&from=${page * PAGE_SIZE}`;
      const { data } = await getJson<{ hits?: { hits?: Hit[]; total?: { value?: number } } }>(ctx.fetch, url, { sleep: ctx.sleep });
      const list = data.hits?.hits ?? [];
      hits.push(...list);
      if (list.length < PAGE_SIZE) break;
    }
    return {
      observations: parseSecHits(hits),
      vulnerabilities: [],
      cursor: enddt,
      raw: { body: JSON.stringify(hits.map((h) => h._id)), contentType: "application/json" },
    };
  },
};
