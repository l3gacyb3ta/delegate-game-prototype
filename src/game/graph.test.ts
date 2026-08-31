import { describe, expect, it } from "vitest";
import { initialState } from "./reducer";
import { buildableLinks, cohesion, coverage, degree, reachable, reliabilityOf } from "./graph";
import type { GameState } from "./types";

const fresh = () => initialState(1234);

describe("coverage", () => {
  it("counts only what the uplink can reach", () => {
    const s = fresh();
    // rialto (uplink) + garage + laundromat are wired on day zero.
    expect(reachable(s)).toEqual(new Set(["rialto", "garage", "laundromat"]));
    expect(coverage(s)).toBeCloseTo(0.3);
  });

  it("drops a subgraph when the link carrying it goes down", () => {
    const s = fresh();
    const cut: GameState = {
      ...s,
      links: s.links.map((l) => (l.id === "rialto~garage" ? { ...l, status: "down" } : l)),
    };
    expect(reachable(cut).has("garage")).toBe(false);
    expect(coverage(cut)).toBeLessThan(coverage(s));
  });

  it("ignores sites that seceded", () => {
    const s = fresh();
    const forked: GameState = { ...s, seceded: ["garage"] };
    expect(reachable(forked).has("garage")).toBe(false);
  });
});

describe("feasibility", () => {
  it("only offers links where both ends already carry a node", () => {
    const s = fresh();
    const ids = buildableLinks(s).map((f) => [f.from, f.to].sort().join("~"));
    // The water tower has no node yet, so nothing through it is buildable.
    expect(ids.some((id) => id.includes("watertower"))).toBe(false);
    expect(degree(s, "rialto")).toBe(2);
  });

  it("opens up routes once a node is mounted", () => {
    const s = fresh();
    const mounted: GameState = {
      ...s,
      sites: s.sites.map((x) => (x.id === "watertower" ? { ...x, hasNode: true } : x)),
    };
    const ids = buildableLinks(mounted).map((f) => [f.from, f.to].sort().join("~"));
    expect(ids).toContain("rialto~watertower");
  });
});

describe("reliability", () => {
  it("punishes optical links in fog and leaves LoRa alone", () => {
    const s = fresh();
    const fso = s.links.find((l) => l.kind === "fso");
    expect(fso).toBeDefined();
    const clear = reliabilityOf(s, fso!, "clear");
    const foggy = reliabilityOf(s, fso!, "fog");
    expect(foggy).toBeLessThan(clear * 0.6);

    const lora = { ...fso!, kind: "lora" as const };
    expect(reliabilityOf(s, lora, "fog")).toEqual(reliabilityOf(s, lora, "clear"));
  });
});

describe("cohesion", () => {
  it("averages trust across the council only", () => {
    const s = fresh();
    const council = s.npcs.filter((n) => n.councilMember);
    const expected = council.reduce((a, n) => a + n.trust, 0) / council.length;
    expect(cohesion(s)).toBeCloseTo(expected);
    // Ada is warm but has no vote, so warming her further moves nothing.
    const warmed: GameState = {
      ...s,
      npcs: s.npcs.map((n) => (n.id === "ada" ? { ...n, trust: 3 } : n)),
    };
    expect(cohesion(warmed)).toBeCloseTo(expected);
  });
});

describe("what a storm takes", () => {
  // The storm rule is "anything under 0.5 goes down". These are the numbers
  // that make hardening worth a motion and LoRa worth building at all.
  const storm = (over: Partial<GameState>) => {
    const s = { ...fresh(), ...over } as GameState;
    return s.links.map((l) => reliabilityOf(s, l, "storm"));
  };

  it("takes an unhardened optical link and spares a hardened one", () => {
    const s = fresh();
    const fso = s.links.find((l) => l.kind === "fso")!;
    expect(reliabilityOf(s, fso, "storm")).toBeLessThan(0.5);
    const hardened: GameState = {
      ...s,
      sites: s.sites.map((x) => (x.id === fso.from ? { ...x, hardened: true } : x)),
    };
    expect(reliabilityOf(hardened, fso, "storm")).toBeGreaterThan(0.5);
  });

  it("spares LoRa and cable unconditionally", () => {
    const s = fresh();
    const cable = s.links.find((l) => l.kind === "cable")!;
    expect(reliabilityOf(s, cable, "storm")).toBeGreaterThan(0.5);
    const lora = { ...cable, kind: "lora" as const };
    expect(reliabilityOf(s, lora, "storm")).toBeGreaterThan(0.5);
  });

  it("never drives a link negative, however bad the week", () => {
    for (const r of storm({ flags: { ...fresh().flags, drag: 0.25 } })) {
      expect(r).toBeGreaterThanOrEqual(0);
    }
  });
});
