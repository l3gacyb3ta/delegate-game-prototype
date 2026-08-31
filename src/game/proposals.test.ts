import { describe, expect, it } from "vitest";
import { initialState } from "./reducer";
import { availableProposals, counterproposals } from "./proposals";
import type { GameState, Proposal } from "./types";

const fresh = () => initialState(7);

describe("the evening's menu", () => {
  it("offers only links the co-op could actually build tonight", () => {
    const s = fresh();
    for (const p of availableProposals(s)) {
      expect(p.cost).toBeLessThanOrEqual(s.budget);
      if (p.kind === "build-link") {
        expect(s.sites.find((x) => x.id === p.from)?.hasNode).toBe(true);
        expect(s.sites.find((x) => x.id === p.to)?.hasNode).toBe(true);
      }
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
    id: "mount:watertower",
    kind: "mount-node",
    motion: "that the co-op mount a node on the water tower",
    cost: 1,
    siteId: "watertower",
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
});

describe("the water tower, which is the whole point", () => {
  // Yolanda's public position is that the gear is an eyesore. Her actual
  // objection is that nobody asked her last time. The menu has to contain the
  // motion that asks, or the flip is unreachable and the content is dead.
  it("offers to name Yolanda on the link that uses her tower", () => {
    const s = { ...fresh(), sites: fresh().sites.map((x) => (x.id === "watertower" ? { ...x, hasNode: true } : x)) };
    const named = availableProposals(s)
      .filter((p) => p.from === "rialto" && p.to === "watertower")
      .map((p) => p.namedStakeholder);
    expect(named).toContain("yolanda");
  });

  it("offers to name her on the motion to mount the gear in the first place", () => {
    const named = availableProposals(fresh())
      .filter((p) => p.siteId === "watertower")
      .map((p) => p.namedStakeholder);
    expect(named).toContain("yolanda");
  });
});
