import { z } from "zod";
import { narrativeSchema, type NarrativeInput } from "./model";

export const DEFAULT_DRAFT_MODEL = "claude-haiku-5-5";

export interface DraftContext {
  title: string;
  vendor: string | null;
  product: string | null;
  ladder: Record<string, string>;
  verdict: string;
  verdictReason: string | null;
  cves: string[];
  observations: { title: string; url: string; kind?: string }[];
}

export function draftModel(env: NodeJS.ProcessEnv = process.env): string {
  return env.STP_DRAFT_MODEL?.trim() || DEFAULT_DRAFT_MODEL;
}

export function draftEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.ANTHROPIC_API_KEY?.trim());
}

export const SYSTEM_PROMPT = [
  "You write short plain-language sections for a security event page read by CISOs, CIOs, CEOs and boards.",
  "Use only the facts in the evidence you are given. Do not invent facts, numbers, dates, victims or attackers.",
  "Where the evidence is missing for a field, write exactly: Not known yet.",
  "Style: short, simple, direct sentences. No em dashes. No marketing phrasing. No 'X, not Y' constructions. No urgency slogans.",
  "Claims from criminal leak sites are claims, never facts.",
  "Reply with one JSON object only, no markdown fences, no commentary.",
].join("\n");

export function buildPrompt(ctx: DraftContext): string {
  const ladder = Object.entries(ctx.ladder).map(([k, v]) => `${k}: ${v}`).join(", ");
  const obs = ctx.observations.slice(0, 25).map((o) => `- ${o.kind ? `[${o.kind}] ` : ""}${o.title} (${o.url})`).join("\n") || "- None";
  return [
    `Event: ${ctx.title}`,
    `Vendor: ${ctx.vendor ?? "unknown"}. Product: ${ctx.product ?? "unknown"}.`,
    `CVEs: ${ctx.cves.join(", ") || "none"}`,
    `Evidence ladder (confirmed, reported or none): ${ladder}`,
    `Verdict: ${ctx.verdict}. Reason: ${ctx.verdictReason ?? "none given"}`,
    "Observations:",
    obs,
    "",
    "Return JSON with exactly these keys:",
    '{"businessExposure": string, "whyAct": string, "fix": string, "askYourTeam": string (2 to 3 questions, one per line), "roles": {"ciso": string[], "cio": string[], "ceo": string[], "board": string[]} (2 to 3 short actions each), "claimChecks": [{"claim": string, "truth": string, "rating": "TRUE"|"OVERSTATED"|"TOO EARLY"|"FALSE"}] (only claims that appear in the observations; may be empty)}',
  ].join("\n");
}

const BANNED = /\s*[\u2014\u2013]\s*/g;

/** Validates model output text. Strips code fences, parses JSON, checks the schema and the style rules. */
export function parseDraftResponse(raw: string): { ok: true; value: NarrativeInput } | { ok: false; error: string } {
  let t = raw.trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) t = fence[1];
  let json: unknown;
  try {
    json = JSON.parse(t);
  } catch {
    return { ok: false, error: "The model did not return valid JSON." };
  }
  const parsed = narrativeSchema.safeParse(json);
  if (!parsed.success) return { ok: false, error: `The model output did not match the expected shape: ${parsed.error.issues[0]?.path.join(".")}` };
  // Style rule: no em or en dashes. Replace with a comma rather than reject.
  const clean = JSON.parse(JSON.stringify(parsed.data).replace(BANNED, ", ")) as NarrativeInput;
  return { ok: true, value: clean };
}

const apiResponse = z.object({ content: z.array(z.object({ type: z.string(), text: z.string().optional() })) });

export async function requestDraft(
  ctx: DraftContext,
  opts: { apiKey: string; model: string; fetchImpl?: typeof fetch },
): Promise<{ ok: true; value: NarrativeInput } | { ok: false; error: string }> {
  const f = opts.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await f("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": opts.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: opts.model, max_tokens: 2000, system: SYSTEM_PROMPT, messages: [{ role: "user", content: buildPrompt(ctx) }] }),
    });
  } catch {
    return { ok: false, error: "Could not reach the Anthropic API." };
  }
  if (!res.ok) return { ok: false, error: `The Anthropic API returned status ${res.status}.` };
  const body = apiResponse.safeParse(await res.json().catch(() => null));
  if (!body.success) return { ok: false, error: "Unexpected response from the Anthropic API." };
  const text = body.data.content.filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  return parseDraftResponse(text);
}
