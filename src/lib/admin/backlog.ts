export interface BacklogItem {
  text: string;
  done: boolean;
}

export interface BacklogPhase {
  key: string;
  /** Phase number, or null for non-phase sections. */
  number: number | null;
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
        current = { key: `phase-${p[1]}`, number: Number(p[1]), name: p[2].trim(), gate: p[3]?.trim() ?? null, items: [] };
        phases.push(current);
      } else if (/^Later phases/i.test(title)) {
        current = null;
        later = true;
      } else if (/^Permissions/i.test(title)) {
        current = { key: "permissions", number: null, name: title, gate: null, items: [] };
        phases.push(current);
      } else {
        current = null;
      }
      continue;
    }
    if (later) {
      if (/^\d\s+\S/.test(line.trim())) {
        for (const part of line.split(" · ")) {
          const m = /^(\d)\s+(.+)$/.exec(part.trim());
          if (m) phases.push({ key: `phase-${m[1]}`, number: Number(m[1]), name: m[2].trim(), gate: null, items: [] });
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
  return phases.sort((a, b) => (a.number ?? 99) - (b.number ?? 99));
}
