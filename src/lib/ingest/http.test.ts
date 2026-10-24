import { describe, expect, it } from "vitest";
import { HttpError, STP_USER_AGENT, getJson, httpGet, sha256Hex } from "./http";
import { fakeFetch, noSleep } from "./testing";

describe("httpGet", () => {
  it("sends the STP user agent and hashes the body", async () => {
    const f = fakeFetch([["example.com", "hello"]]);
    const r = await httpGet(f.fetch, "https://example.com/x", { sleep: noSleep });
    expect(f.calls[0].headers["User-Agent"]).toBe(STP_USER_AGENT);
    expect(STP_USER_AGENT).toBe("SecurityThreatPulse/0.1 (+https://securitythreatpulse.com; jp@jessepike.dev)");
    expect(r.sha256).toBe(sha256Hex("hello"));
  });

  it("retries 5xx then succeeds", async () => {
    let n = 0;
    const f = fakeFetch([["x", () => (++n < 3 ? new Response("boom", { status: 503 }) : new Response("ok"))]]);
    const r = await httpGet(f.fetch, "https://x.test/", { sleep: noSleep });
    expect(r.body).toBe("ok");
    expect(f.calls).toHaveLength(3);
  });

  it("backs off exponentially", async () => {
    const waits: number[] = [];
    const f = fakeFetch([["x", { status: 500 }]]);
    await expect(
      httpGet(f.fetch, "https://x.test/", { retries: 3, backoffMs: 100, sleep: async (ms) => void waits.push(ms) }),
    ).rejects.toThrow();
    expect(waits).toEqual([100, 200, 400]);
  });

  it("does not retry 404 and throws HttpError", async () => {
    const f = fakeFetch([]);
    await expect(httpGet(f.fetch, "https://x.test/", { sleep: noSleep })).rejects.toBeInstanceOf(HttpError);
    expect(f.calls).toHaveLength(1);
  });

  it("returns allowed statuses without throwing", async () => {
    const f = fakeFetch([]);
    const r = await httpGet(f.fetch, "https://x.test/", { allowStatus: [404], sleep: noSleep });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(404);
  });

  it("sends If-None-Match and reports 304", async () => {
    const f = fakeFetch([["x", { status: 304 }]]);
    const r = await httpGet(f.fetch, "https://x.test/", { etag: '"abc"', sleep: noSleep });
    expect(f.calls[0].headers["If-None-Match"]).toBe('"abc"');
    expect(r.notModified).toBe(true);
  });

  it("captures the ETag", async () => {
    const f = fakeFetch([["x", { body: "a", headers: { etag: '"v1"' } }]]);
    expect((await httpGet(f.fetch, "https://x.test/", { sleep: noSleep })).etag).toBe('"v1"');
  });

  it("retries on network errors and times out", async () => {
    let n = 0;
    const flaky = (async () => {
      if (++n < 2) throw new Error("socket hang up");
      return new Response("fine");
    }) as unknown as typeof fetch;
    expect((await httpGet(flaky, "https://x.test/", { sleep: noSleep })).body).toBe("fine");

    const hang = ((_u: string, init?: RequestInit) =>
      new Promise((_res, rej) => init?.signal?.addEventListener("abort", () => rej(new Error("aborted"))))) as unknown as typeof fetch;
    await expect(httpGet(hang, "https://x.test/", { timeoutMs: 10, retries: 0, sleep: noSleep })).rejects.toThrow(/aborted/);
  });

  it("getJson rejects bad JSON", async () => {
    const f = fakeFetch([["x", "<html>"]]);
    await expect(getJson(f.fetch, "https://x.test/", { sleep: noSleep })).rejects.toThrow(/Invalid JSON/);
  });
});
