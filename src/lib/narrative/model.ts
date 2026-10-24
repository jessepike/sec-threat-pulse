import { z } from "zod";

export const RATINGS = ["TRUE", "OVERSTATED", "TOO EARLY", "FALSE"] as const;
export const ROLE_KEYS = ["ciso", "cio", "ceo", "board"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

const text = (max: number) => z.string().trim().max(max);
const list = (n: number, max: number) => z.array(text(max).min(1)).max(n);

export const narrativeSchema = z.object({
  businessExposure: text(1200),
  whyAct: text(1200),
  fix: text(1200),
  /** One question per line. */
  askYourTeam: text(1200),
  roles: z.object({ ciso: list(6, 300), cio: list(6, 300), ceo: list(6, 300), board: list(6, 300) }),
  claimChecks: z.array(z.object({ claim: text(300).min(1), truth: text(800).min(1), rating: z.enum(RATINGS) })).max(8),
});
export type NarrativeInput = z.infer<typeof narrativeSchema>;

export const EMPTY_NARRATIVE: NarrativeInput = {
  businessExposure: "",
  whyAct: "",
  fix: "",
  askYourTeam: "",
  roles: { ciso: [], cio: [], ceo: [], board: [] },
  claimChecks: [],
};

/** The first non-empty line of the questions text. Used in the home table. */
export function firstQuestion(askYourTeam: string | null | undefined): string | null {
  const line = (askYourTeam ?? "").split("\n").map((l) => l.trim()).find(Boolean);
  return line ?? null;
}

export function questionLines(askYourTeam: string | null | undefined): string[] {
  return (askYourTeam ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
}

/** Reads the admin form: repeatable inputs share a name (role_ciso, claim_text, claim_truth, claim_rating). */
export function parseNarrativeForm(fd: FormData): { ok: true; value: NarrativeInput } | { ok: false; error: string } {
  const s = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" ? v : "";
  };
  const all = (k: string) => fd.getAll(k).filter((v): v is string => typeof v === "string");
  const roles = Object.fromEntries(ROLE_KEYS.map((r) => [r, all(`role_${r}`).map((x) => x.trim()).filter(Boolean)]));
  const texts = all("claim_text");
  const truths = all("claim_truth");
  const ratings = all("claim_rating");
  const claimChecks = texts
    .map((claim, i) => ({ claim: claim.trim(), truth: (truths[i] ?? "").trim(), rating: ratings[i] ?? "" }))
    .filter((c) => c.claim || c.truth);
  const parsed = narrativeSchema.safeParse({
    businessExposure: s("businessExposure"),
    whyAct: s("whyAct"),
    fix: s("fix"),
    askYourTeam: s("askYourTeam"),
    roles,
    claimChecks,
  });
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { ok: false, error: `Check the form: ${i.path.join(" ")} ${i.message}`.trim() };
  }
  return { ok: true, value: parsed.data };
}
