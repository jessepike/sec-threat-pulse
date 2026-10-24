import { createHash } from "node:crypto";

export const STP_USER_AGENT =
  "SecurityThreatPulse/0.1 (+https://securitythreatpulse.com; jesse@keatingpike.com)";

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export interface HttpOptions {
  headers?: Record<string, string>;
  /** Per attempt timeout. Default 30 s. */
  timeoutMs?: number;
  /** Extra attempts after the first. Default 3. */
  retries?: number;
  /** First backoff in ms; doubles each retry. Default 500. */
  backoffMs?: number;
  /** Send If-None-Match. A 304 returns notModified=true. */
  etag?: string;
  /** Send If-Modified-Since (an HTTP date from a previous Last-Modified). A 304 returns notModified=true. */
  lastModified?: string;
  /** Statuses returned as a normal result instead of throwing (for example 404). */
  allowStatus?: number[];
  sleep?: (ms: number) => Promise<void>;
}

export interface HttpResult {
  url: string;
  status: number;
  ok: boolean;
  notModified: boolean;
  body: string;
  contentType: string;
  etag?: string;
  lastModified?: string;
  sha256: string;
}

export const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function retryable(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function retryAfterMs(res: Response): number | undefined {
  const v = res.headers.get("retry-after");
  if (!v) return undefined;
  const secs = Number(v);
  if (Number.isFinite(secs)) return Math.min(secs, 30) * 1000;
  const when = Date.parse(v);
  return Number.isNaN(when) ? undefined : Math.min(Math.max(when - Date.now(), 0), 30000);
}

/** GET with the STP user agent, timeout, retries with exponential backoff, sha256 and ETag support. */
export async function httpGet(
  fetchFn: typeof fetch,
  url: string,
  opts: HttpOptions = {},
): Promise<HttpResult> {
  const { timeoutMs = 30000, retries = 3, backoffMs = 500, sleep = defaultSleep } = opts;
  const headers: Record<string, string> = {
    "User-Agent": STP_USER_AGENT,
    Accept: "application/json, text/csv, */*",
    ...opts.headers,
  };
  if (opts.etag) headers["If-None-Match"] = opts.etag;
  if (opts.lastModified) headers["If-Modified-Since"] = opts.lastModified;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    let wait = backoffMs * 2 ** attempt;
    try {
      const res = await fetchFn(url, { headers, signal: ctl.signal, redirect: "follow" });
      if (res.status === 304) {
        return { url, status: 304, ok: true, notModified: true, body: "", contentType: "", etag: opts.etag, lastModified: opts.lastModified, sha256: "" };
      }
      if (res.ok || opts.allowStatus?.includes(res.status)) {
        const body = await res.text();
        return {
          url,
          status: res.status,
          ok: res.ok,
          notModified: false,
          body,
          contentType: res.headers.get("content-type") ?? "",
          etag: res.headers.get("etag") ?? undefined,
          lastModified: res.headers.get("last-modified") ?? undefined,
          sha256: sha256Hex(body),
        };
      }
      lastError = new HttpError(`HTTP ${res.status} for ${url}`, res.status, url);
      if (!retryable(res.status)) throw lastError;
      wait = retryAfterMs(res) ?? wait;
    } catch (err) {
      if (err instanceof HttpError && !retryable(err.status)) throw err;
      lastError =
        err instanceof HttpError
          ? err
          : new Error(`Request failed for ${url}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      clearTimeout(timer);
    }
    if (attempt < retries) await sleep(wait);
  }
  throw lastError;
}

export async function getJson<T = unknown>(
  fetchFn: typeof fetch,
  url: string,
  opts: HttpOptions = {},
): Promise<{ data: T; res: HttpResult }> {
  const res = await httpGet(fetchFn, url, opts);
  if (res.notModified) return { data: undefined as T, res };
  try {
    return { data: JSON.parse(res.body) as T, res };
  } catch {
    throw new Error(`Invalid JSON from ${url}`);
  }
}
