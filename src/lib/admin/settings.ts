import { schema } from "@/lib/db/client";
import type { Db } from "./db";
import type { Validation } from "./override";

export const THEMES = ["dark", "grey"] as const;
export type Theme = (typeof THEMES)[number];

export interface SiteSettings {
  defaultTheme: Theme;
  featureFlags: Record<string, boolean>;
  alertRecipients: string[];
}

export const DEFAULT_SETTINGS: SiteSettings = {
  defaultTheme: "dark",
  featureFlags: {},
  alertRecipients: [],
};

const FLAG_KEY = /^[a-z][a-z0-9_]{0,40}$/;
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export function parseTheme(v: unknown): Validation<Theme> {
  return typeof v === "string" && (THEMES as readonly string[]).includes(v)
    ? { ok: true, value: v as Theme }
    : { ok: false, error: "Theme must be dark or grey." };
}

/** One flag per line, `key` or `key=true|false`. Bare keys are on. */
export function parseFlags(text: string): Validation<Record<string, boolean>> {
  const out: Record<string, boolean> = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const [k, v, ...rest] = line.split("=").map((s) => s.trim());
    if (rest.length || !FLAG_KEY.test(k ?? "")) {
      return { ok: false, error: `Bad flag line: "${line.slice(0, 40)}". Use lowercase letters, digits and underscores.` };
    }
    if (v !== undefined && v !== "true" && v !== "false") {
      return { ok: false, error: `Flag "${k}" must be true or false.` };
    }
    out[k] = v !== "false";
  }
  return { ok: true, value: out };
}

export function parseRecipients(text: string): Validation<string[]> {
  const list = text
    .split(/[\n,]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const bad = list.find((e) => !EMAIL.test(e));
  if (bad) return { ok: false, error: `"${bad.slice(0, 60)}" is not a valid email address.` };
  return { ok: true, value: [...new Set(list)] };
}

export async function loadSettings(db: Db): Promise<SiteSettings> {
  const rows = await db.select().from(schema.settings);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const theme = parseTheme(map.get("default_theme"));
  const flags = map.get("feature_flags");
  const rec = map.get("alert_recipients");
  return {
    defaultTheme: theme.ok ? theme.value : DEFAULT_SETTINGS.defaultTheme,
    featureFlags: flags && typeof flags === "object" && !Array.isArray(flags) ? (flags as Record<string, boolean>) : {},
    alertRecipients: Array.isArray(rec) ? rec.filter((x): x is string => typeof x === "string") : [],
  };
}
