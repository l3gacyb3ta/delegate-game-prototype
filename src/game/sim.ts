// A tuning harness, not part of the game. Plays many seeded runs with scripted
// delegates and prints the outcome spread, so the balance questions in the
// spec can be argued from numbers instead of vibes.
//
//   npm run sim            two hundred runs, both strategies
//   npm run sim -- 500     more of them

import { cohesion, coverage } from "./graph";
import { availableProposals } from "./proposals";
import { initialState, reduce } from "./reducer";
import { councilLean } from "./vote";
import type { GameState, Outcome, Proposal } from "./types";

type Strategy = "reads-the-room" | "engineer" | "bulldozer";

/** How much closer to a connected map this motion would put us. */
function progress(p: Proposal): number {
  if (p.kind === "build-link") return 2;
  if (p.kind === "mount-node") return 1.5;
  if (p.kind === "harden") return 0.5;
  return 0.25;
}

function choose(s: GameState, strategy: Strategy): Proposal | undefined {
  const options = availableProposals(s);
  if (options.length === 0) return undefined;
  const scored = options.map((p) => ({
    p,
    // The engineer builds the most useful thing and ignores the room. The
    // other one weighs whether it can actually carry.
    v: strategy === "reads-the-room" ? progress(p) + councilLean(s, p) : progress(p),
  }));
  return scored.sort((a, b) => b.v - a.v || a.p.id.localeCompare(b.p.id))[0]?.p;
}

function run(seed: number, strategy: Strategy): { outcome: Outcome; state: GameState; motions: number; carried: number } {
  let s = initialState(seed);
  let motions = 0;
  let carried = 0;

  while (s.phase !== "over") {
    s = reduce(s, { type: "OPEN_DAY" });

    // Spend the day on the coldest council member and on unread rooms.
    while (s.actionsLeft > 0) {
      const before = s.actionsLeft;
      const unread = s.npcs.filter((n) => n.councilMember && !s.revealed.includes(n.id));
      const coldest = [...s.npcs]
        .filter((n) => n.councilMember)
        .sort((a, b) => a.trust - b.trust || a.id.localeCompare(b.id))[0];
      const target = unread.sort((a, b) => a.trust - b.trust || a.id.localeCompare(b.id))[0];
      if (strategy === "bulldozer") {
        const unscouted = s.sites.find((x) => !s.scouted.includes(x.id));
        if (unscouted) s = reduce(s, { type: "ACT", action: { type: "SCOUT", siteId: unscouted.id } });
        else s = reduce(s, { type: "SKIP_ACTIONS" });
      } else if (strategy === "reads-the-room" && s.tokens > 0 && target && s.turn > 2) {
        s = reduce(s, { type: "ACT", action: { type: "MONOLOGUE", npcId: target.id } });
      } else if (coldest) {
        s = reduce(s, { type: "ACT", action: { type: "VISIT", npcId: coldest.id } });
      }
      if (s.actionsLeft === before) break;
    }

    s = reduce(s, { type: "CONVENE" });
    const p = choose(s, strategy);
    if (p) {
      motions++;
      s = reduce(s, { type: "PROPOSE", proposalId: p.id });
      if (s.lastVote?.passed) carried++;
    } else {
      s = reduce(s, { type: "ABSTAIN" });
    }
    if (s.phase === "counter") s = reduce(s, { type: "ACCEPT_COUNTER" });
  }

  return { outcome: s.outcome as Outcome, state: s, motions, carried };
}

function report(strategy: Strategy, runs: number) {
  const tally: Record<string, number> = {};
  let cov = 0;
  let coh = 0;
  let motions = 0;
  let carried = 0;

  for (let seed = 1; seed <= runs; seed++) {
    const r = run(seed, strategy);
    tally[r.outcome.ending] = (tally[r.outcome.ending] ?? 0) + 1;
    cov += coverage(r.state);
    coh += cohesion(r.state);
    motions += r.motions;
    carried += r.carried;
  }

  const pct = (n: number) => `${((n / runs) * 100).toFixed(0)}%`.padStart(4);
  console.log(`\n  ${strategy}  (${runs} runs)`);
  for (const key of ["win", "partial-network", "partial-community", "lose-coverage", "lose-fork"]) {
    console.log(`    ${key.padEnd(18)} ${pct(tally[key] ?? 0)}  ${String(tally[key] ?? 0).padStart(4)}`);
  }
  console.log(`    mean coverage      ${(100 * cov / runs).toFixed(1)}%`);
  console.log(`    mean cohesion      ${(coh / runs).toFixed(2)}`);
  console.log(`    motions carried    ${((100 * carried) / motions).toFixed(0)}% of ${(motions / runs).toFixed(1)} per run`);
}

const runs = Number(process.argv[2] ?? 200);
report("reads-the-room", runs);
report("engineer", runs);
report("bulldozer", runs);
console.log("");
