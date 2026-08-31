import { describe, expect, it } from "vitest";
import { initialState } from "./reducer";
import { interests } from "./proposals";
import { castVote, expectedScore, scoreTerms } from "./vote";
import type { GameState, NPC, Proposal } from "./types";

const fresh = () => initialState(99);
const who = (s: GameState, id: string) => s.npcs.find((n) => n.id === id) as NPC;

/** A node on the water tower, which Yolanda owns and does not want. */
const mountTower: Proposal = {
  id: "mount:watertower",
  kind: "mount-node",
  motion: "that the co-op mount a node on the water tower",
  cost: 1,
  siteId: "watertower",
};

describe("self-interest is derived from the graph", () => {
  it("charges the owner for the use of their roof", () => {
    const s = fresh();
    expect(interests(s, mountTower).costs).toContain("yolanda");
  });

  it("credits whoever a new link puts on the network for the first time", () => {
    const s: GameState = {
      ...fresh(),
      sites: fresh().sites.map((x) => (x.id === "watertower" ? { ...x, hasNode: true } : x)),
    };
    const link: Proposal = {
      id: "link:rialto~watertower",
      kind: "build-link",
      motion: "…",
      cost: 2,
      from: "rialto",
      to: "watertower",
      linkKind: "fso",
    };
    const info = interests(s, link);
    expect(info.benefits).toContain("yolanda"); // she gets connected
    expect(info.benefits).not.toContain("dez"); // the Rialto was already up
  });

  it("makes raising dues cost everybody", () => {
    const s = fresh();
    const dues: Proposal = { id: "dues", kind: "raise-dues", motion: "…", cost: 0 };
    const council = s.npcs.filter((n) => n.councilMember);
    for (const n of council) expect(scoreTerms(s, dues, n).selfInterest).toBe(-2);
  });
});

describe("grudges", () => {
  it("docks a member when the motion helps someone they cannot stand", () => {
    const s = fresh();
    const helpsDez: Proposal = {
      id: "harden:rialto",
      kind: "harden",
      motion: "…",
      cost: 2,
      siteId: "rialto",
    };
    // Marcus holds a grudge against Dez, who owns the Rialto.
    expect(scoreTerms(s, helpsDez, who(s, "marcus")).grudge).toBe(-1.5);
    expect(scoreTerms(s, helpsDez, who(s, "june")).grudge).toBe(0);
  });
});

describe("the quirks that flip a read", () => {
  it("turns Yolanda around when the motion names her, and only then", () => {
    const s = fresh();
    const plain = expectedScore(s, mountTower, who(s, "yolanda"));
    const named = expectedScore(s, { ...mountTower, namedStakeholder: "yolanda" }, who(s, "yolanda"));
    expect(plain).toBeLessThan(0);
    expect(named).toBeGreaterThan(0);
  });

  it("buys the Pastor's vote with the clinic and nothing else", () => {
    const s: GameState = {
      ...fresh(),
      sites: fresh().sites.map((x) => (x.id === "clinic" ? { ...x, hasNode: true } : x)),
    };
    const toClinic: Proposal = {
      id: "link:clinic~laundromat",
      kind: "build-link",
      motion: "…",
      cost: 2,
      from: "laundromat",
      to: "clinic",
      linkKind: "fso",
    };
    expect(scoreTerms(s, toClinic, who(s, "pastor")).quirk).toBe(3);
    expect(scoreTerms(s, mountTower, who(s, "pastor")).quirk).toBe(-1);
  });
});

describe("tally", () => {
  it("passes on a majority and returns a ballot per council member", () => {
    const s = fresh();
    const council = s.npcs.filter((n) => n.councilMember).length;
    const { result } = castVote(s, mountTower, s.rng);
    expect(result.ballots).toHaveLength(council);
    expect(result.yes + result.no).toBe(council);
    expect(result.passed).toBe(result.yes > council / 2);
  });

  it("cannot carry a motion that nobody gains from and everybody distrusts", () => {
    const s: GameState = {
      ...fresh(),
      npcs: fresh().npcs.map((n) => ({ ...n, trust: -3 })),
    };
    const dues: Proposal = { id: "dues", kind: "raise-dues", motion: "…", cost: 0 };
    const { result } = castVote(s, dues, s.rng);
    expect(result.passed).toBe(false);
    expect(result.yes).toBe(0);
  });

  it("advances the RNG cursor so the next vote is not a rerun", () => {
    const s = fresh();
    const a = castVote(s, mountTower, s.rng);
    const b = castVote(s, mountTower, a.next);
    expect(a.next).not.toBe(s.rng);
    expect(a.result.ballots.map((x) => x.noise)).not.toEqual(b.result.ballots.map((x) => x.noise));
  });
});
