// One card a night at most, weighted by the state of the graph. The drama is
// meant to come out of the neighbourhood, not out of the deck.

import { EVENT_CARDS, QUIET_NIGHTS } from "./content";
import { cohesion, degree, liveSites, reachable, site } from "./graph";
import { drawRange } from "./rng";
import type { GameState, LogEntry } from "./types";
import { COHESION_FORK, LANDLORD_FUSE, TURNS } from "./content";

type Candidate = { id: string; weight: number };

function candidates(state: GameState): Candidate[] {
  const out: Candidate[] = [{ id: "quiet", weight: 2 }];

  const sinceStorm = state.turn - state.flags.lastStorm;
  if (state.flags.stormEta === null && state.turn >= 3 && state.turn <= TURNS - 3 && sinceStorm >= 5) {
    out.push({ id: "storm", weight: 3 });
  }
  // Discontent has to have been there a while before anybody says it out loud.
  if (state.flags.fork === null && state.turn >= 7 && cohesion(state) < COHESION_FORK) {
    out.push({ id: "fork", weight: 5 });
  }
  if (state.flags.hoarder === null && !state.flags.bylaws.includes("clinic-priority")) {
    if (liveSites(state).some((s) => degree(state, s.id) >= 2)) out.push({ id: "hoarder", weight: 3 });
  }
  if (state.flags.flare === null && state.npcs.some((n) => n.grudges.length > 0)) {
    out.push({ id: "flare", weight: 3 });
  }
  // The one card that is not weather and not a grievance. It arrives once, on
  // its own schedule, and no amount of time on a roof answers it.
  if (
    state.flags.landlord === null &&
    state.flags.seizedUntil === null &&
    !state.flags.bylaws.includes("incorporate") &&
    state.turn >= 4 &&
    state.turn <= 9
  ) {
    out.push({ id: "landlord", weight: 6 });
  }
  return out;
}

/** Whoever has the most households and the most roofs has somewhere to go. */
function forkLeader(state: GameState): string | null {
  const uplinkOwner = state.sites.find((s) => s.uplink)?.owner;
  const ranked = state.npcs
    .filter((n) => n.id !== uplinkOwner && n.households > 0)
    .map((n) => ({
      id: n.id,
      pull:
        n.households +
        state.sites
          .filter((s) => s.owner === n.id && !state.seceded.includes(s.id))
          .reduce((sum, s) => sum + 1 + degree(state, s.id), 0),
      trust: n.trust,
    }))
    .sort((a, b) => b.pull - a.pull || a.trust - b.trust || a.id.localeCompare(b.id));
  const top = ranked[0];
  return top && top.pull > 0 ? top.id : null;
}

export function drawEvent(
  state: GameState,
  cursor: number,
): { state: GameState; next: number; entry: LogEntry | null } {
  const pool = candidates(state);
  const total = pool.reduce((s, c) => s + c.weight, 0);
  const d = drawRange(cursor, 0, total);
  let rng = d.next;
  let roll = d.value;
  let chosen = pool[pool.length - 1];
  for (const c of pool) {
    if (roll < c.weight) {
      chosen = c;
      break;
    }
    roll -= c.weight;
  }
  if (!chosen) return { state, next: rng, entry: null };

  const flags = { ...state.flags, bylaws: [...state.flags.bylaws] };
  let text = "";

  if (chosen.id === "storm") {
    flags.stormEta = state.turn + 2;
    flags.lastStorm = state.turn + 2;
    text = `${EVENT_CARDS.storm?.text ?? ""} It makes landfall on day ${flags.stormEta}.`;
  } else if (chosen.id === "fork") {
    const leader = forkLeader(state);
    if (leader) {
      flags.fork = { npcId: leader, deadline: state.turn + 2 };
      const n = state.npcs.find((x) => x.id === leader);
      text = `${n?.name ?? leader} ${EVENT_CARDS.fork?.text ?? ""}`;
    } else {
      text = EVENT_CARDS.quiet?.text ?? "";
    }
  } else if (chosen.id === "hoarder") {
    const busiest = [...liveSites(state)].sort((a, b) => degree(state, b.id) - degree(state, a.id))[0];
    if (busiest) {
      flags.hoarder = { siteId: busiest.id, since: state.turn };
      flags.drag = 0.1;
      text = `${busiest.name} ${EVENT_CARDS.hoarder?.text ?? ""}`;
    }
  } else if (chosen.id === "landlord") {
    flags.landlord = { deadline: state.turn + LANDLORD_FUSE };
    text = `${EVENT_CARDS.landlord?.text ?? ""} They have given the co-op until day ${flags.landlord.deadline}.`;
  } else if (chosen.id === "flare") {
    const sore = state.npcs.filter((n) => n.grudges.length > 0);
    const pickIdx = drawRange(rng, 0, sore.length);
    rng = pickIdx.next;
    const a = sore[Math.floor(pickIdx.value)] ?? sore[0];
    const bId = a?.grudges[0];
    const b = state.npcs.find((x) => x.id === bId);
    if (a && b) {
      flags.flare = { a: a.id, b: b.id, until: state.turn + 2 };
      text = `${a.name} and ${b.name} ${EVENT_CARDS.flare?.text ?? ""}`;
    }
  } else {
    const q = drawRange(rng, 0, QUIET_NIGHTS.length);
    rng = q.next;
    text = QUIET_NIGHTS[Math.floor(q.value)] ?? QUIET_NIGHTS[0] ?? "";
  }

  if (!text) return { state, next: rng, entry: null };
  const card = EVENT_CARDS[chosen.id];
  return {
    state: { ...state, flags },
    next: rng,
    entry: { turn: state.turn, kind: "event", text: `${card ? card.title + ". " : ""}${text}` },
  };
}

/** Old business stops being radioactive once people have had a week of it. */
export function expireFlare(state: GameState): GameState {
  const f = state.flags.flare;
  if (!f || state.turn <= f.until) return state;
  return { ...state, flags: { ...state.flags, flare: null } };
}

/** A fork nobody talked down takes its subgraph with it. */
export function resolveFork(state: GameState): { state: GameState; entry: LogEntry | null } {
  const fork = state.flags.fork;
  if (!fork || state.turn < fork.deadline) return { state, entry: null };

  const n = state.npcs.find((x) => x.id === fork.npcId);
  const flags = { ...state.flags, fork: null, bylaws: [...state.flags.bylaws] };

  if (!n || n.trust >= 1) {
    return {
      state: { ...state, flags },
      entry: {
        turn: state.turn,
        kind: "event",
        text: `${n?.name ?? "The matter"} let it drop. Whatever was said on the steps, it was not said again.`,
      },
    };
  }

  const theirs = state.sites.filter((s) => s.owner === n.id).map((s) => s.id);
  const cut = { ...state, seceded: [...new Set([...state.seceded, ...theirs])], flags };
  // They leave with their connected subgraph: everything downstream of their
  // roofs goes too, because that is the only way it ever reached the stub.
  const stillUp = reachable(cut);
  const stranded = cut.sites
    .filter((s) => !cut.seceded.includes(s.id) && !stillUp.has(s.id))
    .map((s) => s.id);
  const after = { ...cut, seceded: [...cut.seceded, ...stranded] };
  const names = theirs.map((id) => site(state, id).name).join(" and ");

  return {
    state: after,
    entry: {
      turn: state.turn,
      kind: "event",
      text: `${n.name} left the co-op and took ${names} with them.${
        stranded.length > 0
          ? ` ${stranded.length} more site${stranded.length === 1 ? "" : "s"} went dark in the process, having reached the stub only through those roofs.`
          : ""
      }`,
    },
  };
}
