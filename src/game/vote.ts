// The heart of it. Every term here is derived from the graph or from the
// social state; nothing is authored against a specific proposal, which is why
// the council can score a motion it invented itself.

import { reachable, site } from "./graph";
import { interests } from "./proposals";
import { drawRange } from "./rng";
import type { Ballot, GameState, NPC, Proposal, VoteResult } from "./types";

export const TRUST_WEIGHT = 0.8;
export const GRUDGE_PENALTY = -1.5;
export const FLARE_PENALTY = -1;

function noiseWidth(state: GameState): number {
  // With votes on the record, people argue their interests instead of hedging.
  return state.flags.bylaws.includes("open-books") ? 0.3 : 0.5;
}

/** Everything except the die roll. Used to rank counterproposals. */
export function scoreTerms(state: GameState, p: Proposal, n: NPC) {
  const info = interests(state, p);
  const owned = state.sites.filter((s) => s.owner === n.id).map((s) => s.id);
  const touchesMine = info.sites.some((id) => owned.includes(id));

  let selfInterest = 0;
  if (info.benefits.includes(n.id)) selfInterest += 2;
  if (info.costs.includes(n.id)) selfInterest -= 2;

  const grudge = info.benefits.some((b) => b !== n.id && n.grudges.includes(b))
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

  // A motion whose host owner is publicly against it arrives half dead, even
  // when that owner has no vote.
  let objection = 0;
  for (const id of info.sites) {
    const o = state.npcs.find((x) => x.id === site(state, id).owner);
    if (o && !o.councilMember && o.trust < 0 && o.id !== n.id) objection -= 0.5;
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

  const trustTerm = TRUST_WEIGHT * n.trust;
  return { selfInterest, trustTerm, grudge, flare: flare + objection, quirk };
}

export function expectedScore(state: GameState, p: Proposal, n: NPC): number {
  const t = scoreTerms(state, p, n);
  return t.selfInterest + t.trustTerm + t.grudge + t.flare + t.quirk;
}

/** Mean expected score across the council — how the room leans, before the die. */
export function councilLean(state: GameState, p: Proposal): number {
  const council = state.npcs.filter((n) => n.councilMember);
  if (council.length === 0) return 0;
  return council.reduce((s, n) => s + expectedScore(state, p, n), 0) / council.length;
}

export function castVote(
  state: GameState,
  proposal: Proposal,
  cursor: number,
): { result: VoteResult; next: number } {
  const width = noiseWidth(state);
  let rng = cursor;
  const ballots: Ballot[] = [];

  for (const n of state.npcs.filter((x) => x.councilMember)) {
    const t = scoreTerms(state, proposal, n);
    const d = drawRange(rng, -width, width);
    rng = d.next;
    const score = t.selfInterest + t.trustTerm + t.grudge + t.flare + t.quirk + d.value;
    ballots.push({
      npcId: n.id,
      yes: score > 0,
      selfInterest: t.selfInterest,
      trustTerm: t.trustTerm,
      grudge: t.grudge,
      flare: t.flare,
      quirk: t.quirk,
      noise: d.value,
      score,
    });
  }

  const yes = ballots.filter((b) => b.yes).length;
  const no = ballots.length - yes;
  return {
    result: { proposal, ballots, passed: yes > ballots.length / 2, yes, no },
    next: rng,
  };
}
