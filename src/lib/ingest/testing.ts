import { readFileSync } from "node:fs";
import path from "node:path";

export function fixture(name: string): string {
  return readFileSync(path.join(__dirname, "__fixtures__", name), "utf8");
}

export type Route = [match: string | RegExp, reply: string | { status?: number; body?: string; headers?: Record<string, string> } | ((url: string) => Response | string)];

export interface FakeFetch {
  fetch: typeof fetch;
  calls: { url: string; headers: Record<string, string> }[];
}

/** Serves canned responses. First matching route wins. Unmatched URLs return 404. */
export function fakeFetch(routes: Route[]): FakeFetch {
  const calls: FakeFetch["calls"] = [];
  const impl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, headers: { ...((init?.headers as Record<string, string>) ?? {}) } });
    for (const [match, reply] of routes) {
      const hit = typeof match === "string" ? url.includes(match) : match.test(url);
      if (!hit) continue;
      const r = typeof reply === "function" ? reply(url) : reply;
      if (r instanceof Response) return r;
      if (typeof r === "string") return new Response(r, { status: 200 });
      const status = r.status ?? 200;
      return new Response(status === 304 || status === 204 ? null : (r.body ?? ""), { status, headers: r.headers });
    }
    return new Response("not found", { status: 404 });
  };
  return { fetch: impl as typeof fetch, calls };
}

export const noSleep = async () => {};
