// One JSON object in, one JSON object out. Every draw of the die goes through
// state.rng, so a seed plus a list of actions reproduces a run exactly.

import {
  ACTIONS_PER_DAY,
  BYLAWS,
  COSTS,
  DIMINISHING_VISITS,
  FEASIBLE,
  TRUST_DECAY,
  TRUST_ON_BEING_NAMED,
  TRUST_ON_BENEFIT,
  TRUST_ON_COST,
  TRUST_ON_LOST_MOTION,
  MONOLOGUE_TOKENS,
  NPCS,
  SITES,
  STARTING_BUDGET,
  STARTING_LINKS,
  TURNS,
} from "./content";
import { drawEvent, expireFlare, resolveFork } from "./events";
import { coverage, linkId, reliabilityOf, site } from "./graph";
import { evaluate } from "./outcome";
import { availableProposals, counterproposals, interests } from "./proposals";
import { draw } from "./rng";
import { castVote, councilLean } from "./vote";
import type {
  GameAction,
  GameState,
  LogEntry,
  NPC,
  PlayerAction,
  Proposal,
  VoteResult,
  WeatherKind,
} from "./types";

const clamp = (n: number, lo = -3, hi = 3) => Math.max(lo, Math.min(hi, n));

export function initialState(seed: number): GameState {
  return {
    seed,
    rng: seed | 0,
    turn: 0,
    phase: "morning",
    actionsLeft: 0,
    tokens: MONOLOGUE_TOKENS,
    budget: STARTING_BUDGET,
    weather: "clear",
    sites: SITES.map((s) => ({ ...s })),
    npcs: NPCS.map((n) => ({ ...n, grudges: [...n.grudges] })),
    links: STARTING_LINKS.map((l) => ({ ...l })),
    feasible: FEASIBLE.map((f) => ({ ...f })),
    scouted: ["rialto", "garage", "laundromat"],
    revealed: [],
    seceded: [],
    flags: { stormEta: null, lastStorm: -99, hoarder: null, flare: null, fork: null, bylaws: [], drag: 0 },
    log: [
      {
        turn: 0,
        kind: "minute",
        text: "You were elected delegate on a show of hands, eleven to four, in the back of the Superior Wash. The fiber stub at the Rialto works. Two links hang off it. Everything else on the map is dark, and the council meets every evening for the next twenty days.",
      },
    ],
    lastVote: null,
    pendingCounter: null,
    outcome: null,
  };
}

function log(
  state: GameState,
  kind: LogEntry["kind"],
  text: string,
  tone?: LogEntry["tone"],
): LogEntry[] {
  return [...state.log, { turn: state.turn, kind, text, tone }];
}

function withNpc(state: GameState, id: string, f: (n: NPC) => NPC): NPC[] {
  return state.npcs.map((n) => (n.id === id ? f(n) : n));
}

function rollWeather(state: GameState): { weather: WeatherKind; next: number } {
  if (state.flags.stormEta !== null && state.turn >= state.flags.stormEta) {
    return { weather: "storm", next: draw(state.rng).next };
  }
  const d = draw(state.rng);
  const w: WeatherKind = d.value < 0.4 ? "clear" : d.value < 0.75 ? "fog" : "rain";
  return { weather: w, next: d.next };
}

const WEATHER_TEXT: Record<WeatherKind, string> = {
  clear: "Clear and cold. Every beam on the map is doing what it was aimed to do.",
  fog: "Fog off the lake, thick to the third floor. The optical links are guessing.",
  rain: "Rain all day, steady. The beams hold, mostly, and the roofs are miserable to be on.",
  storm: "The storm. Wind off the water and horizontal rain, and the sound the water tower makes.",
};

/** Morning: weather, storm damage, a card, dues, and whatever a fork decided. */
function openDay(state: GameState): GameState {
  let s: GameState = expireFlare(
    decay({ ...state, turn: state.turn + 1, phase: "day", lastVote: null, pendingCounter: null }),
  );
  const { weather, next } = rollWeather(s);
  s = { ...s, weather, rng: next };

  // Drag grows while a hoarder goes unaddressed.
  if (s.flags.hoarder) s = { ...s, flags: { ...s.flags, drag: Math.min(0.25, s.flags.drag + 0.04) } };

  s = { ...s, links: s.links.map((l) => ({ ...l, reliability: reliabilityOf(s, l, weather) })) };
  s = { ...s, log: log(s, "day", `Day ${s.turn}.`) };
  s = { ...s, log: log(s, "weather", WEATHER_TEXT[weather]) };

  if (weather === "storm") {
    const fragile = s.links.filter((l) => l.status === "active" && l.reliability < 0.5);
    s = {
      ...s,
      links: s.links.map((l) =>
        l.status === "active" && l.reliability < 0.5 ? { ...l, status: "down" } : l,
      ),
      flags: { ...s.flags, stormEta: null },
    };
    s = {
      ...s,
      log: log(
        s,
        "event",
        fragile.length === 0
          ? "The storm came through and the network did not notice. Somebody should write down that this is what hardening buys."
          : `The storm took down ${fragile.length} link${fragile.length === 1 ? "" : "s"}: ${fragile
              .map((l) => `${site(s, l.from).name} to ${site(s, l.to).name}`)
              .join("; ")}.`,
      ),
    };
  }

  // Mutual aid: a crew goes out each morning without being asked.
  if (s.flags.bylaws.includes("mutual-aid")) {
    const broken = s.links.find((l) => l.status === "down");
    if (broken) {
      s = {
        ...s,
        links: s.links.map((l) => (l.id === broken.id ? { ...l, status: "active" } : l)),
        log: log(
          s,
          "event",
          `Under the mutual aid rule, a crew re-aimed ${site(s, broken.from).name} to ${site(s, broken.to).name} before anyone asked them to.`,
        ),
      };
    }
  }

  const forked = resolveFork(s);
  s = forked.state;
  if (forked.entry) s = { ...s, log: [...s.log, forked.entry] };

  const ev = drawEvent(s, s.rng);
  s = { ...ev.state, rng: ev.next };
  if (ev.entry) s = { ...s, log: [...s.log, ev.entry] };

  if (s.turn % 2 === 1) s = { ...s, budget: s.budget + 1 };

  return { ...s, actionsLeft: ACTIONS_PER_DAY };
}

function trustGain(n: NPC): number {
  if (!DIMINISHING_VISITS) return 1;
  return Number((1.0 / (n.visits + 1)).toFixed(3));
}

/** Everyone drifts back toward indifference. Goodwill is not a bank balance. */
function decay(state: GameState): GameState {
  return {
    ...state,
    npcs: state.npcs.map((n) => {
      const t = n.trust * (1 - TRUST_DECAY);
      if (Math.abs(t) < 0.05) return n.trust === 0 ? n : { ...n, trust: 0 };
      return { ...n, trust: Number(t.toFixed(3)) };
    }),
  };
}

function takeAction(state: GameState, a: PlayerAction): GameState {
  if (state.actionsLeft <= 0) return state;
  let s = { ...state, actionsLeft: state.actionsLeft - 1 };

  if (a.type === "VISIT") {
    const n = s.npcs.find((x) => x.id === a.npcId);
    if (!n) return state;
    const gain = trustGain(n);
    s = {
      ...s,
      npcs: withNpc(s, a.npcId, (x) => ({ ...x, trust: clamp(x.trust + gain), visits: x.visits + 1 })),
    };
    return {
      ...s,
      log: log(
        s,
        "action",
        `Called on ${n.name}. "${n.publicPosition}"${
          gain < 1 ? " You have had this conversation before, and it went about as far as it went last time." : ""
        }`,
      ),
    };
  }

  if (a.type === "MONOLOGUE") {
    if (s.tokens <= 0 || s.revealed.includes(a.npcId)) return state;
    const n = s.npcs.find((x) => x.id === a.npcId);
    if (!n) return state;
    s = { ...s, tokens: s.tokens - 1, revealed: [...s.revealed, a.npcId] };
    return { ...s, log: log(s, "action", `${n.name}, eventually, once the room was empty: ${n.trueMotivation}`) };
  }

  if (a.type === "SCOUT") {
    if (s.scouted.includes(a.siteId)) return state;
    const st = site(s, a.siteId);
    s = { ...s, scouted: [...s.scouted, a.siteId] };
    return { ...s, log: log(s, "action", `Walked ${st.name}. ${st.note}`) };
  }

  const link = s.links.find((l) => l.id === a.linkId);
  if (!link || link.status !== "down") return state;
  s = {
    ...s,
    links: s.links.map((l) => (l.id === a.linkId ? { ...l, status: "active" } : l)),
  };
  return {
    ...s,
    log: log(s, "action", `Spent the afternoon on a roof re-aiming ${site(s, link.from).name} to ${site(s, link.to).name}. It is back up.`),
  };
}

/** You must execute whatever passes, including the motions you argued against. */
function execute(state: GameState, p: Proposal): GameState {
  const info = interests(state, p);
  let s = { ...state, budget: state.budget - p.cost };

  if (p.kind === "build-link" && p.from && p.to && p.linkKind) {
    const id = linkId(p.from, p.to);
    const link = {
      id,
      from: p.from,
      to: p.to,
      kind: p.linkKind,
      status: "active" as const,
      reliability: 0.9,
    };
    s = { ...s, links: [...s.links, link] };
    s = { ...s, links: s.links.map((l) => ({ ...l, reliability: reliabilityOf(s, l, s.weather) })) };
  } else if (p.kind === "mount-node" && p.siteId) {
    s = { ...s, sites: s.sites.map((x) => (x.id === p.siteId ? { ...x, hasNode: true } : x)) };
  } else if (p.kind === "harden" && p.siteId) {
    s = { ...s, sites: s.sites.map((x) => (x.id === p.siteId ? { ...x, hardened: true } : x)) };
    if (s.flags.hoarder?.siteId === p.siteId) {
      s = { ...s, flags: { ...s.flags, hoarder: null, drag: 0 } };
    }
  } else if (p.kind === "raise-dues") {
    s = { ...s, budget: s.budget + COSTS.duesGain };
  } else if (p.kind === "bylaw" && p.bylawId) {
    s = { ...s, flags: { ...s.flags, bylaws: [...s.flags.bylaws, p.bylawId] } };
    if (p.bylawId === "clinic-priority") s = { ...s, flags: { ...s.flags, hoarder: null, drag: 0 } };
  }

  // The social consequence of a decision you may not have wanted.
  s = {
    ...s,
    npcs: s.npcs.map((n) => {
      let t = n.trust;
      if (info.benefits.includes(n.id)) t += TRUST_ON_BENEFIT;
      if (info.costs.includes(n.id)) t += TRUST_ON_COST;
      if (p.namedStakeholder === n.id) t += TRUST_ON_BEING_NAMED;
      return t === n.trust ? n : { ...n, trust: Number(clamp(t).toFixed(3)) };
    }),
  };

  const bylaw = p.bylawId ? BYLAWS.find((b) => b.id === p.bylawId) : undefined;
  return { ...s, log: log(s, "execution", executionMinute(s, p, bylaw?.minute)) };
}

function executionMinute(s: GameState, p: Proposal, bylawMinute?: string): string {
  if (bylawMinute) return bylawMinute;
  if (p.kind === "build-link" && p.from && p.to) {
    return `Carried into effect: ${site(s, p.from).name} to ${site(s, p.to).name} is up. Coverage now stands at ${Math.round(coverage(s) * 100)}% of the map.`;
  }
  if (p.kind === "mount-node" && p.siteId) {
    return `Carried into effect: there is co-op equipment on ${site(s, p.siteId).name} as of this evening.`;
  }
  if (p.kind === "harden" && p.siteId) {
    return `Carried into effect: a battery and a shroud at ${site(s, p.siteId).name}. It will hold in weather that would have taken it down.`;
  }
  return `Carried into effect: dues go up by four dollars. The fund stands at ${s.budget}.`;
}

function tally(state: GameState, v: VoteResult, kind: "motion" | "counter"): string {
  const named = (id: string) => state.npcs.find((n) => n.id === id)?.name ?? id;
  const ayes = v.ballots.filter((b) => b.yes).map((b) => named(b.npcId));
  const noes = v.ballots.filter((b) => !b.yes).map((b) => named(b.npcId));
  const head =
    kind === "counter"
      ? "On the amendment"
      : "On the motion";
  const tie = !v.passed && v.yes === v.no;
  return `${head}: ${v.yes} in favour, ${v.no} against. ${
    ayes.length > 0 ? `Aye: ${ayes.join(", ")}. ` : ""
  }${noes.length > 0 ? `No: ${noes.join(", ")}. ` : ""}${
    v.passed ? "Carried." : tie ? "Tied, and the chair does not break ties. Not carried." : "Not carried."
  }`;
}

function closeNight(state: GameState): GameState {
  let s = state;
  const forkShare = s.seceded.length / s.sites.length;
  if (s.turn >= TURNS || forkShare > 0.4) {
    const outcome = evaluate(s);
    return { ...s, phase: "over", outcome, log: log(s, "ending", outcome.epilogue) };
  }
  return { ...s, phase: "morning" };
}

function holdVote(state: GameState, p: Proposal): GameState {
  const { result, next } = castVote(state, p, state.rng);
  let s: GameState = { ...state, rng: next, lastVote: result };
  s = { ...s, log: log(s, "motion", `The delegate moves ${p.motion}.`) };
  s = { ...s, log: log(s, "vote", tally(s, result, "motion"), result.passed ? "carried" : "lost") };

  if (result.passed) return closeNight(execute(s, p));

  // A delegate who keeps bringing motions the room will not carry spends
  // something every time, whether or not they notice.
  const opposed = new Set(result.ballots.filter((b) => !b.yes).map((b) => b.npcId));
  s = {
    ...s,
    npcs: s.npcs.map((n) =>
      opposed.has(n.id) ? { ...n, trust: Number(clamp(n.trust + TRUST_ON_LOST_MOTION).toFixed(3)) } : n,
    ),
  };

  // Somebody in the room has an alternative. It gets a vote tonight, and if it
  // carries you are the one who has to go and build it.
  const options = counterproposals(s, p);
  if (options.length === 0) {
    s = { ...s, log: log(s, "minute", "Nobody had an alternative in hand. The meeting adjourned early and badly.") };
    return closeNight(s);
  }
  const best = [...options].sort((a, b) => councilLean(s, b) - councilLean(s, a))[0];
  if (!best) return closeNight(s);

  const counter = castVote(s, best, s.rng);
  s = { ...s, rng: counter.next, pendingCounter: counter.result, phase: "counter" };
  s = { ...s, log: log(s, "motion", `${counterSpeaker(s, best)} moves instead ${best.motion}.`) };
  s = { ...s, log: log(s, "vote", tally(s, counter.result, "counter"), counter.result.passed ? "carried" : "lost") };
  if (counter.result.passed) s = execute(s, best);
  else s = { ...s, log: log(s, "minute", "The amendment failed too. The meeting adjourned with nothing decided, which is itself a decision.") };
  return s;
}

/** Whoever the amendment most obviously helps is the one who stands up. */
function counterSpeaker(state: GameState, p: Proposal): string {
  const info = interests(state, p);
  const council = state.npcs.filter((n) => n.councilMember);
  const speaker =
    council.find((n) => info.benefits.includes(n.id)) ??
    [...council].sort((a, b) => b.trust - a.trust)[0];
  return speaker ? speaker.name : "A voice from the back";
}

export function reduce(state: GameState, action: GameAction): GameState {
  if (state.phase === "over") return state;

  switch (action.type) {
    case "OPEN_DAY":
      return state.phase === "morning" ? openDay(state) : state;
    case "ACT":
      return state.phase === "day" ? takeAction(state, action.action) : state;
    case "SKIP_ACTIONS":
      return state.phase === "day" ? { ...state, actionsLeft: 0 } : state;
    case "CONVENE":
      return state.phase === "day" ? { ...state, phase: "council" } : state;
    case "PROPOSE": {
      if (state.phase !== "council") return state;
      const p = availableById(state, action.proposalId);
      return p ? holdVote(state, p) : state;
    }
    case "ABSTAIN": {
      if (state.phase !== "council") return state;
      const s = {
        ...state,
        log: log(
          state,
          "minute",
          "The delegate brought no motion. The council spent the evening on the minutes of the previous evening.",
        ),
      };
      return closeNight(s);
    }
    case "ACCEPT_COUNTER":
      return state.phase === "counter" ? closeNight({ ...state, pendingCounter: null }) : state;
    default:
      return state;
  }
}

function availableById(state: GameState, id: string): Proposal | undefined {
  return availableProposals(state).find((p) => p.id === id);
}
