/**
 * Plain-language event titles for non-technical readers, built only from facts in the source data
 * (vendor, product, CWE and the source's own wording). No model, no opinion: a fixed keyword table
 * maps the flaw type to what an attacker can do. When nothing matches, the title says so plainly.
 */

export type FlawKind =
  | "code"
  | "command"
  | "auth"
  | "privilege"
  | "deserialize"
  | "sql"
  | "files"
  | "upload"
  | "ssrf"
  | "xss"
  | "memory"
  | "leak"
  | "dos"
  | "redirect"
  | "unknown";

/** What each kind lets an attacker do, phrased for a board member. */
export const EFFECT: Record<FlawKind, string> = {
  code: "attackers can run their own code",
  command: "attackers can run commands on it",
  auth: "attackers can get in without a password",
  privilege: "attackers can gain admin rights",
  deserialize: "attackers can run their own code",
  sql: "attackers can read or change its database",
  files: "attackers can read or change files",
  upload: "attackers can upload and run files",
  ssrf: "attackers can reach systems behind it",
  xss: "attackers can hijack users' sessions",
  memory: "a memory flaw attackers can abuse",
  leak: "attackers can read data they should not see",
  dos: "attackers can knock it offline",
  redirect: "attackers can send users to fake pages",
  unknown: "security flaw",
};

// Checked in order: the first match wins, so the most severe outcomes come first.
const CWE: [FlawKind, string[]][] = [
  ["command", ["CWE-77", "CWE-78"]],
  ["code", ["CWE-94", "CWE-95", "CWE-1336"]],
  ["deserialize", ["CWE-502"]],
  ["upload", ["CWE-434"]],
  ["auth", ["CWE-287", "CWE-288", "CWE-290", "CWE-306", "CWE-798", "CWE-1390"]],
  ["sql", ["CWE-89"]],
  ["privilege", ["CWE-269", "CWE-250", "CWE-266", "CWE-862", "CWE-863", "CWE-284", "CWE-285"]],
  ["files", ["CWE-22", "CWE-23", "CWE-35", "CWE-73", "CWE-59"]],
  ["ssrf", ["CWE-918"]],
  ["memory", ["CWE-119", "CWE-120", "CWE-121", "CWE-122", "CWE-125", "CWE-416", "CWE-787", "CWE-190", "CWE-415", "CWE-843", "CWE-824"]],
  ["xss", ["CWE-79"]],
  ["leak", ["CWE-200", "CWE-201", "CWE-209", "CWE-532", "CWE-312"]],
  ["redirect", ["CWE-601"]],
  ["dos", ["CWE-400", "CWE-770", "CWE-835", "CWE-674"]],
];

const WORDS: [FlawKind, RegExp][] = [
  ["code", /\b(remote code execution|rce|arbitrary code|code execution|code injection|execute (arbitrary )?code)\b/i],
  ["command", /\b(command injection|os command|arbitrary commands?|execute commands?)\b/i],
  ["deserialize", /\bdeserializ/i],
  ["upload", /\bfile upload\b/i],
  ["auth", /\b(authentication bypass|auth(entication)? bypass|bypass (the )?authentication|missing authentication|hard-?coded (credentials?|passwords?|keys?)|unauthenticated access)\b/i],
  ["sql", /\bsql injection\b/i],
  ["privilege", /\b(privilege escalation|elevation of privilege|escalate privileges|gain (elevated|root|admin|system) privileges|improper access control|missing authorization|incorrect authorization)\b/i],
  ["files", /\b(path traversal|directory traversal|arbitrary file (read|write|deletion|access)|local file inclusion)\b/i],
  ["ssrf", /\b(server-side request forgery|ssrf)\b/i],
  ["memory", /\b(use-after-free|use after free|buffer overflow|out-of-bounds (write|read)|heap overflow|stack overflow|memory corruption|type confusion|integer overflow|double free)\b/i],
  ["xss", /\b(cross-site scripting|xss)\b/i],
  ["leak", /\b(information disclosure|sensitive information|data exposure|disclose)\b/i],
  ["redirect", /\bopen redirect\b/i],
  ["dos", /\b(denial of service|denial-of-service|dos)\b/i],
];

/** Root causes say how a flaw works, not what it lets an attacker do. */
const ROOT_CAUSE = new Set<FlawKind>(["memory", "unknown"]);

const byWords = (text: string): FlawKind => WORDS.find(([, re]) => re.test(text))?.[0] ?? "unknown";
const byCwe = (cwe: readonly string[]): FlawKind => {
  const ids = new Set(cwe.map((c) => c.toUpperCase().trim()));
  return CWE.find(([, list]) => list.some((c) => ids.has(c)))?.[0] ?? "unknown";
};

/**
 * Picks the flaw type from the texts in order (the source's own name first, then its description),
 * then the CWE. The first outcome wins ("auth bypass", "code execution"); a root cause such as a
 * buffer overflow is used only when no text states an outcome.
 */
export function classifyFlaw(texts: string | readonly (string | null | undefined)[], cwe: readonly string[] = []): FlawKind {
  const list = (typeof texts === "string" ? [texts] : texts).filter((t): t is string => !!t);
  const kinds = [...list.map(byWords), byCwe(cwe)];
  return kinds.find((k) => !ROOT_CAUSE.has(k)) ?? kinds.find((k) => k !== "unknown") ?? "unknown";
}

const JUNK = new Set(["", "n/a", "na", "unknown", "none", "-", "multiple", "various"]);

function tidy(x: string | null | undefined): string {
  const s = (x ?? "").replace(/\s*[–—]\s*/g, ", ").replace(/\s+/g, " ").trim();
  if (JUNK.has(s.toLowerCase())) return "";
  // All-lowercase short names are usually acronyms in CVE records ("php", "vmware" stays as given).
  if (s === s.toLowerCase() && /^[a-z0-9]{2,4}$/.test(s)) return s.toUpperCase();
  if (s === s.toLowerCase()) return s.charAt(0).toUpperCase() + s.slice(1);
  return s;
}

/** "Microsoft Windows", "Ivanti Connect Secure", or the product alone when it already names the vendor. */
export function productName(vendor: string | null | undefined, product: string | null | undefined): string {
  const v = tidy(vendor);
  const p = tidy(product);
  if (v && /^multiple( products)?$/i.test(p)) return `Several ${v} products`;
  if (!p) return v;
  if (!v || p.toLowerCase().startsWith(v.toLowerCase()) || p.toLowerCase().includes(v.toLowerCase())) return p;
  return `${v} ${p}`;
}

export interface PlainTitleInput {
  vendor?: string | null;
  product?: string | null;
  /** The source's own title and description, used only to find the flaw type. */
  texts: (string | null | undefined)[];
  cwe?: readonly string[] | null;
  /** Number of CVEs in the event. */
  count?: number;
  /** False for early events, where attacks are reported and not yet confirmed. */
  confirmed?: boolean;
}

/** For example "Ivanti Connect Secure: attackers can get in without a password". Empty when no product is known. */
export function plainTitle(input: PlainTitleInput): string {
  const name = productName(input.vendor, input.product);
  if (!name) return "";
  const kind = classifyFlaw(input.texts, input.cwe ?? []);
  const used = input.confirmed === false ? "reported in attacks" : "used in attacks";
  if ((input.count ?? 1) > 1) {
    if (kind === "unknown") return `${name}: ${input.count} flaws ${used}`;
    if (kind === "memory") return `${name}: ${input.count} memory flaws ${used}`;
    return `${name}: ${input.count} flaws ${used}; ${EFFECT[kind]}`;
  }
  return kind === "unknown" ? `${name}: security flaw ${used}` : `${name}: ${EFFECT[kind]}`;
}
