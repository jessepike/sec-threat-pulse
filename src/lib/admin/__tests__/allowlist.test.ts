import { describe, expect, it } from "vitest";
import { devBypassEnabled, isAllowedLogin, parseAllowlist } from "../allowlist";

describe("allowlist", () => {
  it("parses, trims and lowercases", () => {
    expect(parseAllowlist(" JessePike, other ,,")).toEqual(["jessepike", "other"]);
    expect(parseAllowlist(undefined)).toEqual([]);
  });
  it("accepts only listed logins, ignoring case", () => {
    expect(isAllowedLogin("jessepike", "JessePike,bob")).toBe(true);
    expect(isAllowedLogin("BOB", "jessepike,bob")).toBe(true);
    expect(isAllowedLogin("mallory", "jessepike,bob")).toBe(false);
  });
  it("rejects empty, missing and non-string logins", () => {
    expect(isAllowedLogin("", "a")).toBe(false);
    expect(isAllowedLogin(undefined, "a")).toBe(false);
    expect(isAllowedLogin(42, "a")).toBe(false);
  });
  it("rejects everyone when the allowlist is empty", () => {
    expect(isAllowedLogin("anyone", "")).toBe(false);
    expect(isAllowedLogin("anyone", undefined)).toBe(false);
  });
  it("does not match substrings", () => {
    expect(isAllowedLogin("jesse", "jessepike")).toBe(false);
  });
  it("honors the dev bypass only outside production", () => {
    expect(devBypassEnabled({ ADMIN_DEV_BYPASS: "1", NODE_ENV: "development" })).toBe(true);
    expect(devBypassEnabled({ ADMIN_DEV_BYPASS: "1", NODE_ENV: "production" })).toBe(false);
    expect(devBypassEnabled({ NODE_ENV: "development" })).toBe(false);
  });
});
