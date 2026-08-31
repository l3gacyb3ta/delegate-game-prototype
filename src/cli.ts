// A text front end onto the same pure reducer the browser uses. One process per
// move, state on disk in between, so anything that can run a shell command can
// play: no browser, no REPL, no terminal control codes.
//
//   node play.mjs new blocs
//   node play.mjs open
//   node play.mjs visit hollis
//   node play.mjs convene
//   node play.mjs move 3

import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { TURNS } from "./game/content";
import {
  assembly,
  bloc,
  coverage,
  households,
  liveSites,
  reachable,
} from "./game/graph";
import { endingTitle } from "./game/outcome";
import { availableProposals } from "./game/proposals";
import { initialState, reduce } from "./game/reducer";
import { seedFrom } from "./game/rng";
import type { Bloc, GameState, Proposal, VoteResult } from "./game/types";
import { BLOC_LABEL, BLOC_WANT, kindWord, powerWord, trustWord, weatherWord } from "./ui/words";

const SAVE = process.env.DELEGATE_SAVE ?? ".delegate-save.json";
const TRANSCRIPT = process.env.DELEGATE_TRANSCRIPT ?? ".delegate-transcript.md";

interface Save {
  v: 1;
  seedText: string;
  state: GameState;
  /** How many log entries the player has already been shown. */
  shown: number;
}

const out: string[] = [];
const say = (s = "") => out.push(s);
const rule = (label = "") =>
  say(label ? `── ${label} ${"─".repeat(Math.max(0, 66 - label.length))}` : "─".repeat(70));

// ---------------------------------------------------------------- save file

function load(): Save {
  try {
    return JSON.parse(readFileSync(SAVE, "utf8")) as Save;
  } catch {
    fail(`No run in progress. Start one with:  node play.mjs new`);
  }
}

function store(save: Save) {
  writeFileSync(SAVE, JSON.stringify(save));
}

function fail(message: string): never {
  process.stdout.write(`${message}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------- rendering

function header(s: GameState, seedText: string) {
  const up = reachable(s);
  say(
    `DELEGATE · seed "${seedText}" · day ${Math.max(s.turn, 1)} of ${TURNS} · ${weatherWord(s.weather)}`,
  );
  say(
    `coverage ${Math.round(coverage(s) * 100)}% (${up.size} of ${s.sites.length} sites) · ` +
      `fund ${s.budget} · actions ${s.actionsLeft} · monologue tokens ${s.tokens}`,
  );
  const warn: string[] = [];
  if (s.flags.stormEta !== null) warn.push(`storm expected day ${s.flags.stormEta}`);
  if (s.flags.landlord) warn.push(`the landlord takes the stub on day ${s.flags.landlord.deadline}`);
  if (s.flags.seizedUntil !== null) warn.push(`THE STUB IS SEIZED until day ${s.flags.seizedUntil}`);
  if (s.flags.hoarder) warn.push(`${site(s, s.flags.hoarder.siteId).name} is saturating the network`);
  if (s.flags.fork) warn.push(`${who(s, s.flags.fork.npcId)} is talking about leaving`);
  for (const w of warn) say(`  ! ${w}`);
}

const site = (s: GameState, id: string) => s.sites.find((x) => x.id === id)!;
const who = (s: GameState, id: string) => s.npcs.find((x) => x.id === id)?.name ?? id;

const ORDER: Bloc[] = ["connected", "dark", "essential", "renters"];

function assemblyPane(s: GameState, full: boolean) {
  const sizes = assembly(s);
  rule(`THE ASSEMBLY · ${households(s)} households`);
  for (const b of ORDER) {
    const rows = s.npcs
      .filter((n) => n.households > 0 && bloc(s, n) === b)
      .sort((x, y) => y.households - x.households);
    if (rows.length === 0) continue;
    say(`${BLOC_LABEL[b]} · ${sizes[b]} households`);
    say(`  ${BLOC_WANT[b]}`);
    if (!full) continue;
    for (const n of rows) {
      const read = s.revealed.includes(n.id) ? "  (motivation known)" : "";
      say(
        `    ${n.id.padEnd(9)} ${n.name.padEnd(18)} ${String(n.households).padStart(2)} households  ` +
          `${trustWord(n.trust).padEnd(8)}${read}`,
      );
    }
  }
}

/** A rough plot from the hand-placed coordinates. The listing below is authoritative. */
function asciiMap(s: GameState) {
  const W = 64;
  const H = 19;
  const grid: string[][] = Array.from({ length: H }, () => Array(W).fill(" "));
  const up = reachable(s);
  const put = (row: number, col: number, text: string) => {
    if (row < 0 || row >= H) return;
    for (let i = 0; i < text.length; i++) {
      const c = col + i;
      if (c < 0 || c >= W) continue;
      if (grid[row]![c] !== " ") continue;
      grid[row]![c] = text[i]!;
    }
  };
  for (const st of s.sites) {
    const col = Math.round(((st.x - 110) / 470) * (W - 16));
    const row = Math.round(((st.y - 110) / 380) * (H - 2));
    const mark = s.seceded.includes(st.id) ? "x" : st.uplink ? "#" : up.has(st.id) ? "O" : "o";
    put(row, col, `${mark} ${st.short}`);
  }
  rule("THE MAP");
  for (const line of grid) {
    const text = line.join("").replace(/\s+$/, "");
    if (text) say(`  ${text}`);
  }
  say("  # the uplink   O on the network   o dark   x gone");
}

function mapPane(s: GameState) {
  asciiMap(s);
  say("");
  for (const st of liveSites(s)) {
    const up = reachable(s).has(st.id);
    const bits = [
      powerWord(st.power),
      `elevation ${st.elevation}/3`,
      st.hasNode ? (st.hardened ? "node, hardened" : "node") : "no equipment",
      up ? "on the network" : "dark",
    ];
    say(`  ${st.id.padEnd(11)} ${st.name} — ${bits.join(", ")}`);
    say(`  ${" ".repeat(11)} owner: ${who(s, st.owner)}`);
    for (const l of s.links.filter((x) => x.from === st.id || x.to === st.id)) {
      const other = l.from === st.id ? l.to : l.from;
      say(
        `  ${" ".repeat(11)} link ${l.id.padEnd(22)} to ${site(s, other).short}, ` +
          `${kindWord(l.kind)}, ${l.status}, reliability ${l.reliability.toFixed(2)}` +
          (l.scar > 0 ? `, scarred ${l.scar.toFixed(2)}` : ""),
      );
    }
    if (s.scouted.includes(st.id)) {
      const terrain = s.feasible
        .filter((f) => f.from === st.id || f.to === st.id)
        .map((f) => `${site(s, f.from === st.id ? f.to : f.from).short} (${kindWord(f.kind)})`);
      if (terrain.length > 0) say(`  ${" ".repeat(11)} terrain allows: ${terrain.join(", ")}`);
    } else {
      say(`  ${" ".repeat(11)} nobody has walked this one`);
    }
  }
}

function minutes(save: Save, all = false, skipTallies = false) {
  const raw = all ? save.state.log : save.state.log.slice(save.shown);
  const entries = skipTallies ? raw.filter((e) => e.kind !== "vote") : raw;
  if (entries.length === 0) {
    save.shown = save.state.log.length;
    return;
  }
  rule("MINUTES");
  for (const e of entries) {
    const prefix = e.kind === "day" ? "" : "  ";
    say(`${prefix}${e.text}`);
    if (e.kind === "day") say("");
  }
  save.shown = save.state.log.length;
}

const GROUPS: { kind: Proposal["kind"]; heading: string }[] = [
  { kind: "build-link", heading: "extend the network" },
  { kind: "harden", heading: "make good what exists" },
  { kind: "raise-dues", heading: "the fund itself" },
  { kind: "bylaw", heading: "change a bylaw" },
];

/** An agenda line, not the full motion. The prose goes in the minutes if moved. */
function agenda(s: GameState, p: Proposal): string {
  const named = p.namedStakeholder ? `  · naming ${who(s, p.namedStakeholder)}` : "";
  if (p.kind === "build-link" && p.from && p.to) {
    const bare = [p.from, p.to].filter((id) => !site(s, id).hasNode).map((id) => site(s, id).short);
    const mounts = bare.length > 0 ? `  (mounts ${bare.join(" and ")})` : "";
    return `${kindWord(p.linkKind ?? "fso").padEnd(7)} ${site(s, p.from).short} \u2192 ${site(s, p.to).short}${mounts}${named}`;
  }
  if (p.kind === "harden" && p.siteId) return `harden  ${site(s, p.siteId).short}${named}`;
  if (p.kind === "raise-dues") return "dues up four dollars a household";
  return p.motion.replace(/^that /, "");
}

function motions(s: GameState): Proposal[] {
  const menu = availableProposals(s);
  rule("MOTIONS YOU COULD BRING");
  let i = 0;
  const ordered: Proposal[] = [];
  for (const g of GROUPS) {
    const items = menu.filter((p) => p.kind === g.kind);
    if (items.length === 0) continue;
    say(`  ${g.heading}`);
    for (const p of items) {
      ordered.push(p);
      i += 1;
      say(`    ${String(i).padStart(2)}  [${p.cost}]  ${agenda(s, p)}`);
    }
  }
  return ordered;
}

function tally(s: GameState, v: VoteResult, what: string) {
  rule(what);
  const verdict = v.passed
    ? "CARRIED"
    : v.yes === v.no
      ? "TIED, and the chair does not break ties — not carried"
      : "not carried";
  say(`  ${v.yes} for, ${v.no} against, of ${v.yes + v.no} households — ${verdict}`);
  for (const b of v.blocs) {
    const width = 16;
    const filled = Math.round((b.yes / Math.max(1, b.households)) * width);
    say(
      `    ${BLOC_LABEL[b.bloc].padEnd(26)} ${"#".repeat(filled)}${".".repeat(width - filled)} ` +
        `${b.yes}-${b.no}`,
    );
    for (const x of v.ballots.filter((y) => y.bloc === b.bloc)) {
      say(`      ${who(s, x.npcId).padEnd(24)} ${String(x.yes).padStart(2)}-${x.no}`);
    }
  }
}

function whatNow(s: GameState) {
  rule("WHAT NOW");
  if (s.phase === "over") {
    say("  The run is finished. Start another with:  node play.mjs new <seed>");
    return;
  }
  if (s.phase === "morning") {
    say(`  node play.mjs open            open day ${s.turn + 1}`);
    return;
  }
  if (s.phase === "day") {
    say(`  ${s.actionsLeft} action${s.actionsLeft === 1 ? "" : "s"} left today.`);
    say("  node play.mjs visit <id>     call on somebody (warms their whole constituency)");
    say("  node play.mjs read <id>      spend a monologue token to hear what they actually want");
    say("  node play.mjs walk <site>    learn what the terrain allows from a roof");
    const down = s.links.filter((l) => l.status === "down");
    if (down.length > 0) {
      say(`  node play.mjs fix <link>     re-aim a downed link (${down.map((l) => l.id).join(", ")})`);
    }
    say("  node play.mjs convene        end the day and go to the meeting");
    return;
  }
  if (s.phase === "council") {
    say("  node play.mjs move <n>       bring motion n to the floor");
    say("  node play.mjs abstain        bring nothing tonight");
    return;
  }
  say("  node play.mjs enter          enter the room's decision in the minutes");
}

// ---------------------------------------------------------------- commands

function newRun(seedText: string): Save {
  const save: Save = { v: 1, seedText, state: initialState(seedFrom(seedText)), shown: 0 };
  say(`A new run. Seed "${seedText}" — the same seed always plays the same way.`);
  say("");
  return save;
}

function act(save: Save, kind: "VISIT" | "MONOLOGUE" | "SCOUT" | "REPAIR", arg: string) {
  const s = save.state;
  if (s.phase !== "day") fail(`Not during the day. Try:  node play.mjs ${s.phase === "morning" ? "open" : "look"}`);
  if (s.actionsLeft <= 0) fail("The day is spent. Try:  node play.mjs convene");

  if (kind === "REPAIR") {
    if (!s.links.some((l) => l.id === arg && l.status === "down")) {
      fail(`No downed link called "${arg}". Downed: ${s.links.filter((l) => l.status === "down").map((l) => l.id).join(", ") || "none"}`);
    }
    save.state = reduce(s, { type: "ACT", action: { type: "REPAIR", linkId: arg } });
    return;
  }
  if (kind === "SCOUT") {
    if (!s.sites.some((x) => x.id === arg)) fail(`No site called "${arg}". Try:  node play.mjs map`);
    if (s.scouted.includes(arg)) fail(`${site(s, arg).name} has already been walked.`);
    save.state = reduce(s, { type: "ACT", action: { type: "SCOUT", siteId: arg } });
    return;
  }
  if (!s.npcs.some((n) => n.id === arg)) {
    fail(`No such person: "${arg}". Try one of: ${s.npcs.map((n) => n.id).join(", ")}`);
  }
  if (kind === "MONOLOGUE") {
    if (s.tokens <= 0) fail("You have no monologue tokens left.");
    if (s.revealed.includes(arg)) fail(`You already know what ${who(s, arg)} actually wants.`);
  }
  save.state = reduce(s, { type: "ACT", action: { type: kind, npcId: arg } });
}

function main() {
  const [cmd = "look", arg] = process.argv.slice(2);

  if (cmd === "help") {
    say("DELEGATE — you are the elected delegate of a neighbourhood mesh co-op.");
    say("You do not rule. You propose, the neighbourhood votes, and you carry out");
    say("whatever passes, including the things you argued against. Twenty days.");
    say("");
    say("  node play.mjs new [seed]     start a run");
    say("  node play.mjs look           reprint the whole board");
    say("  node play.mjs map            the map and every site in detail");
    say("  node play.mjs who            the assembly in detail");
    say("  node play.mjs open           open the day");
    say("  node play.mjs visit <id>     call on somebody");
    say("  node play.mjs read <id>      spend a monologue token");
    say("  node play.mjs walk <site>    scout a site");
    say("  node play.mjs fix <link>     re-aim a downed link");
    say("  node play.mjs convene        end the day, go to the meeting");
    say("  node play.mjs move <n>       bring motion n");
    say("  node play.mjs abstain        bring nothing");
    say("  node play.mjs enter          accept what the room decided");
    say("  node play.mjs minutes        re-read the whole log");
    flush(null);
    return;
  }

  let save: Save;
  if (cmd === "new") {
    save = newRun(arg ?? Math.random().toString(36).slice(2, 8));
  } else {
    save = load();
  }
  const before = save.state;

  switch (cmd) {
    case "new":
    case "look":
      break;
    case "map":
      header(save.state, save.seedText);
      mapPane(save.state);
      flush(save);
      return;
    case "who":
      header(save.state, save.seedText);
      assemblyPane(save.state, true);
      flush(save);
      return;
    case "minutes":
      minutes(save, true);
      flush(save);
      return;
    case "open":
      if (save.state.phase !== "morning") fail(`It is not morning. Try:  node play.mjs look`);
      save.state = reduce(save.state, { type: "OPEN_DAY" });
      break;
    case "visit":
      act(save, "VISIT", need(arg, "visit <id>"));
      break;
    case "read":
      act(save, "MONOLOGUE", need(arg, "read <id>"));
      break;
    case "walk":
      act(save, "SCOUT", need(arg, "walk <site>"));
      break;
    case "fix":
      act(save, "REPAIR", need(arg, "fix <link>"));
      break;
    case "convene":
      if (save.state.phase !== "day") fail("There is no day to end. Try:  node play.mjs look");
      save.state = reduce(save.state, { type: "CONVENE" });
      break;
    case "abstain":
      if (save.state.phase !== "council") fail("The meeting is not sitting. Try:  node play.mjs look");
      save.state = reduce(save.state, { type: "ABSTAIN" });
      break;
    case "enter":
      if (save.state.phase !== "counter") fail("Nothing is waiting to be entered. Try:  node play.mjs look");
      save.state = reduce(save.state, { type: "ACCEPT_COUNTER" });
      break;
    case "move": {
      if (save.state.phase !== "council") fail("The meeting is not sitting. Try:  node play.mjs convene");
      const menu = availableProposals(save.state);
      const ordered = GROUPS.flatMap((g) => menu.filter((p) => p.kind === g.kind));
      const n = Number.parseInt(need(arg, "move <n>"), 10);
      const chosen = ordered[n - 1];
      if (!chosen) fail(`There is no motion ${arg}. There are ${ordered.length}.`);
      save.state = reduce(save.state, { type: "PROPOSE", proposalId: chosen.id });
      break;
    }
    default:
      fail(`Unknown command "${cmd}". Try:  node play.mjs help`);
  }

  render(save, before, cmd);
  flush(save);
}

function need(arg: string | undefined, usage: string): string {
  if (!arg) fail(`Usage:  node play.mjs ${usage}`);
  return arg;
}

/** How much of the board to print depends on what the player just did. */
function render(save: Save, before: GameState, cmd: string) {
  const s = save.state;
  const isDecision = cmd === "convene" || cmd === "look" || cmd === "new";

  header(s, save.seedText);

  if (cmd === "move" || cmd === "abstain" || cmd === "enter") {
    minutes(save, false, true);
    if (s.lastVote) tally(s, s.lastVote, "THE VOTE");
    if (s.pendingCounter) {
      tally(s, s.pendingCounter, "THE AMENDMENT SOMEBODY PUT IN ITS PLACE");
      say("");
      say(
        s.pendingCounter.passed
          ? "  You argued against it or you did not; either way you are the one who builds it."
          : "  Nothing was decided tonight, which is itself a decision.",
      );
    }
  } else {
    minutes(save);
  }

  if (isDecision) assemblyPane(s, true);
  else if (cmd === "open") assemblyPane(s, false);

  if (cmd === "look" || cmd === "new") asciiMap(s);

  if (s.phase === "council") motions(s);

  if (s.phase === "over" && s.outcome) {
    rule("THE RUN ENDS");
    say(`  ${endingTitle(s.outcome.ending)}`);
    say(
      `  coverage ${Math.round(s.outcome.coverage * 100)}% · cohesion ${s.outcome.cohesion.toFixed(2)} · ${s.turn} days`,
    );
  }

  // Actions are cheap to report and expensive to re-derive from the whole board.
  if (["visit", "read", "walk", "fix"].includes(cmd) && s.actionsLeft !== before.actionsLeft) {
    // The action's own line is already in the minutes above.
  }

  whatNow(s);
}

function flush(save: Save | null) {
  const text = `${out.join("\n")}\n`;
  process.stdout.write(text);
  if (save) {
    store(save);
    try {
      appendFileSync(TRANSCRIPT, `\n\n$ node play.mjs ${process.argv.slice(2).join(" ")}\n\n${text}`);
    } catch {
      // A read-only directory is not a reason to stop playing.
    }
  }
}

main();
