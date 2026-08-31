// Trust is never shown as a number. Reading the room is the skill, and a
// number would do the reading for you.

import type { Bloc, NPC, WeatherKind } from "../game/types";

export function trustWord(t: number): string {
  if (t <= -2) return "hostile";
  if (t <= -1) return "cold";
  if (t < -0.3) return "wary";
  if (t <= 0.3) return "neutral";
  if (t < 1) return "civil";
  if (t < 2) return "warm";
  return "staunch";
}

export function weatherWord(w: WeatherKind): string {
  return { clear: "clear", fog: "fog", rain: "rain", storm: "STORM" }[w];
}

export function powerWord(p: string): string {
  return { grid: "grid", solar: "solar", none: "no power" }[p] ?? p;
}

export function kindWord(k: string): string {
  return { fso: "optical", lora: "LoRa", cable: "cable" }[k] ?? k;
}

export const BLOC_LABEL: Record<Bloc, string> = {
  essential: "the clinic and the annex",
  connected: "the connected",
  dark: "the dark",
  renters: "the renters",
};

/** What each bloc is currently after. Structural, and never a prediction. */
export const BLOC_WANT: Record<Bloc, string> = {
  essential: "wants the sites people depend on up, whatever it costs",
  connected: "wants what exists to work, and not to pay for anyone else's roof",
  dark: "wants building, any building, and resents money spent on upkeep",
  renters: "owns no roof, pays dues anyway, votes on precedent",
};

/** A fill fraction, which is the datum. No colour needed to read it. */
export function bar(part: number, whole: number, width = 12): string {
  if (whole <= 0) return "·".repeat(width);
  const n = Math.round((part / whole) * width);
  return "█".repeat(n) + "·".repeat(width - n);
}

export function initials(n: NPC): string {
  return n.name
    .split(" ")
    .map((w) => w[0])
    .join("");
}
