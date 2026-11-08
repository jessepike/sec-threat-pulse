import { readFileSync } from "node:fs";
import path from "node:path";
import { llmsFull } from "@/lib/llms";

export const dynamic = "force-static";

// Read at build time. next.config.ts bundles the file.
const RULES_DOC = path.join(process.cwd(), "docs", "methodology-rules.md");

export function GET() {
  return new Response(llmsFull(readFileSync(RULES_DOC, "utf8")), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
