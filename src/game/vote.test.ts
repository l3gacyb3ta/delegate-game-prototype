import { describe, expect, it } from "vitest";
import { initialState } from "./reducer";
import { bloc } from "./graph";
import { interests } from "./proposals";
import { castVote, expectedScore, scoreTerms, shareFor } from "./vote";
import type { GameState, NPC, Proposal } from "./types";

const fresh = () => initialState(99);
const who = (s: GameState, id: string) => s.npcs.find((n) => n.id === id) as NPC;

/** The link that puts the water tower on the network, using Yolanda's roof. */
const toTower: Proposal = {
  id: "link:rialto~watertower",
  kind: "build-link",
  motion: "that the co-op string an optical link from the Rialto to the water tower",
  cost: 3,
  from: "rialto",
  to: "watertower",
  linkKind: "fso",
};

const dues: Proposal = { id: "dues", kind: "raise-dues", motion: "…", cost: 0 };

describe("blocs are computed from the map, not authored", () => {
  it("sorts everyone into exactly one bloc", () => {
    const s = fresh();
    expect(bloc(s, who(s, "dez"))).toBe("connected"); // owns the uplink
    expect(bloc(s, who(s, "hollis"))).toBe("dark"); // Lakeview is unreached
    expect(bloc(s, who(s, "june"))).toBe("renters"); // owns no roof at all
    expect(bloc(s, who(s, "ada"))).toBe("essential"); // the clinic
  });

  it("moves a constituency out of the dark the moment you reach them", () => {
    // This is the load-bearing behaviour of the whole redesign: your successes
    // rebuild the coalition that votes on you.
    const s = fresh();
    expect(bloc(s, who(s, "hollis"))).toBe("dark");
    const reached: GameState = {
      ...s,
      links: [
        ...s.links,
        {
          id: "lakeview~rialto",
          from: "rialto",
          to: "lakeview",
          kind: "fso",
          status: "active",
          reliability: 0.9,
          scar: 0,
        },
      ],
    };
    expect(bloc(reached, who(reached, "hollis"))).toBe("connected");
  });

  it("flips their structural interest with them", () => {
    const s = fresh();
    const asDark = scoreTerms(s, toTower, who(s, "hollis")).blocInterest;
    const reached: GameState = {
      ...s,
      links: [
        ...s.links,
        { id: "lakeview~rialto", from: "rialto", to: "lakeview", kind: "fso", status: "active", reliability: 0.9, scar: 0 },
      ],
    };
    const asConnected = scoreTerms(reached, toTower, who(reached, "hollis")).blocInterest;
    expect(asDark).toBeGreaterThan(0); // the dark want building
    expect(asConnected).toBeLessThan(0); // the connected resent paying for it
  });
});

describe("a constituency returns a split, not a verdict", () => {
  it("carries a bloc nearly whole on a decisive score and divides it on a marginal one", () => {
    expect(shareFor(6, 0)).toBeGreaterThan(0.85);
    expect(shareFor(-6, 0)).toBeLessThan(0.15);
    const marginal = shareFor(0.5, 0);
    expect(marginal).toBeGreaterThan(0.5);
    expect(marginal).toBeLessThan(0.62);
  });

  it("splits a large constituency rather than voting it as one lump", () => {
    const s = fresh();
    const { result } = castVote(s, toTower, s.rng);
    const hollis = result.ballots.find((b) => b.npcId === "hollis");
    expect(hollis?.households).toBe(12);
    expect(hollis!.yes + hollis!.no).toBe(12);
    // Somebody in a twelve-household building disagrees with the building.
    expect(result.ballots.some((b) => b.yes > 0 && b.no > 0)).toBe(true);
  });

  it("counts every household exactly once and tallies blocs to the same total", () => {
    const s = fresh();
    const { result } = castVote(s, dues, s.rng);
    const total = s.npcs.reduce((sum, n) => sum + n.households, 0);
    expect(result.yes + result.no).toBe(total);
    expect(result.blocs.reduce((sum, b) => sum + b.households, 0)).toBe(total);
    expect(result.passed).toBe(result.yes > result.no);
  });
});

describe("stakes are still derived from the topology", () => {
  it("charges the owner for the roof the motion bolts equipment to", () => {
    expect(interests(fresh(), toTower).costs).toContain("yolanda");
  });

  it("makes raising dues cost everybody", () => {
    const s = fresh();
    for (const n of s.npcs) expect(scoreTerms(s, dues, n).selfInterest).toBeLessThan(0);
  });

  it("docks a constituency when the motion helps someone they cannot stand", () => {
    const s = fresh();
    const helpsDez: Proposal = { id: "harden:rialto", kind: "harden", motion: "…", cost: 2, siteId: "rialto" };
    expect(scoreTerms(s, helpsDez, who(s, "marcus")).grudge).toBe(-1.5);
    expect(scoreTerms(s, helpsDez, who(s, "june")).grudge).toBe(0);
  });
});

describe("the quirks that flip a read", () => {
  it("turns Yolanda around when the motion names her, and only then", () => {
    const s = fresh();
    expect(expectedScore(s, toTower, who(s, "yolanda"))).toBeLessThan(0);
    expect(
      expectedScore(s, { ...toTower, namedStakeholder: "yolanda" }, who(s, "yolanda")),
    ).toBeGreaterThan(0);
  });

  it("buys the Pastor with the clinic and nothing else", () => {
    const s = fresh();
    const toClinic: Proposal = {
      id: "link:clinic~laundromat",
      kind: "build-link",
      motion: "…",
      cost: 3,
      from: "laundromat",
      to: "clinic",
      linkKind: "fso",
    };
    expect(scoreTerms(s, toClinic, who(s, "pastor")).quirk).toBe(3);
    expect(scoreTerms(s, toTower, who(s, "pastor")).quirk).toBe(-1);
  });
});
