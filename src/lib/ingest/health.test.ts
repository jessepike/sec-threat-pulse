import { describe, expect, it, vi } from "vitest";
import { assessDbSize, assessEventsSync, assessHealth, type SourceHealth, type SourceHealthInput } from "./health";
import { syncAlerts } from "./alerts";

const now = new Date("2026-10-25T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);
const src = (over: Partial<SourceHealthInput>): SourceHealthInput => ({
  id: "cisa-kev",
  name: "CISA KEV",
  intervalMinutes: 60,
  lastSuccessAt: hoursAgo(1),
  lastError: null,
  recent: ["ok"],
  ...over,
});

describe("assessHealth", () => {
  it("is ok after a recent success", () => {
    expect(assessHealth([src({})], now)[0].state).toBe("ok");
  });
  it("calls a source that never ran unconfigured, never an alert", () => {
    expect(assessHealth([src({ lastSuccessAt: null, recent: [] })], now)[0].state).toBe("unconfigured");
  });
  it("calls three errors in a row failing and quotes the last error", () => {
    const h = assessHealth([src({ recent: ["error", "error", "error", "ok"], lastError: "HTTP 503" })], now)[0];
    expect(h.state).toBe("failing");
    expect(h.reason).toContain("HTTP 503");
  });
  it("tolerates two errors in a row", () => {
    expect(assessHealth([src({ recent: ["error", "error", "ok"] })], now)[0].state).toBe("ok");
  });
  it("ignores a run still in progress when counting errors", () => {
    expect(assessHealth([src({ recent: ["running", "error", "error", "error"] })], now)[0].state).toBe("failing");
  });
  it("calls a source stale after three intervals, with a three hour floor", () => {
    expect(assessHealth([src({ intervalMinutes: 15, lastSuccessAt: hoursAgo(2) })], now)[0].state).toBe("ok");
    expect(assessHealth([src({ intervalMinutes: 15, lastSuccessAt: hoursAgo(4) })], now)[0].state).toBe("stale");
    expect(assessHealth([src({ intervalMinutes: 1440, lastSuccessAt: hoursAgo(48) })], now)[0].state).toBe("ok");
    expect(assessHealth([src({ intervalMinutes: 1440, lastSuccessAt: hoursAgo(80) })], now)[0].state).toBe("stale");
  });
  it("flags a source that ran but never succeeded", () => {
    expect(assessHealth([src({ lastSuccessAt: null, recent: ["error"] })], now)[0].state).toBe("stale");
  });
});

function fakeGitHub(open: Array<{ number: number; title: string }>) {
  const calls: Array<{ method: string; url: string; body?: unknown }> = [];
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (method === "GET") return new Response(JSON.stringify(open), { status: 200 });
    return new Response("{}", { status: 201 });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

const h = (id: string, state: SourceHealth["state"]): SourceHealth => ({ id, name: id, state, reason: state === "ok" ? "" : "Broken." });

describe("syncAlerts", () => {
  it("opens one issue for a newly unhealthy source", async () => {
    const gh = fakeGitHub([]);
    const r = await syncAlerts("t", [h("nvd", "failing"), h("epss", "ok"), h("vulncheck-kev", "unconfigured")], now, gh.fetchImpl);
    expect(r.opened).toEqual(["nvd"]);
    const post = gh.calls.find((c) => c.method === "POST");
    expect(post?.body).toMatchObject({ title: "[alert] Source nvd: failing", labels: ["alert"] });
  });
  it("does not open a second issue while one is open", async () => {
    const gh = fakeGitHub([{ number: 7, title: "[alert] Source nvd: failing" }]);
    const r = await syncAlerts("t", [h("nvd", "stale")], now, gh.fetchImpl);
    expect(r.opened).toEqual([]);
    expect(gh.calls.filter((c) => c.method !== "GET")).toHaveLength(0);
  });
  it("comments and closes when the source recovers", async () => {
    const gh = fakeGitHub([{ number: 7, title: "[alert] Source nvd: failing" }]);
    const r = await syncAlerts("t", [h("nvd", "ok")], now, gh.fetchImpl);
    expect(r.closed).toEqual(["nvd"]);
    expect(gh.calls.some((c) => c.method === "PATCH" && c.url.endsWith("/issues/7"))).toBe(true);
  });
});

describe("assessEventsSync", () => {
  it("is unconfigured before the first run and ok after a recent success", () => {
    expect(assessEventsSync(undefined, now).state).toBe("unconfigured");
    expect(assessEventsSync({ lastSuccessAt: hoursAgo(0.5).toISOString(), failures: 0 }, now).state).toBe("ok");
  });
  it("is stale after an hour and failing after three errors", () => {
    expect(assessEventsSync({ lastSuccessAt: hoursAgo(2).toISOString(), failures: 0 }, now).state).toBe("stale");
    expect(assessEventsSync({ lastSuccessAt: hoursAgo(0.5).toISOString(), failures: 3, lastError: "boom" }, now).reason).toContain("boom");
  });
});

describe("assessDbSize", () => {
  it("alerts at 80% of the limit", () => {
    const limit = 512 * 1024 * 1024;
    expect(assessDbSize(300 * 1024 * 1024, limit).state).toBe("ok");
    const h = assessDbSize(420 * 1024 * 1024, limit);
    expect(h.state).toBe("failing");
    expect(h.reason).toContain("420 MB of 512 MB");
  });
});
