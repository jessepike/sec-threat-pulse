import { Fragment, type ReactNode } from "react";

// A small Markdown renderer for our own docs (docs/methodology-rules.md). It supports headings,
// paragraphs, bullet and numbered lists, tables, fenced code, bold, inline code and links. It
// builds React elements and never injects HTML, so the source cannot add markup.

export type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; head: string[]; rows: string[][] }
  | { type: "code"; text: string };

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

const isDivider = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line) && line.includes("-");

export function parseMarkdown(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith("```")) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) body.push(lines[i++]);
      i++;
      blocks.push({ type: "code", text: body.join("\n") });
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      blocks.push({ type: "heading", level: h[1].length, text: h[2].trim() });
      i++;
      continue;
    }
    if (line.trimStart().startsWith("|") && i + 1 < lines.length && isDivider(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trimStart().startsWith("|")) rows.push(splitRow(lines[i++]));
      blocks.push({ type: "table", head, rows });
      continue;
    }
    const li = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(line);
    if (li) {
      const ordered = /\d/.test(li[2]);
      const items: string[] = [];
      while (i < lines.length) {
        const m = /^([-*]|\d+\.)\s+(.*)$/.exec(lines[i]);
        if (m && /\d/.test(m[1]) === ordered) {
          items.push(m[2]);
          i++;
        } else if (items.length && /^\s{2,}\S/.test(lines[i])) {
          items[items.length - 1] += ` ${lines[i].trim()}`;
          i++;
        } else break;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|[-*]\s|\d+\.\s)/.test(lines[i]) && !lines[i].trimStart().startsWith("|")) para.push(lines[i++].trim());
    if (!para.length) {
      para.push(lines[i++].trim());
    }
    blocks.push({ type: "paragraph", text: para.join(" ") });
  }
  return blocks;
}

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)\s]+\))/g;

export function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const tok = m[0];
    if (tok.startsWith("`")) out.push(<code key={k++}>{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("**")) out.push(<strong key={k++}>{renderInline(tok.slice(2, -2))}</strong>);
    else {
      const l = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok)!;
      // Only http(s), mailto and relative links are rendered as links.
      out.push(/^(https?:|mailto:|\/|#)/.test(l[2]) ? <a key={k++} href={l[2]}>{l[1]}</a> : l[1]);
    }
    last = at + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.map((n, idx) => (typeof n === "string" ? <Fragment key={`t${idx}`}>{n}</Fragment> : n));
}

/** URL-safe id for a heading. */
export function headingId(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function renderBlocks(blocks: Block[]): ReactNode[] {
  return blocks.map((b, i) => {
    switch (b.type) {
      case "heading": {
        const Tag = `h${Math.min(Math.max(b.level, 2), 4)}` as "h2" | "h3" | "h4";
        return <Tag key={i} id={headingId(b.text)}>{renderInline(b.text)}</Tag>;
      }
      case "paragraph":
        return <p key={i}>{renderInline(b.text)}</p>;
      case "list": {
        const Tag = b.ordered ? "ol" : "ul";
        return (
          <Tag key={i}>
            {b.items.map((it, n) => (
              <li key={n}>{renderInline(it)}</li>
            ))}
          </Tag>
        );
      }
      case "table":
        return (
          <div key={i} className="md-table" tabIndex={0} role="region" aria-label={`Table ${blocks.slice(0, i).filter((x) => x.type === "table").length + 1}: ${b.head.join(", ").replace(/[*`_]/g, "").slice(0, 80)}. Scrolls sideways on small screens`}>
            <table>
              <thead>
                <tr>{b.head.map((c, n) => <th key={n} scope="col">{renderInline(c)}</th>)}</tr>
              </thead>
              <tbody>
                {b.rows.map((r, n) => (
                  <tr key={n}>{r.map((c, m) => <td key={m}>{renderInline(c)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case "code":
        return <pre key={i} tabIndex={0}><code>{b.text}</code></pre>;
    }
  });
}

/** Splits a document into its first H1 title and the rest. */
export function splitTitle(blocks: Block[]): { title?: string; rest: Block[] } {
  const first = blocks[0];
  if (first && first.type === "heading" && first.level === 1) return { title: first.text, rest: blocks.slice(1) };
  return { rest: blocks };
}
