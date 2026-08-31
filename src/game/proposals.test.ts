import { describe, expect, it } from "vitest";
import { initialState } from "./reducer";
import { availableProposals, counterproposals } from "./proposals";
import type { GameState, Proposal } from "./types";

const fresh = () => initialState(7);

describe("the evening's menu", () => {
  it("offers only motions the fund could actually pay for tonight", () => {
    const s = fresh();
    for (const p of availableProposals(s)) expect(p.cost).toBeLessThanOrEqual(s.budget);
  });

  it("prices a link to include mounting whatever bare roofs it needs", () => {
    const s = fresh();
    const toTower = availableProposals(s).find((p) => p.id === "link:rialto~watertower");
    expect(toTower).toBeDefined();
    // fso (2) plus one bare roof (1). Nobody is ever left holding a stray node.
    expect(toTower!.cost).toBe(3);
    expect(toTower!.motion).toContain("mounting on");
  });

  it("says out loud which roofs it is going to put equipment on", () => {
    const s = fresh();
    for (const p of availableProposals(s)) {
      if (p.kind !== "build-link" || !p.from || !p.to) continue;
      const bare = [p.from, p.to].filter((id) => !s.sites.find((x) => x.id === id)?.hasNode);
      expect(p.motion.includes("mounting on")).toBe(bare.length > 0);
    }
  });

  it("offers the version of a motion that asks the owner first", () => {
    const s = fresh();
    const named = availableProposals(s).filter((p) => p.namedStakeholder);
    expect(named.length).toBeGreaterThan(0);
    // Naming somebody costs nothing but the asking.
    for (const p of named) {
      const plain = availableProposals(s).find((q) => q.id === p.id.split("+named:")[0]);
      expect(p.cost).toBe(plain?.cost);
    }
  });

  it("stops offering a bylaw once it is on the books", () => {
    const s = fresh();
    const withRule: GameState = { ...s, flags: { ...s.flags, bylaws: ["consent"] } };
    expect(availableProposals(withRule).some((p) => p.bylawId === "consent")).toBe(false);
  });
});

describe("counterproposals", () => {
  const failed: Proposal = {
    id: "link:rialto~watertower",
    kind: "build-link",
    motion: "that the co-op string an optical link from the Rialto to the water tower",
    cost: 3,
    from: "rialto",
    to: "watertower",
    linkKind: "fso",
  };

  it("produces alternatives and never re-tables the motion that just died", () => {
    const options = counterproposals(fresh(), failed);
    expect(options.length).toBeGreaterThan(0);
    expect(options.some((p) => p.id === failed.id)).toBe(false);
  });

  it("includes the amendment that names the owner as a stakeholder", () => {
    const options = counterproposals(fresh(), failed);
    expect(options.some((p) => p.namedStakeholder === "yolanda")).toBe(true);
  });

  it("never offers something the fund cannot pay for", () => {
    const s: GameState = { ...fresh(), budget: 1 };
    for (const p of counterproposals(s, failed)) expect(p.cost).toBeLessThanOrEqual(1);
  });

  it("offers spending on what exists instead of on more of it", () => {
    // The connected bloc's standing answer, and it grows every time you win.
    expect(counterproposals(fresh(), failed).some((p) => p.kind === "harden")).toBe(true);
  });
});

describe("the water tower, which is the whole point", () => {
  // Yolanda's public position is that the gear is an eyesore. Her actual
  // objection is that nobody asked her last time. The menu has to contain the
  // motion that asks, or the flip is unreachable and the content is dead.
  it("offers to name Yolanda on the link that uses her tower", () => {
    const named = availableProposals(fresh())
      .filter((p) => p.from === "rialto" && p.to === "watertower")
      .map((p) => p.namedStakeholder);
    expect(named).toContain("yolanda");
  });
});
