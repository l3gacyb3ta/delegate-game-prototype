#!/usr/bin/env node

// src/cli.ts
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

// src/game/content.ts
var TURNS = 20;
var ACTIONS_PER_DAY = 2;
var MONOLOGUE_TOKENS = 3;
var STARTING_BUDGET = 6;
var COVERAGE_WIN = 0.8;
var COVERAGE_LOSS = 0.5;
var COHESION_WIN = 0.6;
var COHESION_FORK = -0.45;
var VOTE_SHARPNESS = 0.07;
var VOTE_NOISE = 0.06;
var SCAR_PER_STORM = 0.1;
var LANDLORD_FUSE = 5;
var SEIZURE_DAYS = 4;
var FORK_LOSS_SHARE = 0.4;
var COSTS = {
  /** Folded into a link motion now: a link pays to mount whatever bare roofs
   *  it needs, so nobody is ever left with a node and no link. */
  mount: 1,
  fso: 2,
  lora: 1,
  cable: 3,
  harden: 2,
  duesGain: 4
};
var TRUST_DECAY = 0.07;
var DIMINISHING_VISITS = true;
var TRUST_ON_BENEFIT = 0.25;
var TRUST_ON_COST = -0.75;
var TRUST_ON_BEING_NAMED = 1.5;
var TRUST_ON_LOST_MOTION = -0.07;
var BASE_RELIABILITY = {
  cable: 0.95,
  fso: 0.9,
  lora: 0.7
};
var SITES = [
  {
    id: "rialto",
    name: "the Rialto marquee",
    short: "Rialto",
    owner: "dez",
    hasNode: true,
    power: "grid",
    elevation: 2,
    x: 150,
    y: 300,
    uplink: true,
    hardened: false,
    essential: false,
    note: "The fiber stub terminates in a popcorn machine's junction box. Everything the co-op has comes through here."
  },
  {
    id: "garage",
    name: "Marcus's garage",
    short: "garage",
    owner: "marcus",
    hasNode: true,
    power: "grid",
    elevation: 1,
    x: 300,
    y: 400,
    uplink: false,
    hardened: false,
    essential: false,
    note: "Two bays, one lift, and a rack of secondhand radios bolted where the compressor used to sit."
  },
  {
    id: "laundromat",
    name: "the Superior Wash",
    short: "Superior Wash",
    owner: "bea",
    hasNode: true,
    power: "grid",
    elevation: 1,
    x: 145,
    y: 160,
    uplink: false,
    hardened: false,
    essential: false,
    note: "Open until eleven. The node hums under the change machine and shares a meter with the dryers."
  },
  {
    id: "school",
    name: "the Ward 12 annex",
    short: "annex",
    owner: "sylvie",
    hasNode: true,
    power: "solar",
    elevation: 2,
    x: 440,
    y: 130,
    uplink: false,
    hardened: false,
    essential: true,
    note: "A node was mounted here in the spring and has never been connected to anything. It blinks patiently."
  },
  {
    id: "watertower",
    name: "the water tower",
    short: "water tower",
    owner: "yolanda",
    hasNode: false,
    power: "none",
    elevation: 3,
    x: 300,
    y: 220,
    uplink: false,
    hardened: false,
    essential: false,
    note: "Sightlines to almost everything. No power, no ladder that anyone will admit to owning."
  },
  {
    id: "threeflat",
    name: "Yolanda's three-flat",
    short: "three-flat",
    owner: "yolanda",
    hasNode: false,
    power: "grid",
    elevation: 2,
    x: 230,
    y: 470,
    uplink: false,
    hardened: false,
    essential: false,
    note: "Rear porch, third floor. There are still four anchor bolts up there from the '31 buildout."
  },
  {
    id: "church",
    name: "Iglesia de la Resurreccion",
    short: "church",
    owner: "pastor",
    hasNode: false,
    power: "grid",
    elevation: 2,
    x: 530,
    y: 340,
    uplink: false,
    hardened: false,
    essential: false,
    note: "The bell tower is the second-highest thing on the block and the only one with a generator."
  },
  {
    id: "lakeview",
    name: "Lakeview 400",
    short: "Lakeview 400",
    owner: "hollis",
    hasNode: false,
    power: "grid",
    elevation: 3,
    x: 470,
    y: 220,
    uplink: false,
    hardened: false,
    essential: false,
    note: "Fourteen storeys, a parapet you could land a plane on, and a board that meets on Tuesdays."
  },
  {
    id: "clinic",
    name: "the storefront clinic",
    short: "clinic",
    owner: "ada",
    hasNode: false,
    power: "solar",
    elevation: 1,
    x: 400,
    y: 480,
    uplink: false,
    hardened: false,
    essential: true,
    note: "Six chairs, one autoclave, and a phone line that has been dead since the second flood."
  },
  {
    id: "pumphouse",
    name: "the Ashland pump house",
    short: "pump house",
    owner: "terrence",
    hasNode: false,
    power: "none",
    elevation: 1,
    x: 560,
    y: 120,
    uplink: false,
    hardened: false,
    essential: true,
    note: "Below grade, half-flooded, and the reason this side of the block is dry. City property in the way a stray cat is city property."
  }
];
var NPCS = [
  {
    id: "yolanda",
    name: "Yolanda Reyes",
    publicPosition: "Co-op hardware is an eyesore. The tower is a landmark, not a mast.",
    trueMotivation: "In '31 the co-op bolted a repeater to her roof while she was at her sister's funeral. She does not care about the hardware. She cares that nobody asked. Name her a stakeholder in a motion and she will hand you the tower.",
    trust: -2,
    grudges: [],
    households: 5,
    quirk: "consultation",
    visits: 0
  },
  {
    id: "marcus",
    name: "Marcus Ollivant",
    publicPosition: "Build outward from what already works. The garage is what already works.",
    trueMotivation: "He resells backhaul to two blocks south for cash and does not want the council auditing his throughput. Anything that routes around the garage is a threat to a business nobody has voted on.",
    trust: 1,
    grudges: ["dez"],
    households: 2,
    quirk: "none",
    visits: 0
  },
  {
    id: "pastor",
    name: "Pastor Efrain Ruiz",
    publicPosition: "The church roof is neutral ground. No equipment, no antennas, no politics on it.",
    trueMotivation: "He buried a man last winter who could not get a call out. He will trade the roof, the tower, and his own vote for anything that puts the clinic on the network.",
    trust: 0,
    grudges: [],
    households: 6,
    quirk: "clinic-first",
    visits: 0
  },
  {
    id: "dez",
    name: "Dez Okonkwo",
    publicPosition: "The fiber stub is co-op property. I am its caretaker, not its owner.",
    trueMotivation: "She is trying to get the co-op incorporated before the building's landlord notices what the stub is worth. Every vote is a precedent she is quietly filing away.",
    trust: 1,
    grudges: ["marcus"],
    households: 3,
    quirk: "none",
    visits: 0
  },
  {
    id: "bea",
    name: "Bea Kowalczyk",
    publicPosition: "Fix what is broken before you build what is new.",
    trueMotivation: "The node and the dryers share a meter. Every watt the mesh draws is a wash she does not run, and she has never once said this out loud in a meeting.",
    trust: -1,
    grudges: ["marcus"],
    households: 4,
    quirk: "none",
    visits: 0
  },
  {
    id: "june",
    name: "June Adeyemi",
    publicPosition: "We rent. We have no roof to give and no roof to protect, and we still pay dues.",
    trueMotivation: "She is the only person who has read the bylaws end to end, and she votes on precedent rather than on outcomes. She is also three months from moving to her mother's in Gary, and has told no one.",
    trust: 0,
    grudges: [],
    households: 8,
    quirk: "none",
    visits: 0
  },
  {
    id: "hollis",
    name: "Hollis Trent",
    publicPosition: "Height is an asset. Fourteen storeys of us, and the building will host, at a price.",
    trueMotivation: "The 400's board is two votes from selling to a developer. He needs the building to become infrastructure the neighborhood would fight to keep.",
    trust: -1,
    grudges: [],
    households: 12,
    quirk: "none",
    visits: 0
  },
  {
    id: "ada",
    name: "Ada Fenwick",
    publicPosition: "The clinic needs a line that works more than it needs a line that is fast.",
    trueMotivation: "She has been running triage over a neighbor's handheld LoRa set for five months and has not told the council, because she is certain they would take it away to be fair about it.",
    trust: 2,
    grudges: [],
    households: 2,
    quirk: "none",
    visits: 0
  },
  {
    id: "sylvie",
    name: "Sylvie Boateng",
    publicPosition: "Kids first. Homework does not happen over fog.",
    trueMotivation: "She is documenting every council vote for a grant application. A co-op that looks well run is worth forty thousand dollars to the annex, and a co-op that looks chaotic is worth nothing.",
    trust: 1,
    grudges: [],
    households: 4,
    quirk: "none",
    visits: 0
  },
  {
    id: "terrence",
    name: "Terrence Vogel",
    publicPosition: "The pump house is city property. I just have the keys.",
    trueMotivation: "He has kept the pumps running unpaid for three years and wants it written down somewhere official before he dies. A line to the pump house would mean the pumps are on a map.",
    trust: 0,
    grudges: ["hollis"],
    households: 2,
    quirk: "none",
    visits: 0
  }
];
var FEASIBLE = [
  { from: "rialto", to: "watertower", kind: "fso", note: "Clean shot up the alley once the tower's shroud comes off." },
  { from: "watertower", to: "lakeview", kind: "fso", note: "Tower to the 400's parapet. Four blocks, nothing in between but gulls." },
  { from: "watertower", to: "school", kind: "fso", note: "Downhill and short. Fog sits in this gap most mornings." },
  { from: "garage", to: "threeflat", kind: "fso", note: "Over the vacant lot. Line of sight depends on nobody rebuilding it." },
  { from: "lakeview", to: "church", kind: "fso", note: "Parapet to bell tower. The gulls are a real problem here." },
  { from: "laundromat", to: "clinic", kind: "fso", note: "Across Ashland. The clinic's awning clips the beam in a crosswind." },
  { from: "church", to: "clinic", kind: "lora", note: "Slow, but it does not care about weather and never has." },
  { from: "school", to: "pumphouse", kind: "lora", note: "Through two brick walls and a berm. LoRa or nothing." },
  { from: "threeflat", to: "laundromat", kind: "lora", note: "Rear porch to the roof vent. Sixty metres of nothing much." },
  { from: "garage", to: "pumphouse", kind: "lora", note: "The long way around the berm. Marginal, but it holds in weather." }
];
var STARTING_LINKS = [
  { id: "rialto~laundromat", from: "rialto", to: "laundromat", kind: "cable", status: "active", reliability: 0.95, scar: 0 },
  { id: "rialto~garage", from: "rialto", to: "garage", kind: "fso", status: "active", reliability: 0.9, scar: 0 }
];
var BYLAWS = [
  {
    id: "incorporate",
    motion: "that the co-op incorporate, and that the fiber stub be held as the corporation's property rather than as a favour",
    minute: "The co-op is a legal person as of tonight. Whatever the landlord thought he was going to repossess, he is going to have to sue somebody for it, and Dez has been waiting three years to be sued."
  },
  {
    id: "consent",
    motion: "that no equipment be mounted on any roof without the owner's consent, recorded by name in the minutes",
    minute: "Consent is now on the record. Owners are named in every mounting motion from here."
  },
  {
    id: "clinic-priority",
    motion: "that clinic and school traffic take priority on any saturated link",
    minute: "Priority traffic is now a rule rather than a favour. The hoarding argument has less air in it."
  },
  {
    id: "mutual-aid",
    motion: "that down links be repaired before any new work is authorised",
    minute: "Repair comes first now. A crew goes out each morning without waiting to be asked."
  },
  {
    id: "open-books",
    motion: "that every vote be recorded by name in the minutes",
    minute: "Votes are on the record. People argue their interests out loud now instead of guessing at each other."
  }
];
var EVENT_CARDS = {
  hoarder: {
    id: "hoarder",
    title: "Saturation",
    text: "is pulling everything the link will carry, at all hours. Three people mentioned it before the meeting started. Reliability is dropping across the neighbourhood until the council addresses it."
  },
  flare: {
    id: "flare",
    title: "Old business",
    text: "will not be in the same room civilly this week. Any motion touching either of their sites is going to take fire from everyone who is tired of it."
  },
  fork: {
    id: "fork",
    title: "A quiet conversation on the steps",
    text: "has been asked whether their end of the network might do better on its own, and has not said no. You have until the end of the week."
  },
  storm: {
    id: "storm",
    title: "Weather advisory",
    text: "Lake-effect system, two days out, and the forecast has not moved all morning. Anything holding below half reliability will not be holding after."
  },
  landlord: {
    id: "landlord",
    title: "A letter with a return address downtown",
    text: "The Rialto's landlord has had somebody out to look at the fiber stub, and has worked out what a terminated strand is worth to a company that wants one. Nothing you do on a roof touches this. The co-op has no legal existence and therefore owns nothing."
  },
  seizure: {
    id: "seizure",
    title: "They came for the stub",
    text: "Two men, a work order and a padlock. The Rialto is off the network and everything hanging off it went with it. Dez has gone downtown with a folder. She says it will take days."
  },
  quiet: {
    id: "quiet",
    title: "No new business",
    text: ""
  }
};
var QUIET_NIGHTS = [
  "Somebody brought tamales. The meeting ran short and nobody said anything they had to walk back.",
  "Two people came to complain about a thing the co-op does not do and left satisfied anyway.",
  "The minutes of the previous evening were read, corrected twice, and approved.",
  "A kid from the annex sat in the back for the whole meeting doing homework off the school node.",
  "The generator at the church was tested. It ran for eleven minutes and then it did not."
];
var EPILOGUES = {
  win: "Eight roofs, one stub, and a council that still returns your calls. The minutes for the year run to forty pages and nobody has asked for a recount. When the next delegate is elected in the spring, they will inherit a network and the habit of asking first. Both of those took twenty days and neither of them was yours alone.",
  "partial-network": "The network is up. Coverage holds through fog and most of a storm, and the clinic has a line that works. You also passed eleven motions over the objections of people who have to live with them, and the meeting hall is quieter than it used to be, in the bad way. Yolanda has stopped coming. The mesh does not notice.",
  "partial-community": "The co-op is intact, warm, and half-connected. Nobody left. Nobody stopped speaking to anyone. And when the pump house floods again, half the block will find out the way they always have, which is by seeing the water. You spent twenty days learning how to be trusted and did not spend enough of it building.",
  "lose-fork": "They took their roofs with them, which was always the risk and always their right. The two networks will interfere with each other on the same unlicensed band within a month, and both councils will spend the spring writing letters about it. You were not wrong about the engineering.",
  "lose-coverage": "Twenty days, six motions carried, and a map that still has more dark sites than lit ones. The fiber stub works. Almost nothing else reaches it. The co-op will elect somebody else in the spring and they will start where you started, which is the part that stings."
};

// src/game/graph.ts
function linkId(a, b) {
  return [a, b].sort().join("~");
}
function site(state, id) {
  const s = state.sites.find((x) => x.id === id);
  if (!s) throw new Error(`no site ${id}`);
  return s;
}
function owner(state, siteId) {
  return site(state, siteId).owner;
}
function liveSites(state) {
  return state.sites.filter((s) => !state.seceded.includes(s.id));
}
function activeLinks(state) {
  return state.links.filter(
    (l) => l.status === "active" && !state.seceded.includes(l.from) && !state.seceded.includes(l.to)
  );
}
function reachable(state, links = activeLinks(state)) {
  const start = liveSites(state).find((s) => s.uplink);
  const seen = /* @__PURE__ */ new Set();
  if (!start) return seen;
  if (state.flags.seizedUntil !== null) return seen;
  const stack = [start.id];
  seen.add(start.id);
  while (stack.length > 0) {
    const here = stack.pop();
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
function coverage(state) {
  const live = liveSites(state);
  if (live.length === 0) return 0;
  return reachable(state).size / state.sites.length;
}
function bloc(state, n) {
  const theirs = state.sites.filter((s) => s.owner === n.id && !state.seceded.includes(s.id));
  if (theirs.length === 0) return "renters";
  if (theirs.some((s) => s.essential)) return "essential";
  const up = reachable(state);
  return theirs.some((s) => up.has(s.id)) ? "connected" : "dark";
}
function assembly(state) {
  const out2 = { essential: 0, connected: 0, dark: 0, renters: 0 };
  for (const n of state.npcs) out2[bloc(state, n)] += n.households;
  return out2;
}
function households(state) {
  return state.npcs.reduce((sum, n) => sum + n.households, 0);
}
function essentialsUp(state) {
  const up = reachable(state);
  return liveSites(state).filter((s) => s.essential).every((s) => up.has(s.id));
}
function cohesion(state) {
  const total = households(state);
  if (total === 0) return 0;
  return state.npcs.reduce((sum, n) => sum + n.trust * n.households, 0) / total;
}
function weatherFactor(kind, weather) {
  if (kind !== "fso") return 1;
  if (weather === "fog") return 0.5;
  if (weather === "rain") return 0.78;
  if (weather === "storm") return 0.55;
  return 1;
}
function powerFactor(a, b, weather) {
  let f = 1;
  for (const s of [a, b]) {
    if (s.power === "none") f *= 0.85;
    else if (s.power === "solar" && (weather === "fog" || weather === "storm")) f *= 0.85;
  }
  return f;
}
function reliabilityOf(state, link, weather) {
  const a = site(state, link.from);
  const b = site(state, link.to);
  const hardening = a.hardened || b.hardened ? 1.3 : 1;
  const scarred = 1 - Math.min(0.6, link.scar);
  const raw = BASE_RELIABILITY[link.kind] * weatherFactor(link.kind, weather) * powerFactor(a, b, weather) * hardening * scarred * (1 - state.flags.drag);
  return Math.max(0, Math.min(1, Number(raw.toFixed(3))));
}
function buildableLinks(state) {
  const up = reachable(state);
  return state.feasible.filter((f) => {
    if (state.seceded.includes(f.from) || state.seceded.includes(f.to)) return false;
    if (!up.has(f.from) && !up.has(f.to)) return false;
    return !state.links.some((l) => l.id === linkId(f.from, f.to));
  });
}
function bareEnds(state, from, to) {
  return [from, to].filter((id) => !site(state, id).hasNode);
}
function degree(state, siteId) {
  return activeLinks(state).filter((l) => l.from === siteId || l.to === siteId).length;
}
function reachableWith(state, extra) {
  return reachable(state, [...activeLinks(state), extra]);
}

// src/game/outcome.ts
function evaluate(state) {
  const cov = coverage(state);
  const coh = cohesion(state);
  const forkShare = state.seceded.length / state.sites.length;
  let ending;
  if (forkShare > FORK_LOSS_SHARE) ending = "lose-fork";
  else if (cov < COVERAGE_LOSS) ending = "lose-coverage";
  else if (cov >= COVERAGE_WIN && coh >= COHESION_WIN) ending = "win";
  else if (cov >= COVERAGE_WIN) ending = "partial-network";
  else ending = "partial-community";
  return {
    ending,
    coverage: cov,
    cohesion: coh,
    epilogue: EPILOGUES[ending] ?? ""
  };
}
function endingTitle(ending) {
  switch (ending) {
    case "win":
      return "The co-op holds, and so does the network";
    case "partial-network":
      return "You built a network";
    case "partial-community":
      return "You kept the room";
    case "lose-fork":
      return "The co-op forks";
    case "lose-coverage":
      return "The map stays dark";
  }
}

// src/game/proposals.ts
function uniq(xs) {
  return [...new Set(xs)];
}
function interests(state, p) {
  const now = reachable(state);
  const benefits = [];
  const costs = [];
  let sites = [];
  let connectsClinic = false;
  let connectsEssential = false;
  let extended = false;
  if (p.kind === "build-link" && p.from && p.to && p.linkKind) {
    sites = [p.from, p.to];
    const probe = {
      id: linkId(p.from, p.to),
      from: p.from,
      to: p.to,
      kind: p.linkKind,
      status: "active",
      reliability: 1,
      scar: 0
    };
    const gained = [...reachableWith(state, probe)].filter((id) => !now.has(id));
    extended = gained.length > 0;
    connectsClinic = gained.includes("clinic");
    connectsEssential = gained.some((id) => site(state, id).essential);
    for (const id of gained) benefits.push(owner(state, id));
    for (const end of [p.from, p.to]) {
      const s = site(state, end);
      const gains = gained.includes(end);
      if (!gains) costs.push(s.owner);
      if (!s.hasNode) costs.push(s.owner);
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
    for (const n of state.npcs) costs.push(n.id);
  }
  if (p.kind === "bylaw") {
    const busiest = [...liveSites(state)].sort((a, b) => degree(state, b.id) - degree(state, a.id))[0];
    if (p.bylawId === "consent") {
      for (const s of liveSites(state)) if (!s.hasNode) benefits.push(s.owner);
    } else if (p.bylawId === "clinic-priority") {
      for (const s of liveSites(state)) if (s.essential || s.power !== "grid") benefits.push(s.owner);
      if (busiest) costs.push(busiest.owner);
      connectsClinic = true;
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
    extends: extended
  };
}
function blocInterest(state, p, b, info) {
  const satisfied = essentialsUp(state);
  if (b === "dark") {
    if (p.kind === "build-link") return info.extends ? 2 : 0.5;
    if (p.kind === "harden") return -1;
    if (p.kind === "raise-dues") return 0.5;
    if (p.bylawId === "mutual-aid") return -0.5;
    return 0;
  }
  if (b === "connected") {
    if (p.kind === "build-link") return -2.5;
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
  if (p.kind === "bylaw") return p.bylawId === "incorporate" ? 2 : 1.5;
  if (p.kind === "raise-dues") return -2;
  return 0;
}
function linkMotion(state, from, to, kind) {
  const gear = kind === "fso" ? "an optical link" : kind === "lora" ? "a LoRa fallback" : "a cable run";
  const bare = bareEnds(state, from, to);
  const mounting = bare.length === 0 ? "" : `, mounting on ${bare.map((id) => site(state, id).name).join(" and ")}`;
  return `that the co-op string ${gear} from ${site(state, from).name} to ${site(state, to).name}${mounting}`;
}
function stakeholderVariant(state, p, npcId) {
  const n = state.npcs.find((x) => x.id === npcId);
  return {
    ...p,
    id: `${p.id}+named:${npcId}`,
    motion: `${p.motion}, naming ${n ? n.name : npcId} as a stakeholder of record`,
    namedStakeholder: npcId
  };
}
function linkCost(state, from, to, kind) {
  return COSTS[kind] + bareEnds(state, from, to).length * COSTS.mount;
}
function availableProposals(state) {
  const out2 = [];
  for (const f of buildableLinks(state)) {
    const cost = linkCost(state, f.from, f.to, f.kind);
    if (cost > state.budget) continue;
    const base = {
      id: `link:${linkId(f.from, f.to)}`,
      kind: "build-link",
      motion: linkMotion(state, f.from, f.to, f.kind),
      cost,
      from: f.from,
      to: f.to,
      linkKind: f.kind
    };
    out2.push(base);
    for (const bearing of interests(state, base).costs) {
      out2.push(stakeholderVariant(state, base, bearing));
    }
  }
  for (const s of liveSites(state)) {
    if (s.hardened || COSTS.harden > state.budget) continue;
    if (degree(state, s.id) === 0) continue;
    const scarred = state.links.some(
      (l) => (l.from === s.id || l.to === s.id) && l.scar > 0
    );
    out2.push({
      id: `harden:${s.id}`,
      kind: "harden",
      motion: `that the fund pay for a battery and a shroud at ${s.name}${scarred ? ", and make good what the weather has already taken out of it" : ""}`,
      cost: COSTS.harden,
      siteId: s.id
    });
  }
  out2.push({
    id: "dues",
    kind: "raise-dues",
    motion: "that monthly dues go up by four dollars a household",
    cost: 0
  });
  for (const b of BYLAWS) {
    if (state.flags.bylaws.includes(b.id)) continue;
    out2.push({ id: `bylaw:${b.id}`, kind: "bylaw", motion: b.motion, cost: 0, bylawId: b.id });
  }
  return out2;
}
function counterproposals(state, failed) {
  const all = availableProposals(state);
  const sameKind = all.filter((p) => p.kind === failed.kind && p.id !== failed.id);
  const out2 = [];
  if (failed.kind === "build-link" && failed.from && failed.to) {
    const ends = [failed.from, failed.to];
    out2.push(...sameKind.filter((p) => ends.includes(p.from ?? "") || ends.includes(p.to ?? "")));
    out2.push(...sameKind.slice(0, 2));
    out2.push(...all.filter((p) => p.kind === "harden").slice(0, 2));
  } else if (failed.kind === "harden" || failed.kind === "raise-dues") {
    out2.push(...sameKind.slice(0, 2));
    out2.push(...all.filter((p) => p.kind === "build-link" && !p.namedStakeholder).slice(0, 2));
  } else if (failed.kind === "bylaw") {
    out2.push(...sameKind.slice(0, 3));
    out2.push(...all.filter((p) => p.kind === "harden").slice(0, 1));
  }
  if (!failed.namedStakeholder && failed.kind === "build-link") {
    for (const bearing of interests(state, failed).costs) {
      out2.push(stakeholderVariant(state, failed, bearing));
    }
  }
  const seen = /* @__PURE__ */ new Set([failed.id]);
  return out2.filter((p) => {
    if (seen.has(p.id) || p.cost > state.budget) return false;
    seen.add(p.id);
    return true;
  });
}

// src/game/rng.ts
function draw(cursor) {
  const a = cursor + 1831565813 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return { value: ((t ^ t >>> 14) >>> 0) / 4294967296, next: a };
}
function drawRange(cursor, lo, hi) {
  const d = draw(cursor);
  return { value: lo + d.value * (hi - lo), next: d.next };
}
function seedFrom(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// src/game/events.ts
function candidates(state) {
  const out2 = [{ id: "quiet", weight: 2 }];
  const sinceStorm = state.turn - state.flags.lastStorm;
  if (state.flags.stormEta === null && state.turn >= 3 && state.turn <= TURNS - 3 && sinceStorm >= 5) {
    out2.push({ id: "storm", weight: 3 });
  }
  if (state.flags.fork === null && state.turn >= 7 && cohesion(state) < COHESION_FORK) {
    out2.push({ id: "fork", weight: 5 });
  }
  if (state.flags.hoarder === null && !state.flags.bylaws.includes("clinic-priority")) {
    if (liveSites(state).some((s) => degree(state, s.id) >= 2)) out2.push({ id: "hoarder", weight: 3 });
  }
  if (state.flags.flare === null && state.npcs.some((n) => n.grudges.length > 0)) {
    out2.push({ id: "flare", weight: 3 });
  }
  if (state.flags.landlord === null && state.flags.seizedUntil === null && !state.flags.bylaws.includes("incorporate") && state.turn >= 4 && state.turn <= 9) {
    out2.push({ id: "landlord", weight: 6 });
  }
  return out2;
}
function forkLeader(state) {
  const uplinkOwner = state.sites.find((s) => s.uplink)?.owner;
  const ranked = state.npcs.filter((n) => n.id !== uplinkOwner && n.households > 0).map((n) => ({
    id: n.id,
    pull: n.households + state.sites.filter((s) => s.owner === n.id && !state.seceded.includes(s.id)).reduce((sum, s) => sum + 1 + degree(state, s.id), 0),
    trust: n.trust
  })).sort((a, b) => b.pull - a.pull || a.trust - b.trust || a.id.localeCompare(b.id));
  const top = ranked[0];
  return top && top.pull > 0 ? top.id : null;
}
function drawEvent(state, cursor) {
  const pool = candidates(state);
  const total = pool.reduce((s, c) => s + c.weight, 0);
  const d = drawRange(cursor, 0, total);
  let rng = d.next;
  let roll = d.value;
  let chosen = pool[pool.length - 1];
  for (const c of pool) {
    if (roll < c.weight) {
      chosen = c;
      break;
    }
    roll -= c.weight;
  }
  if (!chosen) return { state, next: rng, entry: null };
  const flags = { ...state.flags, bylaws: [...state.flags.bylaws] };
  let text = "";
  if (chosen.id === "storm") {
    flags.stormEta = state.turn + 2;
    flags.lastStorm = state.turn + 2;
    text = `${EVENT_CARDS.storm?.text ?? ""} It makes landfall on day ${flags.stormEta}.`;
  } else if (chosen.id === "fork") {
    const leader = forkLeader(state);
    if (leader) {
      flags.fork = { npcId: leader, deadline: state.turn + 2 };
      const n = state.npcs.find((x) => x.id === leader);
      text = `${n?.name ?? leader} ${EVENT_CARDS.fork?.text ?? ""}`;
    } else {
      text = EVENT_CARDS.quiet?.text ?? "";
    }
  } else if (chosen.id === "hoarder") {
    const busiest = [...liveSites(state)].sort((a, b) => degree(state, b.id) - degree(state, a.id))[0];
    if (busiest) {
      flags.hoarder = { siteId: busiest.id, since: state.turn };
      flags.drag = 0.1;
      text = `${busiest.name} ${EVENT_CARDS.hoarder?.text ?? ""}`;
    }
  } else if (chosen.id === "landlord") {
    flags.landlord = { deadline: state.turn + LANDLORD_FUSE };
    text = `${EVENT_CARDS.landlord?.text ?? ""} They have given the co-op until day ${flags.landlord.deadline}.`;
  } else if (chosen.id === "flare") {
    const sore = state.npcs.filter((n) => n.grudges.length > 0);
    const pickIdx = drawRange(rng, 0, sore.length);
    rng = pickIdx.next;
    const a = sore[Math.floor(pickIdx.value)] ?? sore[0];
    const bId = a?.grudges[0];
    const b = state.npcs.find((x) => x.id === bId);
    if (a && b) {
      flags.flare = { a: a.id, b: b.id, until: state.turn + 2 };
      text = `${a.name} and ${b.name} ${EVENT_CARDS.flare?.text ?? ""}`;
    }
  } else {
    const q = drawRange(rng, 0, QUIET_NIGHTS.length);
    rng = q.next;
    text = QUIET_NIGHTS[Math.floor(q.value)] ?? QUIET_NIGHTS[0] ?? "";
  }
  if (!text) return { state, next: rng, entry: null };
  const card = EVENT_CARDS[chosen.id];
  return {
    state: { ...state, flags },
    next: rng,
    entry: { turn: state.turn, kind: "event", text: `${card ? card.title + ". " : ""}${text}` }
  };
}
function expireFlare(state) {
  const f = state.flags.flare;
  if (!f || state.turn <= f.until) return state;
  return { ...state, flags: { ...state.flags, flare: null } };
}
function resolveFork(state) {
  const fork = state.flags.fork;
  if (!fork || state.turn < fork.deadline) return { state, entry: null };
  const n = state.npcs.find((x) => x.id === fork.npcId);
  const flags = { ...state.flags, fork: null, bylaws: [...state.flags.bylaws] };
  if (!n || n.trust >= 1) {
    return {
      state: { ...state, flags },
      entry: {
        turn: state.turn,
        kind: "event",
        text: `${n?.name ?? "The matter"} let it drop. Whatever was said on the steps, it was not said again.`
      }
    };
  }
  const theirs = state.sites.filter((s) => s.owner === n.id).map((s) => s.id);
  const cut = { ...state, seceded: [.../* @__PURE__ */ new Set([...state.seceded, ...theirs])], flags };
  const stillUp = reachable(cut);
  const stranded = cut.sites.filter((s) => !cut.seceded.includes(s.id) && !stillUp.has(s.id)).map((s) => s.id);
  const after = { ...cut, seceded: [...cut.seceded, ...stranded] };
  const names = theirs.map((id) => site(state, id).name).join(" and ");
  return {
    state: after,
    entry: {
      turn: state.turn,
      kind: "event",
      text: `${n.name} left the co-op and took ${names} with them.${stranded.length > 0 ? ` ${stranded.length} more site${stranded.length === 1 ? "" : "s"} went dark in the process, having reached the stub only through those roofs.` : ""}`
    }
  };
}

// src/game/vote.ts
var TRUST_WEIGHT = 0.8;
var GRUDGE_PENALTY = -1.5;
var FLARE_PENALTY = -1;
var SELF_INTEREST = 1.5;
function noiseWidth(state) {
  return state.flags.bylaws.includes("open-books") ? VOTE_NOISE * 0.6 : VOTE_NOISE;
}
function scoreTerms(state, p, n) {
  const info = interests(state, p);
  const owned = state.sites.filter((s) => s.owner === n.id).map((s) => s.id);
  const touchesMine = info.sites.some((id) => owned.includes(id));
  const b = bloc(state, n);
  const blocTerm = blocInterest(state, p, b, info);
  let selfInterest = 0;
  if (info.benefits.includes(n.id)) selfInterest += SELF_INTEREST;
  if (info.costs.includes(n.id)) selfInterest -= SELF_INTEREST;
  const grudge = info.benefits.some((x) => x !== n.id && n.grudges.includes(x)) ? GRUDGE_PENALTY : 0;
  let flare = 0;
  const f = state.flags.flare;
  if (f && state.turn <= f.until) {
    const radioactive = state.sites.filter((s) => s.owner === f.a || s.owner === f.b).map((s) => s.id);
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
  if (p.namedStakeholder === n.id && n.quirk !== "consultation") quirk += 1;
  return { bloc: b, blocInterest: blocTerm, selfInterest, trustTerm: TRUST_WEIGHT * n.trust, grudge, flare, quirk };
}
function expectedScore(state, p, n) {
  const t = scoreTerms(state, p, n);
  return t.blocInterest + t.selfInterest + t.trustTerm + t.grudge + t.flare + t.quirk;
}
function assemblyLean(state, p) {
  const total = state.npcs.reduce((s, n) => s + n.households, 0);
  if (total === 0) return 0;
  return state.npcs.reduce((s, n) => s + expectedScore(state, p, n) * n.households, 0) / total;
}
function shareFor(score, wobble) {
  return Math.max(0, Math.min(1, 0.5 + VOTE_SHARPNESS * score + wobble));
}
function castVote(state, proposal, cursor) {
  const width = noiseWidth(state);
  let rng = cursor;
  const ballots = [];
  for (const n of state.npcs) {
    if (n.households <= 0) continue;
    const t = scoreTerms(state, proposal, n);
    const d = drawRange(rng, -width, width);
    rng = d.next;
    const score = t.blocInterest + t.selfInterest + t.trustTerm + t.grudge + t.flare + t.quirk;
    const yes2 = Math.round(n.households * shareFor(score, d.value));
    ballots.push({
      npcId: n.id,
      bloc: t.bloc,
      households: n.households,
      yes: yes2,
      no: n.households - yes2,
      blocInterest: t.blocInterest + t.selfInterest,
      trustTerm: t.trustTerm,
      grudge: t.grudge,
      flare: t.flare,
      quirk: t.quirk,
      score
    });
  }
  const blocs = [];
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

// src/game/reducer.ts
var clamp = (n, lo = -3, hi = 3) => Math.max(lo, Math.min(hi, n));
function initialState(seed) {
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
    flags: {
      stormEta: null,
      lastStorm: -99,
      hoarder: null,
      flare: null,
      fork: null,
      landlord: null,
      seizedUntil: null,
      bylaws: [],
      drag: 0
    },
    log: [
      {
        turn: 0,
        kind: "minute",
        text: "You were elected delegate on a show of hands, eleven to four, in the back of the Superior Wash. The fiber stub at the Rialto works. Two links hang off it. Everything else on the map is dark, and the council meets every evening for the next twenty days."
      }
    ],
    lastVote: null,
    pendingCounter: null,
    outcome: null
  };
}
function log(state, kind, text, tone) {
  return [...state.log, { turn: state.turn, kind, text, tone }];
}
function withNpc(state, id, f) {
  return state.npcs.map((n) => n.id === id ? f(n) : n);
}
function rollWeather(state) {
  if (state.flags.stormEta !== null && state.turn >= state.flags.stormEta) {
    return { weather: "storm", next: draw(state.rng).next };
  }
  const d = draw(state.rng);
  const w = d.value < 0.4 ? "clear" : d.value < 0.75 ? "fog" : "rain";
  return { weather: w, next: d.next };
}
var WEATHER_TEXT = {
  clear: "Clear and cold. Every beam on the map is doing what it was aimed to do.",
  fog: "Fog off the lake, thick to the third floor. The optical links are guessing.",
  rain: "Rain all day, steady. The beams hold, mostly, and the roofs are miserable to be on.",
  storm: "The storm. Wind off the water and horizontal rain, and the sound the water tower makes."
};
function openDay(state) {
  let s = expireFlare(
    decay({ ...state, turn: state.turn + 1, phase: "day", lastVote: null, pendingCounter: null })
  );
  const { weather, next } = rollWeather(s);
  s = { ...s, weather, rng: next };
  if (s.flags.hoarder) s = { ...s, flags: { ...s.flags, drag: Math.min(0.25, s.flags.drag + 0.04) } };
  s = { ...s, links: s.links.map((l) => ({ ...l, reliability: reliabilityOf(s, l, weather) })) };
  s = { ...s, log: log(s, "day", `Day ${s.turn}.`) };
  s = { ...s, log: log(s, "weather", WEATHER_TEXT[weather]) };
  if (weather === "storm") {
    const fragile = s.links.filter((l) => l.status === "active" && l.reliability < 0.5);
    s = {
      ...s,
      links: s.links.map(
        (l) => l.status === "active" && l.reliability < 0.5 ? { ...l, status: "down", scar: Number((l.scar + SCAR_PER_STORM).toFixed(3)) } : l
      ),
      flags: { ...s.flags, stormEta: null }
    };
    s = {
      ...s,
      log: log(
        s,
        "event",
        fragile.length === 0 ? "The storm came through and the network did not notice. Somebody should write down that this is what hardening buys." : `The storm took down ${fragile.length} link${fragile.length === 1 ? "" : "s"}: ${fragile.map((l) => `${site(s, l.from).name} to ${site(s, l.to).name}`).join("; ")}. They can be re-aimed, but not made new; the weather keeps what it takes.`
      )
    };
  }
  if (s.flags.bylaws.includes("mutual-aid")) {
    const broken = s.links.find((l) => l.status === "down");
    if (broken) {
      s = {
        ...s,
        links: s.links.map((l) => l.id === broken.id ? { ...l, status: "active" } : l),
        log: log(
          s,
          "event",
          `Under the mutual aid rule, a crew re-aimed ${site(s, broken.from).name} to ${site(s, broken.to).name} before anyone asked them to.`
        )
      };
    }
  }
  if (s.flags.seizedUntil !== null && s.turn >= s.flags.seizedUntil) {
    s = { ...s, flags: { ...s.flags, seizedUntil: null } };
    s = {
      ...s,
      log: log(
        s,
        "event",
        "Dez came back from downtown with the padlock in her coat pocket and an order she will not explain. The stub is live again. Nothing about why it was taken has changed."
      )
    };
  } else if (s.flags.landlord !== null && s.turn >= s.flags.landlord.deadline) {
    s = {
      ...s,
      flags: { ...s.flags, landlord: null, seizedUntil: s.turn + SEIZURE_DAYS }
    };
    s = {
      ...s,
      log: log(
        s,
        "event",
        `${EVENT_CARDS.seizure?.title}. ${EVENT_CARDS.seizure?.text} It will be day ${s.flags.seizedUntil} before anything comes back.`
      )
    };
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
function trustGain(n) {
  if (!DIMINISHING_VISITS) return 1;
  return Number((1 / (n.visits + 1)).toFixed(3));
}
function decay(state) {
  return {
    ...state,
    npcs: state.npcs.map((n) => {
      const t = n.trust * (1 - TRUST_DECAY);
      if (Math.abs(t) < 0.05) return n.trust === 0 ? n : { ...n, trust: 0 };
      return { ...n, trust: Number(t.toFixed(3)) };
    })
  };
}
function takeAction(state, a) {
  if (state.actionsLeft <= 0) return state;
  let s = { ...state, actionsLeft: state.actionsLeft - 1 };
  if (a.type === "VISIT") {
    const n = s.npcs.find((x) => x.id === a.npcId);
    if (!n) return state;
    const gain = trustGain(n);
    s = {
      ...s,
      npcs: withNpc(s, a.npcId, (x) => ({ ...x, trust: clamp(x.trust + gain), visits: x.visits + 1 }))
    };
    return {
      ...s,
      log: log(
        s,
        "action",
        `Called on ${n.name}. "${n.publicPosition}"${gain < 1 ? " You have had this conversation before, and it went about as far as it went last time." : ""}`
      )
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
    links: s.links.map((l) => l.id === a.linkId ? { ...l, status: "active" } : l)
  };
  return {
    ...s,
    log: log(
      s,
      "action",
      `Spent the afternoon on a roof re-aiming ${site(s, link.from).name} to ${site(s, link.to).name}. It is back up${link.scar > 0 ? ", and it is not what it was. Only the fund fixes that." : "."}`
    )
  };
}
function execute(state, p) {
  const info = interests(state, p);
  let s = { ...state, budget: state.budget - p.cost };
  if (p.kind === "build-link" && p.from && p.to && p.linkKind) {
    const bare = bareEnds(s, p.from, p.to);
    s = { ...s, sites: s.sites.map((x) => bare.includes(x.id) ? { ...x, hasNode: true } : x) };
    const link = {
      id: linkId(p.from, p.to),
      from: p.from,
      to: p.to,
      kind: p.linkKind,
      status: "active",
      reliability: 0.9,
      scar: 0
    };
    s = { ...s, links: [...s.links, link] };
    s = { ...s, links: s.links.map((l) => ({ ...l, reliability: reliabilityOf(s, l, s.weather) })) };
  } else if (p.kind === "harden" && p.siteId) {
    s = { ...s, sites: s.sites.map((x) => x.id === p.siteId ? { ...x, hardened: true } : x) };
    s = {
      ...s,
      links: s.links.map((l) => l.from === p.siteId || l.to === p.siteId ? { ...l, scar: 0 } : l)
    };
    if (s.flags.hoarder?.siteId === p.siteId) {
      s = { ...s, flags: { ...s.flags, hoarder: null, drag: 0 } };
    }
  } else if (p.kind === "raise-dues") {
    s = { ...s, budget: s.budget + COSTS.duesGain };
  } else if (p.kind === "bylaw" && p.bylawId) {
    s = { ...s, flags: { ...s.flags, bylaws: [...s.flags.bylaws, p.bylawId] } };
    if (p.bylawId === "clinic-priority") s = { ...s, flags: { ...s.flags, hoarder: null, drag: 0 } };
    if (p.bylawId === "incorporate") s = { ...s, flags: { ...s.flags, landlord: null, seizedUntil: null } };
  }
  s = {
    ...s,
    npcs: s.npcs.map((n) => {
      let t = n.trust;
      if (info.benefits.includes(n.id)) t += TRUST_ON_BENEFIT;
      if (info.costs.includes(n.id)) t += TRUST_ON_COST;
      if (p.namedStakeholder === n.id) t += TRUST_ON_BEING_NAMED;
      return t === n.trust ? n : { ...n, trust: Number(clamp(t).toFixed(3)) };
    })
  };
  const bylaw = p.bylawId ? BYLAWS.find((b) => b.id === p.bylawId) : void 0;
  return { ...s, log: log(s, "execution", executionMinute(s, p, bylaw?.minute)) };
}
function executionMinute(s, p, bylawMinute) {
  if (bylawMinute) return bylawMinute;
  if (p.kind === "build-link" && p.from && p.to) {
    return `Carried into effect: ${site(s, p.from).name} to ${site(s, p.to).name} is up. Coverage now stands at ${Math.round(coverage(s) * 100)}% of the map.`;
  }
  if (p.kind === "harden" && p.siteId) {
    return `Carried into effect: a battery and a shroud at ${site(s, p.siteId).name}. It will hold in weather that would have taken it down.`;
  }
  return `Carried into effect: dues go up by four dollars. The fund stands at ${s.budget}.`;
}
var BLOC_NAME = {
  essential: "the clinic and the annex",
  connected: "the connected",
  dark: "the dark",
  renters: "the renters"
};
function tally(v, kind) {
  const head = kind === "counter" ? "On the amendment" : "On the motion";
  const lean = (b) => `${BLOC_NAME[b.bloc]} ${b.yes}-${b.no} ${b.yes > b.no ? "for" : b.yes === b.no ? "split" : "against"}`;
  const tie = !v.passed && v.yes === v.no;
  return `${head}: ${v.yes} in favour, ${v.no} against, of ${v.yes + v.no} households. ${v.blocs.map(lean).join("; ")}. ${v.passed ? "Carried." : tie ? "Tied, and the chair does not break ties. Not carried." : "Not carried."}`;
}
function closeNight(state) {
  let s = state;
  const forkShare = s.seceded.length / s.sites.length;
  if (s.turn >= TURNS || forkShare > 0.4) {
    const outcome = evaluate(s);
    return { ...s, phase: "over", outcome, log: log(s, "ending", outcome.epilogue) };
  }
  return { ...s, phase: "morning" };
}
function holdVote(state, p) {
  const { result, next } = castVote(state, p, state.rng);
  let s = { ...state, rng: next, lastVote: result };
  s = { ...s, log: log(s, "motion", `The delegate moves ${p.motion}.`) };
  s = { ...s, log: log(s, "vote", tally(result, "motion"), result.passed ? "carried" : "lost") };
  if (result.passed) return closeNight(execute(s, p));
  const against = new Map(result.ballots.map((b) => [b.npcId, b.no / Math.max(1, b.households)]));
  s = {
    ...s,
    npcs: s.npcs.map((n) => {
      const share = against.get(n.id) ?? 0;
      if (share <= 0) return n;
      return { ...n, trust: Number(clamp(n.trust + TRUST_ON_LOST_MOTION * share).toFixed(3)) };
    })
  };
  const options = counterproposals(s, p);
  if (options.length === 0) {
    s = { ...s, log: log(s, "minute", "Nobody had an alternative in hand. The meeting adjourned early and badly.") };
    return closeNight(s);
  }
  const best = [...options].sort((a, b) => assemblyLean(s, b) - assemblyLean(s, a))[0];
  if (!best) return closeNight(s);
  const counter = castVote(s, best, s.rng);
  s = { ...s, rng: counter.next, pendingCounter: counter.result, phase: "counter" };
  s = { ...s, log: log(s, "motion", `${counterSpeaker(s, best)} moves instead ${best.motion}.`) };
  s = { ...s, log: log(s, "vote", tally(counter.result, "counter"), counter.result.passed ? "carried" : "lost") };
  if (counter.result.passed) s = execute(s, best);
  else s = { ...s, log: log(s, "minute", "The amendment failed too. The meeting adjourned with nothing decided, which is itself a decision.") };
  return s;
}
function counterSpeaker(state, p) {
  const info = interests(state, p);
  const floor = state.npcs.filter((n) => n.households > 0);
  const speaker = [...floor].filter((n) => info.benefits.includes(n.id)).sort((a, b) => b.households - a.households)[0] ?? [...floor].sort((a, b) => b.trust - a.trust)[0];
  return speaker ? speaker.name : "A voice from the back";
}
function reduce(state, action) {
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
          "The delegate brought no motion. The council spent the evening on the minutes of the previous evening."
        )
      };
      return closeNight(s);
    }
    case "ACCEPT_COUNTER":
      return state.phase === "counter" ? closeNight({ ...state, pendingCounter: null }) : state;
    default:
      return state;
  }
}
function availableById(state, id) {
  return availableProposals(state).find((p) => p.id === id);
}

// src/ui/words.ts
function trustWord(t) {
  if (t <= -2) return "hostile";
  if (t <= -1) return "cold";
  if (t < -0.3) return "wary";
  if (t <= 0.3) return "neutral";
  if (t < 1) return "civil";
  if (t < 2) return "warm";
  return "staunch";
}
function weatherWord(w) {
  return { clear: "clear", fog: "fog", rain: "rain", storm: "STORM" }[w];
}
function powerWord(p) {
  return { grid: "grid", solar: "solar", none: "no power" }[p] ?? p;
}
function kindWord(k) {
  return { fso: "optical", lora: "LoRa", cable: "cable" }[k] ?? k;
}
var BLOC_LABEL = {
  essential: "the clinic and the annex",
  connected: "the connected",
  dark: "the dark",
  renters: "the renters"
};
var BLOC_WANT = {
  essential: "wants the sites people depend on up, whatever it costs",
  connected: "wants what exists to work, and not to pay for anyone else's roof",
  dark: "wants building, any building, and resents money spent on upkeep",
  renters: "owns no roof, pays dues anyway, votes on precedent"
};

// src/cli.ts
var SAVE = process.env.DELEGATE_SAVE ?? ".delegate-save.json";
var TRANSCRIPT = process.env.DELEGATE_TRANSCRIPT ?? ".delegate-transcript.md";
var out = [];
var say = (s = "") => out.push(s);
var rule = (label = "") => say(label ? `\u2500\u2500 ${label} ${"\u2500".repeat(Math.max(0, 66 - label.length))}` : "\u2500".repeat(70));
function load() {
  try {
    return JSON.parse(readFileSync(SAVE, "utf8"));
  } catch {
    fail(`No run in progress. Start one with:  node play.mjs new`);
  }
}
function store(save) {
  writeFileSync(SAVE, JSON.stringify(save));
}
function fail(message) {
  process.stdout.write(`${message}
`);
  process.exit(1);
}
function header(s, seedText) {
  const up = reachable(s);
  say(
    `DELEGATE \xB7 seed "${seedText}" \xB7 day ${Math.max(s.turn, 1)} of ${TURNS} \xB7 ${weatherWord(s.weather)}`
  );
  say(
    `coverage ${Math.round(coverage(s) * 100)}% (${up.size} of ${s.sites.length} sites) \xB7 fund ${s.budget} \xB7 actions ${s.actionsLeft} \xB7 monologue tokens ${s.tokens}`
  );
  const warn = [];
  if (s.flags.stormEta !== null) warn.push(`storm expected day ${s.flags.stormEta}`);
  if (s.flags.landlord) warn.push(`the landlord takes the stub on day ${s.flags.landlord.deadline}`);
  if (s.flags.seizedUntil !== null) warn.push(`THE STUB IS SEIZED until day ${s.flags.seizedUntil}`);
  if (s.flags.hoarder) warn.push(`${site2(s, s.flags.hoarder.siteId).name} is saturating the network`);
  if (s.flags.fork) warn.push(`${who(s, s.flags.fork.npcId)} is talking about leaving`);
  for (const w of warn) say(`  ! ${w}`);
}
var site2 = (s, id) => s.sites.find((x) => x.id === id);
var who = (s, id) => s.npcs.find((x) => x.id === id)?.name ?? id;
var ORDER = ["connected", "dark", "essential", "renters"];
function assemblyPane(s, full) {
  const sizes = assembly(s);
  rule(`THE ASSEMBLY \xB7 ${households(s)} households`);
  for (const b of ORDER) {
    const rows = s.npcs.filter((n) => n.households > 0 && bloc(s, n) === b).sort((x, y) => y.households - x.households);
    if (rows.length === 0) continue;
    say(`${BLOC_LABEL[b]} \xB7 ${sizes[b]} households`);
    say(`  ${BLOC_WANT[b]}`);
    if (!full) continue;
    for (const n of rows) {
      const read = s.revealed.includes(n.id) ? "  (motivation known)" : "";
      say(
        `    ${n.id.padEnd(9)} ${n.name.padEnd(18)} ${String(n.households).padStart(2)} households  ${trustWord(n.trust).padEnd(8)}${read}`
      );
    }
  }
}
function asciiMap(s) {
  const W = 64;
  const H = 19;
  const grid = Array.from({ length: H }, () => Array(W).fill(" "));
  const up = reachable(s);
  const put = (row, col, text) => {
    if (row < 0 || row >= H) return;
    for (let i = 0; i < text.length; i++) {
      const c = col + i;
      if (c < 0 || c >= W) continue;
      if (grid[row][c] !== " ") continue;
      grid[row][c] = text[i];
    }
  };
  for (const st of s.sites) {
    const col = Math.round((st.x - 110) / 470 * (W - 16));
    const row = Math.round((st.y - 110) / 380 * (H - 2));
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
function mapPane(s) {
  asciiMap(s);
  say("");
  for (const st of liveSites(s)) {
    const up = reachable(s).has(st.id);
    const bits = [
      powerWord(st.power),
      `elevation ${st.elevation}/3`,
      st.hasNode ? st.hardened ? "node, hardened" : "node" : "no equipment",
      up ? "on the network" : "dark"
    ];
    say(`  ${st.id.padEnd(11)} ${st.name} \u2014 ${bits.join(", ")}`);
    say(`  ${" ".repeat(11)} owner: ${who(s, st.owner)}`);
    for (const l of s.links.filter((x) => x.from === st.id || x.to === st.id)) {
      const other = l.from === st.id ? l.to : l.from;
      say(
        `  ${" ".repeat(11)} link ${l.id.padEnd(22)} to ${site2(s, other).short}, ${kindWord(l.kind)}, ${l.status}, reliability ${l.reliability.toFixed(2)}` + (l.scar > 0 ? `, scarred ${l.scar.toFixed(2)}` : "")
      );
    }
    if (s.scouted.includes(st.id)) {
      const terrain = s.feasible.filter((f) => f.from === st.id || f.to === st.id).map((f) => `${site2(s, f.from === st.id ? f.to : f.from).short} (${kindWord(f.kind)})`);
      if (terrain.length > 0) say(`  ${" ".repeat(11)} terrain allows: ${terrain.join(", ")}`);
    } else {
      say(`  ${" ".repeat(11)} nobody has walked this one`);
    }
  }
}
function minutes(save, all = false, skipTallies = false) {
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
var GROUPS = [
  { kind: "build-link", heading: "extend the network" },
  { kind: "harden", heading: "make good what exists" },
  { kind: "raise-dues", heading: "the fund itself" },
  { kind: "bylaw", heading: "change a bylaw" }
];
function agenda(s, p) {
  const named = p.namedStakeholder ? `  \xB7 naming ${who(s, p.namedStakeholder)}` : "";
  if (p.kind === "build-link" && p.from && p.to) {
    const bare = [p.from, p.to].filter((id) => !site2(s, id).hasNode).map((id) => site2(s, id).short);
    const mounts = bare.length > 0 ? `  (mounts ${bare.join(" and ")})` : "";
    return `${kindWord(p.linkKind ?? "fso").padEnd(7)} ${site2(s, p.from).short} \u2192 ${site2(s, p.to).short}${mounts}${named}`;
  }
  if (p.kind === "harden" && p.siteId) return `harden  ${site2(s, p.siteId).short}${named}`;
  if (p.kind === "raise-dues") return "dues up four dollars a household";
  return p.motion.replace(/^that /, "");
}
function motions(s) {
  const menu = availableProposals(s);
  rule("MOTIONS YOU COULD BRING");
  let i = 0;
  const ordered = [];
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
function tally2(s, v, what) {
  rule(what);
  const verdict = v.passed ? "CARRIED" : v.yes === v.no ? "TIED, and the chair does not break ties \u2014 not carried" : "not carried";
  say(`  ${v.yes} for, ${v.no} against, of ${v.yes + v.no} households \u2014 ${verdict}`);
  for (const b of v.blocs) {
    const width = 16;
    const filled = Math.round(b.yes / Math.max(1, b.households) * width);
    say(
      `    ${BLOC_LABEL[b.bloc].padEnd(26)} ${"#".repeat(filled)}${".".repeat(width - filled)} ${b.yes}-${b.no}`
    );
    for (const x of v.ballots.filter((y) => y.bloc === b.bloc)) {
      say(`      ${who(s, x.npcId).padEnd(24)} ${String(x.yes).padStart(2)}-${x.no}`);
    }
  }
}
function whatNow(s) {
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
function newRun(seedText) {
  const save = { v: 1, seedText, state: initialState(seedFrom(seedText)), shown: 0 };
  say(`A new run. Seed "${seedText}" \u2014 the same seed always plays the same way.`);
  say("");
  return save;
}
function act(save, kind, arg) {
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
    if (s.scouted.includes(arg)) fail(`${site2(s, arg).name} has already been walked.`);
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
    say("DELEGATE \u2014 you are the elected delegate of a neighbourhood mesh co-op.");
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
  let save;
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
function need(arg, usage) {
  if (!arg) fail(`Usage:  node play.mjs ${usage}`);
  return arg;
}
function render(save, before, cmd) {
  const s = save.state;
  const isDecision = cmd === "convene" || cmd === "look" || cmd === "new";
  header(s, save.seedText);
  if (cmd === "move" || cmd === "abstain" || cmd === "enter") {
    minutes(save, false, true);
    if (s.lastVote) tally2(s, s.lastVote, "THE VOTE");
    if (s.pendingCounter) {
      tally2(s, s.pendingCounter, "THE AMENDMENT SOMEBODY PUT IN ITS PLACE");
      say("");
      say(
        s.pendingCounter.passed ? "  You argued against it or you did not; either way you are the one who builds it." : "  Nothing was decided tonight, which is itself a decision."
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
      `  coverage ${Math.round(s.outcome.coverage * 100)}% \xB7 cohesion ${s.outcome.cohesion.toFixed(2)} \xB7 ${s.turn} days`
    );
  }
  if (["visit", "read", "walk", "fix"].includes(cmd) && s.actionsLeft !== before.actionsLeft) {
  }
  whatNow(s);
}
function flush(save) {
  const text = `${out.join("\n")}
`;
  process.stdout.write(text);
  if (save) {
    store(save);
    try {
      appendFileSync(TRANSCRIPT, `

$ node play.mjs ${process.argv.slice(2).join(" ")}

${text}`);
    } catch {
    }
  }
}
main();
