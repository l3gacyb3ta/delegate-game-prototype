// Coverage is the whole network sim: the fraction of sites the uplink can
// reach through active links. Reliability decides what survives a storm.

import { BASE_RELIABILITY } from "./content";
import type { GameState, Link, LinkKind, Site, WeatherKind } from "./types";

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

/** Mean trust across the council. The other half of the win condition. */
export function cohesion(state: GameState): number {
  const council = state.npcs.filter((n) => n.councilMember);
  if (council.length === 0) return 0;
  return council.reduce((sum, n) => sum + n.trust, 0) / council.length;
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
  // Saturation is a drag on the whole neighbourhood, proportional rather than
  // flat, so a bad week does not drive every link to zero.
  const raw =
    BASE_RELIABILITY[link.kind] *
    weatherFactor(link.kind, weather) *
    powerFactor(a, b, weather) *
    hardening *
    (1 - state.flags.drag);
  return Math.max(0, Math.min(1, Number(raw.toFixed(3))));
}

/** Links the terrain allows, both ends carry a node, and nobody has built yet. */
export function buildableLinks(state: GameState) {
  return state.feasible.filter((f) => {
    if (state.seceded.includes(f.from) || state.seceded.includes(f.to)) return false;
    const a = site(state, f.from);
    const b = site(state, f.to);
    if (!a.hasNode || !b.hasNode) return false;
    return !state.links.some((l) => l.id === linkId(f.from, f.to));
  });
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
