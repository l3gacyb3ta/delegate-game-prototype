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
  it("counts the links hanging off the stub", () => {
    expect(degree(fresh(), "rialto")).toBe(2);
  });

  it("opens new frontier once a site is reached", () => {
    const s = fresh();
    const ids = buildableLinks(s).map((f) => [f.from, f.to].sort().join("~"));
    // Lakeview only becomes buildable once the water tower is up.
    expect(ids).not.toContain("lakeview~watertower");
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
  it("weights trust by how many households a figure speaks for", () => {
    const s = fresh();
    const total = s.npcs.reduce((a, n) => a + n.households, 0);
    const expected = s.npcs.reduce((a, n) => a + n.trust * n.households, 0) / total;
    expect(cohesion(s)).toBeCloseTo(expected);
  });

  it("moves further on the big constituency than on the small one", () => {
    // Hollis speaks for twelve households and Terrence for two, which is the
    // whole reason it matters which door you spend a day knocking on.
    const s = fresh();
    const warm = (id: string): GameState => ({
      ...s,
      npcs: s.npcs.map((n) => (n.id === id ? { ...n, trust: n.trust + 2 } : n)),
    });
    expect(cohesion(warm("hollis")) - cohesion(s)).toBeGreaterThan(
      cohesion(warm("terrence")) - cohesion(s),
    );
  });
});

describe("the frontier", () => {
  it("only offers links that touch the network, so nothing is ever stranded", () => {
    const s = fresh();
    const up = reachable(s);
    for (const f of buildableLinks(s)) {
      expect(up.has(f.from) || up.has(f.to)).toBe(true);
    }
  });

  it("offers a link to a bare roof, because the motion mounts what it needs", () => {
    const s = fresh();
    const ids = buildableLinks(s).map((f) => [f.from, f.to].sort().join("~"));
    expect(ids).toContain("rialto~watertower");
    expect(s.sites.find((x) => x.id === "watertower")?.hasNode).toBe(false);
  });
});

describe("the stub", () => {
  it("takes the whole map down with it when it is seized", () => {
    const s = fresh();
    expect(reachable(s).size).toBeGreaterThan(0);
    const seized: GameState = { ...s, flags: { ...s.flags, seizedUntil: 8 } };
    expect(reachable(seized).size).toBe(0);
    expect(coverage(seized)).toBe(0);
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

  it("keeps a scar that repair cannot touch and the fund can", () => {
    const s = fresh();
    const link = s.links.find((l) => l.kind === "cable")!;
    const clean = reliabilityOf(s, link, "clear");
    const scarred = reliabilityOf(s, { ...link, scar: 0.3 }, "clear");
    expect(scarred).toBeLessThan(clean);
    // Hardening the site is what makes it good again, and that costs a motion.
    const hardened: GameState = {
      ...s,
      sites: s.sites.map((x) => (x.id === link.from ? { ...x, hardened: true } : x)),
    };
    expect(reliabilityOf(hardened, { ...link, scar: 0 }, "clear")).toBeGreaterThan(scarred);
  });

  it("never drives a link negative, however bad the week", () => {
    for (const r of storm({ flags: { ...fresh().flags, drag: 0.25 } })) {
      expect(r).toBeGreaterThanOrEqual(0);
    }
  });
});
