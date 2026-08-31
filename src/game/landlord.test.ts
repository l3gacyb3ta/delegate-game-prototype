// The pressure that no amount of time on a roof answers. It is the only thing
// in the game that a player cannot fix with actions, which is the point.

import { describe, expect, it } from "vitest";
import { SEIZURE_DAYS } from "./content";
import { coverage } from "./graph";
import { initialState, reduce } from "./reducer";
import type { GameState } from "./types";

const noticed = (turn: number, deadline: number): GameState => ({
  ...initialState(3),
  turn,
  phase: "morning",
  flags: { ...initialState(3).flags, landlord: { deadline } },
});

describe("the landlord", () => {
  it("takes the stub when the deadline passes, and the whole map with it", () => {
    const s = reduce(noticed(7, 8), { type: "OPEN_DAY" });
    expect(s.flags.landlord).toBeNull();
    expect(s.flags.seizedUntil).toBe(8 + SEIZURE_DAYS);
    expect(coverage(s)).toBe(0);
    expect(s.log.some((l) => l.text.includes("padlock"))).toBe(true);
  });

  it("gives it back on its own schedule and not before", () => {
    let s = reduce(noticed(7, 8), { type: "OPEN_DAY" });
    const until = s.flags.seizedUntil as number;
    while (s.turn < until && s.phase !== "over") {
      s = reduce({ ...s, phase: "morning" }, { type: "OPEN_DAY" });
      if (s.turn < until) expect(coverage(s)).toBe(0);
    }
    expect(s.flags.seizedUntil).toBeNull();
    expect(coverage(s)).toBeGreaterThan(0);
  });

  it("is averted entirely by carrying the incorporation bylaw", () => {
    const s = noticed(5, 9);
    const convened: GameState = { ...s, phase: "council" };
    // Force the vote to carry by making the whole neighbourhood staunch.
    const willing: GameState = {
      ...convened,
      npcs: convened.npcs.map((n) => ({ ...n, trust: 3 })),
    };
    const after = reduce(willing, { type: "PROPOSE", proposalId: "bylaw:incorporate" });
    expect(after.lastVote?.passed).toBe(true);
    expect(after.flags.landlord).toBeNull();
    expect(after.flags.bylaws).toContain("incorporate");
  });

  it("cannot be voted on twice", () => {
    const s = noticed(5, 9);
    const done: GameState = {
      ...s,
      phase: "council",
      flags: { ...s.flags, bylaws: ["incorporate"] },
    };
    // The motion is off the menu, so the reducer has nothing to put to a vote
    // and returns the state it was handed, untouched.
    expect(reduce(done, { type: "PROPOSE", proposalId: "bylaw:incorporate" })).toBe(done);
  });
});

describe("scars", () => {
  it("survive an afternoon on a roof and die to the fund", () => {
    const base = initialState(5);
    const scarred: GameState = {
      ...base,
      phase: "day",
      actionsLeft: 2,
      links: base.links.map((l) =>
        l.id === "rialto~garage" ? { ...l, status: "down" as const, scar: 0.2 } : l,
      ),
    };
    const repaired = reduce(scarred, { type: "ACT", action: { type: "REPAIR", linkId: "rialto~garage" } });
    const link = repaired.links.find((l) => l.id === "rialto~garage");
    expect(link?.status).toBe("active");
    expect(link?.scar).toBe(0.2); // the weather keeps what it takes

    const hardened = reduce(
      { ...repaired, phase: "council", npcs: repaired.npcs.map((n) => ({ ...n, trust: 3 })) },
      { type: "PROPOSE", proposalId: "harden:garage" },
    );
    expect(hardened.lastVote?.passed).toBe(true);
    expect(hardened.links.find((l) => l.id === "rialto~garage")?.scar).toBe(0);
  });
});
