import { describe, expect, it } from "vitest";
import { attentionItems, sortSources, sourceState } from "../attention";

describe("attentionItems", () => {
  it("lists alerts first, a failing source once, then drafts", () => {
    const items = attentionItems({
      alerts: [
        { sourceId: "nvd", name: "NVD", reason: "The last 3 runs failed." },
        { sourceId: "database-size", name: "Database storage", reason: "The database uses 420 MB of 512 MB (82%)." },
        { sourceId: "events-sync", name: "Event builder", reason: "No successful run in the last 75 minutes." },
      ],
      failing: [
        { id: "nvd", name: "NVD", lastError: "HTTP 503" },
        { id: "epss", name: "EPSS", lastError: "timeout" },
      ],
      drafts: [{ eventId: "early-CVE-2026-1", title: "Example flaw" }],
    });
    expect(items.map((i) => i.key)).toEqual(["alert:nvd", "alert:database-size", "alert:events-sync", "source:epss", "draft:early-CVE-2026-1"]);
    expect(items[0].href).toBe("/admin/runs?source=nvd&status=error");
    expect(items[1].href).toBeUndefined();
    expect(items[2].href).toBe("/admin/runs");
    expect(items[3].tone).toBe("watch");
    expect(items[4].href).toBe("/admin/events/early-CVE-2026-1");
  });

  it("is empty when nothing is wrong", () => {
    expect(attentionItems({ alerts: [], failing: [], drafts: [] })).toEqual([]);
  });
});

describe("sourceState and sortSources", () => {
  const at = new Date("2026-11-10T00:00:00Z");
  it("names the state", () => {
    expect(sourceState({ enabled: false, lastError: "x", lastRunAt: at }, "failing")).toBe("off");
    expect(sourceState({ enabled: true, lastError: "x", lastRunAt: at }, "failing")).toBe("failing");
    expect(sourceState({ enabled: true, lastError: null, lastRunAt: at }, "stale")).toBe("stale");
    expect(sourceState({ enabled: true, lastError: "x", lastRunAt: at }, "ok")).toBe("error");
    expect(sourceState({ enabled: true, lastError: null, lastRunAt: at }, "ok")).toBe("ok");
    expect(sourceState({ enabled: true, lastError: null, lastRunAt: null }, "unconfigured")).toBe("new");
  });

  it("puts sources that need a look first", () => {
    const rows = [
      { name: "B ok", state: "ok" as const },
      { name: "Off", state: "off" as const },
      { name: "Stale", state: "stale" as const },
      { name: "A ok", state: "ok" as const },
      { name: "Failing", state: "failing" as const },
      { name: "Error", state: "error" as const },
    ];
    expect(sortSources(rows).map((r) => r.name)).toEqual(["Failing", "Stale", "Error", "A ok", "B ok", "Off"]);
  });
});
