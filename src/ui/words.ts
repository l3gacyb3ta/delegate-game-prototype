// Trust is never shown as a number. Reading the room is the skill, and a
// number would do the reading for you.

import type { NPC, WeatherKind } from "../game/types";

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

export function initials(n: NPC): string {
  return n.name
    .split(" ")
    .map((w) => w[0])
    .join("");
}
