// The load-bearing test. A run is its seed plus its actions; if that stops
// being true, runs stop being shareable and the reducer has grown a secret.

import { describe, expect, it } from "vitest";
import { availableProposals } from "./proposals";
import { initialState, reduce } from "./reducer";
import type { GameAction, GameState } from "./types";

/** A dumb but deterministic delegate: visit the coldest council member, then
 *  table the first affordable motion on the list. */
function play(seed: number): GameState {
  let s = initialState(seed);
  for (let turn = 0; turn < 25 && s.phase !== "over"; turn++) {
    s = reduce(s, { type: "OPEN_DAY" });
    while (s.actionsLeft > 0) {
      const coldest = [...s.npcs].sort((a, b) => a.trust - b.trust || a.id.localeCompare(b.id))[0];
      const act: GameAction = coldest
        ? { type: "ACT", action: { type: "VISIT", npcId: coldest.id } }
        : { type: "SKIP_ACTIONS" };
      const before = s.actionsLeft;
      s = reduce(s, act);
      if (s.actionsLeft === before) break;
    }
    s = reduce(s, { type: "CONVENE" });
    const options = availableProposals(s);
    const first = options[0];
    s = first ? reduce(s, { type: "PROPOSE", proposalId: first.id }) : reduce(s, { type: "ABSTAIN" });
    if (s.phase === "counter") s = reduce(s, { type: "ACCEPT_COUNTER" });
  }
  return s;
}

describe("a run is reproducible from its seed", () => {
  it("replays byte for byte", () => {
    expect(JSON.stringify(play(4242))).toEqual(JSON.stringify(play(4242)));
  });

  it("diverges on a different seed", () => {
    expect(JSON.stringify(play(4242))).not.toEqual(JSON.stringify(play(4243)));
  });

  it("always terminates with an outcome", () => {
    for (const seed of [1, 2, 3, 99, 12345]) {
      const end = play(seed);
      expect(end.phase).toBe("over");
      expect(end.outcome).not.toBeNull();
      expect(end.turn).toBeLessThanOrEqual(20);
    }
  });
});

describe("the reducer does not mutate what it is given", () => {
  it("leaves the previous state untouched", () => {
    const s = initialState(11);
    const snapshot = JSON.stringify(s);
    const next = reduce(s, { type: "OPEN_DAY" });
    expect(JSON.stringify(s)).toEqual(snapshot);
    expect(next).not.toBe(s);
  });

  it("refuses actions that belong to another phase", () => {
    const s = initialState(11);
    expect(reduce(s, { type: "CONVENE" })).toBe(s);
    expect(reduce(s, { type: "PROPOSE", proposalId: "dues" })).toBe(s);
  });
});
