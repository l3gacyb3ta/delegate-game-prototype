// A tuning harness, not part of the game. Plays many seeded runs with scripted
// delegates and prints the outcome spread, so the balance questions in the
// spec can be argued from numbers instead of vibes.
//
//   npm run sim            two hundred runs, both strategies
//   npm run sim -- 500     more of them

import { assembly, cohesion, coverage } from "./graph";
import { availableProposals } from "./proposals";
import { initialState, reduce } from "./reducer";
import { assemblyLean } from "./vote";
import type { GameState, Outcome, Proposal } from "./types";

type Strategy = "whip" | "reads-the-room" | "engineer" | "bulldozer";

/** How much closer to a connected map this motion would put us. */
function progress(p: Proposal): number {
  if (p.kind === "build-link") return 2;
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
    v: strategy === "reads-the-room" || strategy === "whip" ? progress(p) + assemblyLean(s, p) : progress(p),
  }));
  return scored.sort((a, b) => b.v - a.v || a.p.id.localeCompare(b.p.id))[0]?.p;
}

interface RunResult {
  outcome: Outcome;
  state: GameState;
  motions: number;
  carried: number;
  margins: number[];
}

function run(seed: number, strategy: Strategy): RunResult {
  let s = initialState(seed);
  let motions = 0;
  let carried = 0;
  const margins: number[] = [];

  while (s.phase !== "over") {
    s = reduce(s, { type: "OPEN_DAY" });

    // Spend the day on the coldest council member and on unread rooms.
    while (s.actionsLeft > 0) {
      const before = s.actionsLeft;
      // Weight attention by how many households a figure actually carries.
      // The whip ignores anybody small entirely and works the big rooms.
      const worth = (n: (typeof s.npcs)[number]) =>
        strategy === "whip" ? (n.households >= 6 ? 3 - n.trust : -99) : (3 - n.trust) * n.households;
      const unread = s.npcs.filter((n) => !s.revealed.includes(n.id) && n.households > 0);
      const coldest = [...s.npcs]
        .filter((n) => n.households > 0)
        .sort((a, b) => worth(b) - worth(a) || a.id.localeCompare(b.id))[0];
      const target = unread.sort((a, b) => b.households - a.households || a.id.localeCompare(b.id))[0];
      if (strategy === "whip" && s.tokens > 0 && target && target.households >= 6 && s.turn > 1) {
        s = reduce(s, { type: "ACT", action: { type: "MONOLOGUE", npcId: target.id } });
      } else if (strategy === "bulldozer") {
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
      if (s.lastVote) margins.push(Math.abs(s.lastVote.yes - s.lastVote.no));
      if (s.lastVote?.passed) carried++;
    } else {
      s = reduce(s, { type: "ABSTAIN" });
    }
    if (s.phase === "counter") s = reduce(s, { type: "ACCEPT_COUNTER" });
  }

  return { outcome: s.outcome as Outcome, state: s, motions, carried, margins };
}

function report(strategy: Strategy, runs: number) {
  const tally: Record<string, number> = {};
  let cov = 0;
  let coh = 0;
  let motions = 0;
  let carried = 0;
  let dark = 0;
  let seized = 0;
  let noticed = 0;
  const margins: number[] = [];

  for (let seed = 1; seed <= runs; seed++) {
    const r = run(seed, strategy);
    tally[r.outcome.ending] = (tally[r.outcome.ending] ?? 0) + 1;
    cov += coverage(r.state);
    coh += cohesion(r.state);
    motions += r.motions;
    carried += r.carried;
    dark += assembly(r.state).dark;
    if (r.state.log.some((l) => l.text.includes("padlock"))) seized++;
    if (r.state.log.some((l) => l.text.includes("return address") || l.text.includes("landlord"))) noticed++;
    margins.push(...r.margins);
  }

  const pct = (n: number) => `${((n / runs) * 100).toFixed(0)}%`.padStart(4);
  console.log(`\n  ${strategy}  (${runs} runs)`);
  for (const key of ["win", "partial-network", "partial-community", "lose-coverage", "lose-fork"]) {
    console.log(`    ${key.padEnd(18)} ${pct(tally[key] ?? 0)}  ${String(tally[key] ?? 0).padStart(4)}`);
  }
  console.log(`    mean coverage      ${(100 * cov / runs).toFixed(1)}%`);
  console.log(`    mean cohesion      ${(coh / runs).toFixed(2)}`);
  console.log(`    motions carried    ${((100 * carried) / motions).toFixed(0)}% of ${(motions / runs).toFixed(1)} per run`);
  const close = margins.filter((m) => m <= 4).length;
  const mean = margins.reduce((a, b) => a + b, 0) / Math.max(1, margins.length);
  console.log(`    vote margin        ${mean.toFixed(1)} mean, ${((100 * close) / margins.length).toFixed(0)}% inside four votes`);
  console.log(`    still dark at end  ${(dark / runs).toFixed(1)} households`);
  console.log(`    landlord           noticed ${((100 * noticed) / runs).toFixed(0)}%, seized the stub ${((100 * seized) / runs).toFixed(0)}%`);
}

const runs = Number(process.argv[2] ?? 200);
report("whip", runs);
report("reads-the-room", runs);
report("engineer", runs);
report("bulldozer", runs);
console.log("");
