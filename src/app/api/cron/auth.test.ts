import { afterEach, describe, expect, it } from "vitest";
import { checkCronAuth } from "./auth";

const req = (h?: string) => new Request("https://x.test/api/cron/ingest", { headers: h ? { authorization: h } : {} });
const saved = process.env.CRON_SECRET;
afterEach(() => {
  if (saved === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = saved;
});

describe("checkCronAuth", () => {
  it("refuses everything when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;
    expect((checkCronAuth(req("Bearer anything")) as Response).status).toBe(503);
  });

  it("rejects missing and wrong tokens", () => {
    process.env.CRON_SECRET = "s3cret";
    expect((checkCronAuth(req()) as Response).status).toBe(401);
    expect((checkCronAuth(req("Bearer nope")) as Response).status).toBe(401);
    expect((checkCronAuth(req("s3cret")) as Response).status).toBe(401);
  });

  it("accepts the right bearer token", () => {
    process.env.CRON_SECRET = "s3cret";
    expect(checkCronAuth(req("Bearer s3cret"))).toBeNull();
  });
});
