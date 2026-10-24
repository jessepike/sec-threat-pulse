import { describe, expect, it, vi } from "vitest";
import { buildPrompt, draftEnabled, draftModel, parseDraftResponse, requestDraft, type DraftContext } from "../draft";
import { firstQuestion, parseNarrativeForm } from "../model";

const ctx: DraftContext = {
  title: "PHP2Shell",
  vendor: "PHP",
  product: "PHP",
  ladder: { talk: "confirmed", attempts: "reported" },
  verdict: "act_now",
  verdictReason: "Attempts reported before a fix.",
  cves: ["CVE-2026-0001"],
  observations: [{ title: "Advisory", url: "https://example.com/a", kind: "talk" }],
};

const good = {
  businessExposure: "Public websites may be affected.",
  whyAct: "Attempts were reported.",
  fix: "Not known yet.",
  askYourTeam: "Which servers run PHP?\nAre they patched?",
  roles: { ciso: ["List PHP servers."], cio: [], ceo: [], board: [] },
  claimChecks: [{ claim: "CVSS 10", truth: "Official score is 9.2.", rating: "OVERSTATED" }],
};

describe("buildPrompt", () => {
  it("includes the evidence and the missing-evidence rule", () => {
    const p = buildPrompt(ctx);
    expect(p).toContain("CVE-2026-0001");
    expect(p).toContain("https://example.com/a");
    expect(p).toContain("act_now");
    expect(p).toContain("talk: confirmed");
  });
});

describe("parseDraftResponse", () => {
  it("accepts good JSON and fenced JSON", () => {
    expect(parseDraftResponse(JSON.stringify(good)).ok).toBe(true);
    expect(parseDraftResponse("```json\n" + JSON.stringify(good) + "\n```").ok).toBe(true);
  });
  it("rejects bad JSON, bad shape and bad ratings", () => {
    expect(parseDraftResponse("nope").ok).toBe(false);
    expect(parseDraftResponse(JSON.stringify({ ...good, roles: undefined })).ok).toBe(false);
    expect(parseDraftResponse(JSON.stringify({ ...good, claimChecks: [{ claim: "a", truth: "b", rating: "MAYBE" }] })).ok).toBe(false);
  });
  it("removes em dashes", () => {
    const r = parseDraftResponse(JSON.stringify({ ...good, fix: "Patch now — today." }));
    expect(r.ok && r.value.fix).toBe("Patch now, today.");
  });
});

describe("requestDraft", () => {
  it("calls the Messages API and validates the reply", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify(good) }] }), { status: 200 }));
    const r = await requestDraft(ctx, { apiKey: "k", model: "m", fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r.ok).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("k");
    expect(JSON.parse(init.body as string).model).toBe("m");
  });
  it("reports API errors", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 500 }));
    const r = await requestDraft(ctx, { apiKey: "k", model: "m", fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r).toEqual({ ok: false, error: "The Anthropic API returned status 500." });
  });
});

describe("env helpers", () => {
  it("defaults the model and detects the key", () => {
    expect(draftModel({} as NodeJS.ProcessEnv)).toBe("claude-haiku-5-5");
    expect(draftModel({ STP_DRAFT_MODEL: "x" } as unknown as NodeJS.ProcessEnv)).toBe("x");
    expect(draftEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(draftEnabled({ ANTHROPIC_API_KEY: "k" } as unknown as NodeJS.ProcessEnv)).toBe(true);
  });
});

describe("narrative form", () => {
  it("parses repeatable inputs", () => {
    const fd = new FormData();
    fd.append("whyAct", "Because.");
    fd.append("askYourTeam", "\n First?\nSecond?");
    fd.append("role_ciso", "A");
    fd.append("role_ciso", "");
    fd.append("claim_text", "c1");
    fd.append("claim_truth", "t1");
    fd.append("claim_rating", "TRUE");
    fd.append("claim_text", "");
    fd.append("claim_truth", "");
    fd.append("claim_rating", "TRUE");
    const r = parseNarrativeForm(fd);
    expect(r.ok && r.value.roles.ciso).toEqual(["A"]);
    expect(r.ok && r.value.claimChecks).toHaveLength(1);
    expect(firstQuestion(r.ok ? r.value.askYourTeam : "")).toBe("First?");
  });
  it("rejects a bad rating", () => {
    const fd = new FormData();
    fd.append("claim_text", "c");
    fd.append("claim_truth", "t");
    fd.append("claim_rating", "MAYBE");
    expect(parseNarrativeForm(fd).ok).toBe(false);
  });
});
