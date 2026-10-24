import type { AdapterResult, ObservationInput, SourceAdapter } from "@/lib/ladder/types";
import { getJson } from "../http";
import { isoOrUndefined, stripHtml, truncate } from "../util";

const URL_ = "https://haveibeenpwned.com/api/v3/breaches";
const FIRST_RUN_DAYS = 90;

interface Breach {
  Name: string;
  Title?: string;
  Domain?: string;
  BreachDate?: string;
  AddedDate?: string;
  PwnCount?: number;
  Description?: string;
  DataClasses?: string[];
  IsVerified?: boolean;
  IsFabricated?: boolean;
  IsSpamList?: boolean;
}

export function parseHibp(list: Breach[], sinceIso?: string): ObservationInput[] {
  const out: ObservationInput[] = [];
  for (const b of list) {
    if (!b.Name || b.IsFabricated || b.IsSpamList) continue;
    if (sinceIso && (b.AddedDate ?? "") <= sinceIso) continue;
    const title = b.Title ?? b.Name;
    const count = typeof b.PwnCount === "number" ? b.PwnCount : undefined;
    out.push({
      sourceId: "hibp",
      dedupeKey: `hibp:${b.Name}`,
      kind: "damage",
      strength: "confirmed",
      cveIds: [],
      orgName: title,
      title: `${title} breach${count ? `: ${count.toLocaleString("en-US")} accounts` : ""} (Have I Been Pwned)`,
      summary: b.Description ? truncate(stripHtml(b.Description), 400) : undefined,
      url: `https://haveibeenpwned.com/PwnedWebsites#${encodeURIComponent(b.Name)}`,
      publishedAt: isoOrUndefined(b.AddedDate),
      metadata: { domain: b.Domain, breachDate: b.BreachDate, pwnCount: count, dataClasses: b.DataClasses, verified: b.IsVerified },
    });
  }
  return out;
}

export const hibpAdapter: SourceAdapter = {
  id: "hibp",
  name: "Have I Been Pwned breaches",
  intervalMinutes: 60,
  async run(ctx): Promise<AdapterResult> {
    const { data, res } = await getJson<Breach[]>(ctx.fetch, URL_, { sleep: ctx.sleep });
    if (!Array.isArray(data)) throw new Error("HIBP catalog is not an array");
    const since = ctx.cursor ?? new Date(ctx.now.getTime() - FIRST_RUN_DAYS * 86400000).toISOString();
    const newest = data.map((b) => b.AddedDate ?? "").sort().pop();
    return {
      observations: parseHibp(data, since),
      vulnerabilities: [],
      cursor: newest && newest > since ? newest : since,
      raw: { body: res.body, contentType: "application/json" },
    };
  },
};
