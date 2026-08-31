// The heart of it. Nothing here is authored against a specific motion: a
// constituency's position is its bloc's structural interest plus its own stake
// in the topology, and both fall out of the graph.
//
// Votes resolve at the scale of the neighbourhood rather than of six minds.
// A constituency returns a *split*, not a yes or a no, so a decisive motion
// carries a bloc nearly whole and a marginal one visibly divides it. That is
// what makes a lost vote answerable: you can see which bloc broke against you
// and how badly.

import { VOTE_NOISE, VOTE_SHARPNESS } from "./content";
import { bloc, reachable } from "./graph";
import { blocInterest, interests } from "./proposals";
import { drawRange } from "./rng";
import type { Ballot, BlocTally, GameState, NPC, Proposal, VoteResult } from "./types";

export const TRUST_WEIGHT = 0.8;
export const GRUDGE_PENALTY = -1.5;
export const FLARE_PENALTY = -1;
const SELF_INTEREST = 1.5;

function noiseWidth(state: GameState): number {
  // With votes on the record, people argue their interests instead of hedging.
  return state.flags.bylaws.includes("open-books") ? VOTE_NOISE * 0.6 : VOTE_NOISE;
}

/** Everything except the die roll. Also used to rank counterproposals. */
export function scoreTerms(state: GameState, p: Proposal, n: NPC) {
  const info = interests(state, p);
  const owned = state.sites.filter((s) => s.owner === n.id).map((s) => s.id);
  const touchesMine = info.sites.some((id) => owned.includes(id));
  const b = bloc(state, n);

  // Where the bloc stands, and then where this particular constituency does.
  const blocTerm = blocInterest(state, p, b, info);
  let selfInterest = 0;
  if (info.benefits.includes(n.id)) selfInterest += SELF_INTEREST;
  if (info.costs.includes(n.id)) selfInterest -= SELF_INTEREST;

  const grudge = info.benefits.some((x) => x !== n.id && n.grudges.includes(x))
    ? GRUDGE_PENALTY
    : 0;

  let flare = 0;
  const f = state.flags.flare;
  if (f && state.turn <= f.until) {
    const radioactive = state.sites
      .filter((s) => s.owner === f.a || s.owner === f.b)
      .map((s) => s.id);
    if (info.sites.some((id) => radioactive.includes(id))) flare += FLARE_PENALTY;
  }

  let quirk = 0;
  if (n.quirk === "consultation") {
    if (p.namedStakeholder === n.id) quirk += 3.5;
    else if (touchesMine) quirk -= 1;
  }
  if (n.quirk === "clinic-first") {
    const clinicUp = reachable(state).has("clinic");
    if (info.connectsClinic) quirk += 3;
    else if (!clinicUp) quirk -= 1;
  }
  // Being asked is worth something to everyone, just not three and a half.
  if (p.namedStakeholder === n.id && n.quirk !== "consultation") quirk += 1;

  return { bloc: b, blocInterest: blocTerm, selfInterest, trustTerm: TRUST_WEIGHT * n.trust, grudge, flare, quirk };
}

export function expectedScore(state: GameState, p: Proposal, n: NPC): number {
  const t = scoreTerms(state, p, n);
  return t.blocInterest + t.selfInterest + t.trustTerm + t.grudge + t.flare + t.quirk;
}

/** How the room leans overall, weighted by households. Never shown to the player. */
export function assemblyLean(state: GameState, p: Proposal): number {
  const total = state.npcs.reduce((s, n) => s + n.households, 0);
  if (total === 0) return 0;
  return state.npcs.reduce((s, n) => s + expectedScore(state, p, n) * n.households, 0) / total;
}

/** A score becomes the share of a constituency that votes aye. */
export function shareFor(score: number, wobble: number): number {
  return Math.max(0, Math.min(1, 0.5 + VOTE_SHARPNESS * score + wobble));
}

export function castVote(
  state: GameState,
  proposal: Proposal,
  cursor: number,
): { result: VoteResult; next: number } {
  const width = noiseWidth(state);
  let rng = cursor;
  const ballots: Ballot[] = [];

  for (const n of state.npcs) {
    if (n.households <= 0) continue;
    const t = scoreTerms(state, proposal, n);
    const d = drawRange(rng, -width, width);
    rng = d.next;
    const score = t.blocInterest + t.selfInterest + t.trustTerm + t.grudge + t.flare + t.quirk;
    const yes = Math.round(n.households * shareFor(score, d.value));
    ballots.push({
      npcId: n.id,
      bloc: t.bloc,
      households: n.households,
      yes,
      no: n.households - yes,
      blocInterest: t.blocInterest + t.selfInterest,
      trustTerm: t.trustTerm,
      grudge: t.grudge,
      flare: t.flare,
      quirk: t.quirk,
      score,
    });
  }

  const blocs: BlocTally[] = [];
  for (const b of ballots) {
    const row = blocs.find((x) => x.bloc === b.bloc);
    if (row) {
      row.households += b.households;
      row.yes += b.yes;
      row.no += b.no;
    } else {
      blocs.push({ bloc: b.bloc, households: b.households, yes: b.yes, no: b.no });
    }
  }
  blocs.sort((a, b) => b.households - a.households);

  const yes = ballots.reduce((s, b) => s + b.yes, 0);
  const no = ballots.reduce((s, b) => s + b.no, 0);
  return { result: { proposal, ballots, blocs, passed: yes > no, yes, no }, next: rng };
}
