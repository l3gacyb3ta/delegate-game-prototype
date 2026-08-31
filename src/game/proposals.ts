// Proposals are generated from the graph, never authored one by one. That is
// what makes counterproposals possible: the room can hold an alternative
// nobody wrote down in advance, and score it by the same rules.

import { BYLAWS, COSTS } from "./content";
import {
  activeLinks,
  bareEnds,
  buildableLinks,
  degree,
  essentialsUp,
  liveSites,
  linkId,
  owner,
  reachable,
  reachableWith,
  site,
} from "./graph";
import type { Bloc, GameState, Link, Proposal } from "./types";

/** Who gains and who pays, worked out from the topology alone. */
export interface Interests {
  benefits: string[]; // NPC ids
  costs: string[]; // NPC ids
  sites: string[]; // sites the motion touches
  /** True when the motion puts the clinic on the network. */
  connectsClinic: boolean;
  /** True when it reaches anything the neighbourhood actually depends on. */
  connectsEssential: boolean;
  /** True when it extends the network at all. */
  extends: boolean;
}

function uniq(xs: string[]): string[] {
  return [...new Set(xs)];
}

export function interests(state: GameState, p: Proposal): Interests {
  const now = reachable(state);
  const benefits: string[] = [];
  const costs: string[] = [];
  let sites: string[] = [];
  let connectsClinic = false;
  let connectsEssential = false;
  let extended = false;

  if (p.kind === "build-link" && p.from && p.to && p.linkKind) {
    sites = [p.from, p.to];
    const probe: Link = {
      id: linkId(p.from, p.to),
      from: p.from,
      to: p.to,
      kind: p.linkKind,
      status: "active",
      reliability: 1,
      scar: 0,
    };
    const gained = [...reachableWith(state, probe)].filter((id) => !now.has(id));
    extended = gained.length > 0;
    connectsClinic = gained.includes("clinic");
    connectsEssential = gained.some((id) => site(state, id).essential);
    for (const id of gained) benefits.push(owner(state, id));

    for (const end of [p.from, p.to]) {
      const s = site(state, end);
      const gains = gained.includes(end);
      // Your roof, your power, your bandwidth — measured against what you get.
      if (!gains) costs.push(s.owner);
      if (!s.hasNode) costs.push(s.owner); // this motion bolts gear to it
      if (gains && s.power !== "grid") costs.push(s.owner);
      if (!gains && degree(state, end) >= 2) costs.push(s.owner);
    }
  }

  if (p.kind === "harden" && p.siteId) {
    sites = [p.siteId];
    benefits.push(owner(state, p.siteId));
    for (const l of activeLinks(state)) {
      if (l.from === p.siteId) benefits.push(owner(state, l.to));
      if (l.to === p.siteId) benefits.push(owner(state, l.from));
    }
  }

  if (p.kind === "raise-dues") {
    // Everyone pays dues. This is the motion that reads the room hardest.
    for (const n of state.npcs) costs.push(n.id);
  }

  if (p.kind === "bylaw") {
    const busiest = [...liveSites(state)].sort((a, b) => degree(state, b.id) - degree(state, a.id))[0];
    if (p.bylawId === "consent") {
      for (const s of liveSites(state)) if (!s.hasNode) benefits.push(s.owner);
    } else if (p.bylawId === "clinic-priority") {
      for (const s of liveSites(state)) if (s.essential || s.power !== "grid") benefits.push(s.owner);
      if (busiest) costs.push(busiest.owner);
      connectsClinic = true; // a priority rule is the clinic's win even unbuilt
      connectsEssential = true;
    } else if (p.bylawId === "mutual-aid") {
      const broken = state.links.filter((l) => l.status === "down");
      if (broken.length > 0) {
        for (const l of broken) benefits.push(owner(state, l.from), owner(state, l.to));
      } else {
        for (const id of now) benefits.push(owner(state, id));
      }
    } else if (p.bylawId === "open-books") {
      for (const n of state.npcs) if (!state.sites.some((s) => s.owner === n.id)) benefits.push(n.id);
      if (busiest) costs.push(busiest.owner);
    } else if (p.bylawId === "incorporate") {
      // Everyone who has something to lose if the stub is repossessed.
      for (const id of now) benefits.push(owner(state, id));
      const stub = liveSites(state).find((s) => s.uplink);
      if (stub) benefits.push(stub.owner);
    }
  }

  return {
    benefits: uniq(benefits),
    costs: uniq(costs),
    sites,
    connectsClinic,
    connectsEssential,
    extends: extended,
  };
}

/**
 * Where a bloc stands, structurally, before anybody's personal stake is
 * counted. This is the term the player is meant to be able to read off the
 * assembly panel: the connected do not want to pay for somebody else's roof,
 * and there are more of them every time you succeed.
 */
export function blocInterest(state: GameState, p: Proposal, b: Bloc, info: Interests): number {
  const satisfied = essentialsUp(state);

  if (b === "dark") {
    if (p.kind === "build-link") return info.extends ? 2 : 0.5;
    if (p.kind === "harden") return -1;
    if (p.kind === "raise-dues") return 0.5; // it is building money, and they want building
    if (p.bylawId === "mutual-aid") return -0.5;
    return 0;
  }

  if (b === "connected") {
    if (p.kind === "build-link") return -2.5; // their fund, someone else's roof
    if (p.kind === "harden") return 2;
    if (p.kind === "raise-dues") return -2;
    if (p.bylawId === "mutual-aid") return 1.5;
    if (p.bylawId === "incorporate") return 1;
    if (p.bylawId === "open-books" || p.bylawId === "consent") return 0.5;
    return 0;
  }

  if (b === "essential") {
    if (!satisfied) return info.connectsEssential ? 3 : -1;
    if (p.kind === "harden") return 1.5;
    if (p.kind === "build-link") return -0.5;
    if (p.kind === "raise-dues") return -1;
    return 0.5;
  }

  // Renters own no roof, pay dues anyway, and vote on precedent.
  if (p.kind === "bylaw") return p.bylawId === "incorporate" ? 2 : 1.5;
  if (p.kind === "raise-dues") return -2;
  return 0;
}

function linkMotion(state: GameState, from: string, to: string, kind: string): string {
  const gear = kind === "fso" ? "an optical link" : kind === "lora" ? "a LoRa fallback" : "a cable run";
  const bare = bareEnds(state, from, to);
  const mounting =
    bare.length === 0
      ? ""
      : `, mounting on ${bare.map((id) => site(state, id).name).join(" and ")}`;
  return `that the co-op string ${gear} from ${site(state, from).name} to ${site(state, to).name}${mounting}`;
}

function stakeholderVariant(state: GameState, p: Proposal, npcId: string): Proposal {
  const n = state.npcs.find((x) => x.id === npcId);
  return {
    ...p,
    id: `${p.id}+named:${npcId}`,
    motion: `${p.motion}, naming ${n ? n.name : npcId} as a stakeholder of record`,
    namedStakeholder: npcId,
  };
}

export function linkCost(state: GameState, from: string, to: string, kind: Link["kind"]): number {
  return COSTS[kind] + bareEnds(state, from, to).length * COSTS.mount;
}

/** The motions you could bring tonight, given the fund and the frontier. */
export function availableProposals(state: GameState): Proposal[] {
  const out: Proposal[] = [];

  for (const f of buildableLinks(state)) {
    const cost = linkCost(state, f.from, f.to, f.kind);
    if (cost > state.budget) continue;
    const base: Proposal = {
      id: `link:${linkId(f.from, f.to)}`,
      kind: "build-link",
      motion: linkMotion(state, f.from, f.to, f.kind),
      cost,
      from: f.from,
      to: f.to,
      linkKind: f.kind,
    };
    out.push(base);
    // Everyone whose roof, power or bandwidth this bills can be named as a
    // stakeholder instead of merely being billed. Which one you pick matters.
    for (const bearing of interests(state, base).costs) {
      out.push(stakeholderVariant(state, base, bearing));
    }
  }

  for (const s of liveSites(state)) {
    if (s.hardened || COSTS.harden > state.budget) continue;
    if (degree(state, s.id) === 0) continue;
    const scarred = state.links.some(
      (l) => (l.from === s.id || l.to === s.id) && l.scar > 0,
    );
    out.push({
      id: `harden:${s.id}`,
      kind: "harden",
      motion: `that the fund pay for a battery and a shroud at ${s.name}${
        scarred ? ", and make good what the weather has already taken out of it" : ""
      }`,
      cost: COSTS.harden,
      siteId: s.id,
    });
  }

  out.push({
    id: "dues",
    kind: "raise-dues",
    motion: "that monthly dues go up by four dollars a household",
    cost: 0,
  });

  for (const b of BYLAWS) {
    if (state.flags.bylaws.includes(b.id)) continue;
    out.push({ id: `bylaw:${b.id}`, kind: "bylaw", motion: b.motion, cost: 0, bylawId: b.id });
  }

  return out;
}

/**
 * When your motion dies, somebody stands up and says "what about instead".
 * These are the things they could plausibly mean.
 */
export function counterproposals(state: GameState, failed: Proposal): Proposal[] {
  const all = availableProposals(state);
  const sameKind = all.filter((p) => p.kind === failed.kind && p.id !== failed.id);
  const out: Proposal[] = [];

  if (failed.kind === "build-link" && failed.from && failed.to) {
    // Same corner of the map, somebody else's roof. The classic amendment.
    const ends = [failed.from, failed.to];
    out.push(...sameKind.filter((p) => ends.includes(p.from ?? "") || ends.includes(p.to ?? "")));
    out.push(...sameKind.slice(0, 2));
    // Or: spend the evening on what is already up instead of on more of it.
    out.push(...all.filter((p) => p.kind === "harden").slice(0, 2));
  } else if (failed.kind === "harden" || failed.kind === "raise-dues") {
    out.push(...sameKind.slice(0, 2));
    out.push(...all.filter((p) => p.kind === "build-link" && !p.namedStakeholder).slice(0, 2));
  } else if (failed.kind === "bylaw") {
    out.push(...sameKind.slice(0, 3));
    out.push(...all.filter((p) => p.kind === "harden").slice(0, 1));
  }

  // The version of your own motion that asks first is always in the room.
  if (!failed.namedStakeholder && failed.kind === "build-link") {
    for (const bearing of interests(state, failed).costs) {
      out.push(stakeholderVariant(state, failed, bearing));
    }
  }

  const seen = new Set<string>([failed.id]);
  return out.filter((p) => {
    if (seen.has(p.id) || p.cost > state.budget) return false;
    seen.add(p.id);
    return true;
  });
}
