import { createHash, createHmac } from "node:crypto";
import { HttpError, STP_USER_AGENT } from "./http";

export interface RawArchive {
  put(key: string, body: string, contentType: string): Promise<void>;
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const hmac = (key: Buffer | string, data: string) => createHmac("sha256", key).update(data).digest();

/** AWS Signature V4 headers for a PUT of a string body. Exported for tests. */
export function signPut(opts: {
  host: string;
  path: string;
  body: string;
  contentType: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service: string;
  now: Date;
}): Record<string, string> {
  const amz = opts.now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const date = amz.slice(0, 8);
  const payloadHash = sha(opts.body);
  const headers: Record<string, string> = {
    "content-type": opts.contentType,
    host: opts.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amz,
  };
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((n) => `${n}:${headers[n]}\n`).join("");
  const signedHeaders = names.join(";");
  const canonicalPath = opts.path
    .split("/")
    .map((seg) => encodeURIComponent(decodeURIComponent(seg)))
    .join("/");
  const canonical = ["PUT", canonicalPath, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${date}/${opts.region}/${opts.service}/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amz, scope, sha(canonical)].join("\n");
  const kSigning = hmac(hmac(hmac(hmac(`AWS4${opts.secretAccessKey}`, date), opts.region), opts.service), "aws4_request");
  const signature = createHmac("sha256", kSigning).update(toSign).digest("hex");
  return {
    "Content-Type": opts.contentType,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amz,
    Authorization: `AWS4-HMAC-SHA256 Credential=${opts.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

/**
 * Cloudflare R2 archive. Returns null unless R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 * and R2_BUCKET are all set. Uses plain fetch with SigV4, no SDK.
 */
export function createR2Archive(
  env: Record<string, string | undefined> = process.env,
  fetchFn: typeof fetch = fetch,
  now: () => Date = () => new Date(),
): RawArchive | null {
  const { R2_ACCOUNT_ID: account, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey, R2_BUCKET: bucket } = env;
  if (!account || !accessKeyId || !secretAccessKey || !bucket) return null;
  const host = `${account}.r2.cloudflarestorage.com`;
  return {
    async put(key, body, contentType) {
      const path = `/${bucket}/${key}`;
      const headers = signPut({ host, path, body, contentType, accessKeyId, secretAccessKey, region: "auto", service: "s3", now: now() });
      const res = await fetchFn(`https://${host}${path}`, { method: "PUT", headers: { ...headers, "User-Agent": STP_USER_AGENT }, body });
      if (!res.ok) throw new HttpError(`R2 upload failed with HTTP ${res.status}`, res.status, `r2:${key}`);
    },
  };
}

export function archiveKey(sourceId: string, sha256: string, contentType: string, now: Date): string {
  const ext = contentType.includes("csv") ? "csv" : contentType.includes("ndjson") ? "ndjson" : "json";
  const d = now.toISOString();
  return `raw/${sourceId}/${d.slice(0, 4)}/${d.slice(5, 7)}/${d.slice(8, 10)}/${d.replace(/[:.]/g, "-")}-${sha256.slice(0, 12)}.${ext}`;
}
