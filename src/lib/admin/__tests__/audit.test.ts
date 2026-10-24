import { describe, expect, it, vi } from "vitest";
import { writeAudit } from "../audit";
import type { Db } from "../db";

describe("writeAudit", () => {
  it("inserts one row with actor, action, target and details", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn(() => ({ values }));
    await writeAudit({ insert } as unknown as Db, {
      actor: "jessepike",
      action: "source.toggle",
      target: "cisa-kev",
      details: { enabled: false },
    });
    expect(insert).toHaveBeenCalledOnce();
    expect(values).toHaveBeenCalledWith({
      actor: "jessepike",
      action: "source.toggle",
      target: "cisa-kev",
      details: { enabled: false },
    });
  });
  it("stores null for a missing target and details", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    await writeAudit({ insert: () => ({ values }) } as unknown as Db, { actor: "a", action: "settings.save" });
    expect(values).toHaveBeenCalledWith({ actor: "a", action: "settings.save", target: null, details: null });
  });
});
