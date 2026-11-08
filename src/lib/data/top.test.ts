import { describe, expect, it } from "vitest";
import { EMPTY_LADDER } from "@/lib/ladder/types";
import type { EventRow } from "./types";
import { topFive, weekLine } from "./top";

const row = (id: string, verdict: EventRow["verdict"], tier?: EventRow["tier"]): EventRow => ({
  id, href: `/events/${id}`, title: id, idsLabel: "", exposure: "", question: null, verdict, tier, ladder: EMPTY_LADDER, topConfirmed: null,
});

describe("topFive", () => {
  it("takes up to five Act now rows in the order given and never pads with Watch", () => {
    const rows = [row("a", "act_now", "today"), row("b", "act_now", "now"), row("w", "watch"), row("c", "act_now"), row("d", "act_now"), row("e", "act_now"), row("f", "act_now")];
    expect(topFive(rows).map((t) => [t.rank, t.row.id])).toEqual([[1, "a"], [2, "b"], [3, "c"], [4, "d"], [5, "e"]]);
    expect(topFive([row("w", "watch")])).toEqual([]);
  });
});

describe("weekLine", () => {
  it("leads with the Act today count when there is one", () => {
    const rows = [row("a", "act_now", "today"), row("b", "act_now", "today"), row("c", "act_now", "now")];
    expect(weekLine(rows, topFive(rows), 3)).toBe("3 flaws under attack in the last 30 days need action now. 2 are marked TODAY: exploitation confirmed in the last two weeks, plus a sign of wide use. Start at the top.");
  });
  it("says so when nothing is in the Act today tier", () => {
    const rows = [row("c", "act_now", "now")];
    expect(weekLine(rows, topFive(rows), 1)).toBe("1 flaw under attack in the last 30 days needs action now. None is marked TODAY this week. Start here.");
  });
  it("says a quiet week is quiet, and points at older Act now events when there are some", () => {
    expect(weekLine([row("w", "watch")], [], 0)).toMatch(/^No flaw meets the Act now bar/);
    expect(weekLine([row("w", "watch")], [], 4)).toBe("No Act now flaw has a new attack report in the last 30 days. The 4 older ones are on the events list.");
  });
});
