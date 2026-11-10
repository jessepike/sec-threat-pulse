export interface BacklogItem {
  text: string;
  done: boolean;
}

export interface BacklogPhase {
  key: string;
  /** Phase number, or null for non-phase sections. */
  number: number | null;
  /** Wave number for a section of the wave plan, else null. */
  wave: number | null;
  name: string;
  gate: string | null;
  items: BacklogItem[];
}

/** Parses BACKLOG.md into phases, gates and checklist items. */
export function parseBacklog(md: string): BacklogPhase[] {
  const phases: BacklogPhase[] = [];
  let current: BacklogPhase | null = null;
  let later = false;
  let last: BacklogItem | null = null;

  for (const line of md.split("\n")) {
    const h = /^##\s+(.*)$/.exec(line);
    if (h) {
      last = null;
      later = false;
      const title = h[1].trim();
      const p = /^Phase\s+(\d+):\s*(.+?)(?:\s+·\s+Gate:\s*(.+))?$/.exec(title);
      if (p) {
        current = { key: `phase-${p[1]}`, number: Number(p[1]), wave: null, name: p[2].trim(), gate: p[3]?.trim() ?? null, items: [] };
        phases.push(current);
      } else if (/^Later phases/i.test(title)) {
        current = null;
        later = true;
      } else {
        // "Wave 2: Verdicts worth trusting (started Nov 8, 2026) · Gate: a public live track record exists"
        const [head, ...rest] = title.split(" · ");
        const gate = rest.find((x) => /^Gate:/i.test(x))?.replace(/^Gate:\s*/i, "").trim() ?? null;
        const w = /^Wave\s+(\d+):\s*(.+)$/.exec(head);
        const key = w ? `wave-${w[1]}` : head.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
        current = { key, number: null, wave: w ? Number(w[1]) : null, name: w ? w[2].trim() : head.trim(), gate, items: [] };
        phases.push(current);
      }
      continue;
    }
    if (later) {
      if (/^\d\s+\S/.test(line.trim())) {
        for (const part of line.split(" · ")) {
          const m = /^(\d)\s+(.+)$/.exec(part.trim());
          if (m) phases.push({ key: `phase-${m[1]}`, number: Number(m[1]), wave: null, name: m[2].trim(), gate: null, items: [] });
        }
      }
      continue;
    }
    if (!current) continue;
    const item = /^- \[( |x|X)\]\s+(.*)$/.exec(line);
    if (item) {
      last = { done: item[1].toLowerCase() === "x", text: item[2].trim() };
      current.items.push(last);
    } else if (last && /^\s{2,}\S/.test(line)) {
      last.text += ` ${line.trim()}`;
    } else if (!line.trim()) {
      last = null;
    }
  }
  // Phases in order, then every other section in the order the file has them. A heading with no checklist is dropped.
  return phases.filter((x) => x.number !== null || x.items.length > 0).sort((a, b) => (a.number ?? 99) - (b.number ?? 99));
}

/** The label a section goes by on the Roadmap page. */
export function sectionLabel(p: BacklogPhase): string {
  return p.number !== null ? `Phase ${p.number}: ${p.name}` : p.wave !== null ? `Wave ${p.wave}: ${p.name}` : p.name;
}

/** Open items that wait on the owner: the ones the backlog marks with "Owner" or "(owner)". */
export function ownerItems(phases: BacklogPhase[]): { section: string; text: string }[] {
  return phases.flatMap((p) => p.items.filter((i) => !i.done && /(^owner\b|\(owner\b|\bowner (runs|sends|flips|makes|approves|confirms)\b)/i.test(i.text)).map((i) => ({ section: sectionLabel(p), text: i.text })));
}
