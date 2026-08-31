// Proposals are generated from the graph, never authored one by one. That is
// what makes counterproposals possible: the council can hold an alternative
// nobody wrote down in advance.

import { BYLAWS, COSTS } from "./content";
import {
  activeLinks,
  buildableLinks,
  degree,
  liveSites,
  linkId,
  owner,
  reachable,
  reachableWith,
  site,
} from "./graph";
import type { GameState, Link, Proposal } from "./types";

/** Who gains and who pays, worked out from the topology alone. */
export interface Interests {
  benefits: string[]; // NPC ids
  costs: string[]; // NPC ids
  sites: string[]; // sites the motion touches
  /** True when the motion puts the clinic on the network. */
  connectsClinic: boolean;
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

  if (p.kind === "build-link" && p.from && p.to && p.linkKind) {
    sites = [p.from, p.to];
    const probe: Link = {
      id: linkId(p.from, p.to),
      from: p.from,
      to: p.to,
      kind: p.linkKind,
      status: "active",
      reliability: 1,
    };
    const after = reachableWith(state, probe);
    const gained = [...after].filter((id) => !now.has(id));
    connectsClinic = gained.includes("clinic");
    for (const id of gained) benefits.push(owner(state, id));
    for (const end of [p.from, p.to]) {
      const s = site(state, end);
      const gains = gained.includes(end);
      // Your roof, your power, your bandwidth — and nothing new for you.
      if (!gains) costs.push(s.owner);
      else if (s.power !== "grid") costs.push(s.owner);
      if (!gains && degree(state, end) >= 2) costs.push(s.owner);
    }
  }

  if (p.kind === "mount-node" && p.siteId) {
    sites = [p.siteId];
    const s = site(state, p.siteId);
    costs.push(s.owner); // gear on your roof is a cost before it is anything else
    // Anyone whose route to the uplink would run through this roof.
    for (const f of state.feasible) {
      const other = f.from === p.siteId ? f.to : f.to === p.siteId ? f.from : null;
      if (!other) continue;
      if (now.has(other)) benefits.push(s.owner); // this site is next in line
      else if (!site(state, other).hasNode) continue;
      else benefits.push(owner(state, other)); // stepping stone for a neighbour
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
      for (const s of liveSites(state)) if (s.power !== "grid") benefits.push(s.owner);
      if (busiest) costs.push(busiest.owner);
      connectsClinic = true; // a priority rule is the clinic's win even unbuilt
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
    }
  }

  return { benefits: uniq(benefits), costs: uniq(costs), sites, connectsClinic };
}

function linkMotion(state: GameState, from: string, to: string, kind: string): string {
  const a = site(state, from).name;
  const b = site(state, to).name;
  const gear = kind === "fso" ? "an optical link" : kind === "lora" ? "a LoRa fallback" : "a cable run";
  return `that the co-op string ${gear} from ${a} to ${b}`;
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

/** The motions you could bring to council tonight, given the fund and the map. */
export function availableProposals(state: GameState): Proposal[] {
  const out: Proposal[] = [];

  for (const f of buildableLinks(state)) {
    const cost = COSTS[f.kind];
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
    if (s.hasNode || COSTS.mount > state.budget) continue;
    const base: Proposal = {
      id: `mount:${s.id}`,
      kind: "mount-node",
      motion: `that the co-op mount a node on ${s.name}`,
      cost: COSTS.mount,
      siteId: s.id,
    };
    out.push(base, stakeholderVariant(state, base, s.owner));
  }

  for (const s of liveSites(state)) {
    if (s.hardened || COSTS.harden > state.budget || degree(state, s.id) === 0) continue;
    out.push({
      id: `harden:${s.id}`,
      kind: "harden",
      motion: `that the fund pay for a battery and a shroud at ${s.name}`,
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
 * When your motion dies, somebody in the room says "what about instead…".
 * These are the things they could plausibly mean.
 */
export function counterproposals(state: GameState, failed: Proposal): Proposal[] {
  const all = availableProposals(state);
  const sameKind = all.filter((p) => p.kind === failed.kind && p.id !== failed.id);
  const out: Proposal[] = [];

  if (failed.kind === "build-link" && failed.from && failed.to) {
    // Same destination, somebody else's roof. The classic amendment.
    const ends = [failed.from, failed.to];
    out.push(...sameKind.filter((p) => ends.includes(p.from ?? "") || ends.includes(p.to ?? "")));
    // Or: mount the gear that would open a different route entirely.
    out.push(...all.filter((p) => p.kind === "mount-node").slice(0, 2));
  } else if (failed.kind === "mount-node") {
    out.push(...sameKind.slice(0, 3));
    out.push(...all.filter((p) => p.kind === "build-link" && !p.namedStakeholder).slice(0, 2));
  } else if (failed.kind === "harden" || failed.kind === "raise-dues") {
    out.push(...sameKind.slice(0, 2));
    out.push(...all.filter((p) => p.kind === "harden").slice(0, 2));
  } else if (failed.kind === "bylaw") {
    out.push(...sameKind.slice(0, 3));
  }

  // The version of your own motion that asks first is always in the room.
  if (!failed.namedStakeholder && (failed.kind === "build-link" || failed.kind === "mount-node")) {
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
