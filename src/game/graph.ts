// Coverage is the whole network sim: the fraction of sites the uplink can
// reach through active links. Reliability decides what survives a storm.

import { BASE_RELIABILITY } from "./content";
import type { Bloc, GameState, Link, LinkKind, NPC, Site, WeatherKind } from "./types";

export function linkId(a: string, b: string): string {
  return [a, b].sort().join("~");
}

export function site(state: GameState, id: string): Site {
  const s = state.sites.find((x) => x.id === id);
  if (!s) throw new Error(`no site ${id}`);
  return s;
}

export function npc(state: GameState, id: string) {
  const n = state.npcs.find((x) => x.id === id);
  if (!n) throw new Error(`no npc ${id}`);
  return n;
}

export function owner(state: GameState, siteId: string): string {
  return site(state, siteId).owner;
}

/** Sites a fork took with it are off the board entirely. */
export function liveSites(state: GameState): Site[] {
  return state.sites.filter((s) => !state.seceded.includes(s.id));
}

export function activeLinks(state: GameState): Link[] {
  return state.links.filter(
    (l) =>
      l.status === "active" &&
      !state.seceded.includes(l.from) &&
      !state.seceded.includes(l.to),
  );
}

/** Every site the uplink can currently reach. */
export function reachable(state: GameState, links = activeLinks(state)): Set<string> {
  const start = liveSites(state).find((s) => s.uplink);
  const seen = new Set<string>();
  if (!start) return seen;
  // A padlock on the stub is worth more than any storm: everything hangs off
  // it, so while it is seized nothing on the map reaches anything.
  if (state.flags.seizedUntil !== null) return seen;
  const stack = [start.id];
  seen.add(start.id);
  while (stack.length > 0) {
    const here = stack.pop() as string;
    for (const l of links) {
      const other = l.from === here ? l.to : l.to === here ? l.from : null;
      if (other && !seen.has(other)) {
        seen.add(other);
        stack.push(other);
      }
    }
  }
  return seen;
}

export function coverage(state: GameState): number {
  const live = liveSites(state);
  if (live.length === 0) return 0;
  return reachable(state).size / state.sites.length;
}

/**
 * Which bloc a constituency sits in, computed from the map and not authored.
 * This is the load-bearing function of the whole design: connect somebody and
 * their households leave the bloc that wants building and join the bloc that
 * resents paying for it.
 */
export function bloc(state: GameState, n: NPC): Bloc {
  const theirs = state.sites.filter((s) => s.owner === n.id && !state.seceded.includes(s.id));
  if (theirs.length === 0) return "renters";
  if (theirs.some((s) => s.essential)) return "essential";
  const up = reachable(state);
  return theirs.some((s) => up.has(s.id)) ? "connected" : "dark";
}

/** The whole voting body, grouped the way the room actually divides. */
export function assembly(state: GameState): Record<Bloc, number> {
  const out: Record<Bloc, number> = { essential: 0, connected: 0, dark: 0, renters: 0 };
  for (const n of state.npcs) out[bloc(state, n)] += n.households;
  return out;
}

export function households(state: GameState): number {
  return state.npcs.reduce((sum, n) => sum + n.households, 0);
}

/** Are the sites that people actually need already up? */
export function essentialsUp(state: GameState): boolean {
  const up = reachable(state);
  return liveSites(state)
    .filter((s) => s.essential)
    .every((s) => up.has(s.id));
}

/** Mean trust across the neighbourhood, weighted by who speaks for how many. */
export function cohesion(state: GameState): number {
  const total = households(state);
  if (total === 0) return 0;
  return state.npcs.reduce((sum, n) => sum + n.trust * n.households, 0) / total;
}

export function weatherFactor(kind: LinkKind, weather: WeatherKind): number {
  if (kind !== "fso") return 1; // fog is the villain, and only for light
  if (weather === "fog") return 0.5;
  if (weather === "rain") return 0.78;
  // Tuned so an unhardened optical link fails a storm and a hardened one just
  // survives it. LoRa and cable ride every storm out, which is the whole
  // argument for the slow fallback.
  if (weather === "storm") return 0.55;
  return 1;
}

export function powerFactor(a: Site, b: Site, weather: WeatherKind): number {
  let f = 1;
  for (const s of [a, b]) {
    if (s.power === "none") f *= 0.85;
    else if (s.power === "solar" && (weather === "fog" || weather === "storm")) f *= 0.85;
  }
  return f;
}

export function reliabilityOf(state: GameState, link: Link, weather: WeatherKind): number {
  const a = site(state, link.from);
  const b = site(state, link.to);
  const hardening = a.hardened || b.hardened ? 1.3 : 1;
  // A link that has been through a storm never comes all the way back on an
  // afternoon's work. Only the fund does that.
  const scarred = 1 - Math.min(0.6, link.scar);
  // Saturation is a drag on the whole neighbourhood, proportional rather than
  // flat, so a bad week does not drive every link to zero.
  const raw =
    BASE_RELIABILITY[link.kind] *
    weatherFactor(link.kind, weather) *
    powerFactor(a, b, weather) *
    hardening *
    scarred *
    (1 - state.flags.drag);
  return Math.max(0, Math.min(1, Number(raw.toFixed(3))));
}

/**
 * The frontier: links the terrain allows, not yet built, with at least one end
 * already on the network. A link motion mounts whatever bare roofs it needs, so
 * there is no way to end up holding a node nobody will connect — and every
 * build that carries visibly moves the coverage number.
 */
export function buildableLinks(state: GameState) {
  const up = reachable(state);
  return state.feasible.filter((f) => {
    if (state.seceded.includes(f.from) || state.seceded.includes(f.to)) return false;
    if (!up.has(f.from) && !up.has(f.to)) return false;
    return !state.links.some((l) => l.id === linkId(f.from, f.to));
  });
}

/** Roofs a link motion would have to put equipment on, and therefore bill. */
export function bareEnds(state: GameState, from: string, to: string): string[] {
  return [from, to].filter((id) => !site(state, id).hasNode);
}

/** What the terrain would allow here if the co-op ever mounted the gear. */
export function feasibleAt(state: GameState, siteId: string) {
  return state.feasible.filter((f) => f.from === siteId || f.to === siteId);
}

export function degree(state: GameState, siteId: string): number {
  return activeLinks(state).filter((l) => l.from === siteId || l.to === siteId).length;
}

/**
 * Would building this link put the given site on the network for the first
 * time? This is what "benefits me" means, derived rather than authored.
 */
export function reachableWith(state: GameState, extra: Link): Set<string> {
  return reachable(state, [...activeLinks(state), extra]);
}
