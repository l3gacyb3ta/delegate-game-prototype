// Everything authored about this neighborhood lives here. Rewrite this file and
// you have a different co-op; nothing else in the game knows any proper nouns.

import type { EventCard, Feasible, Link, NPC, Site } from "./types";

export const TURNS = 20;
export const ACTIONS_PER_DAY = 2;
export const MONOLOGUE_TOKENS = 3;
export const STARTING_BUDGET = 6;

/** Coverage and cohesion are the two halves of the same resource pool. */
export const COVERAGE_WIN = 0.8;
export const COVERAGE_LOSS = 0.5;
export const COHESION_WIN = 1.0;
export const COHESION_FORK = -0.8;
export const FORK_LOSS_SHARE = 0.4;

export const COSTS = {
  mount: 1,
  fso: 2,
  lora: 1,
  cable: 3,
  harden: 2,
  duesGain: 4,
} as const;

/**
 * Trust is a flow, not a stock: each morning every standing relaxes toward
 * indifference by this fraction. Proportional rather than flat, so a steady
 * push in either direction settles somewhere real instead of being cancelled.
 */
export const TRUST_DECAY = 0.07;

/**
 * Visits halve in value each time, so calling on the same person five days
 * running is worth about 1.7 trust in total rather than 5. Set to false to
 * test whether trust-grinding dominates the run (open question 2 in the spec).
 */
export const DIMINISHING_VISITS = true;

/** What a carried motion does to the people it helps and the people it bills. */
export const TRUST_ON_BENEFIT = 0.25;
export const TRUST_ON_COST = -0.75;
export const TRUST_ON_BEING_NAMED = 1.5;

/**
 * What it costs you to keep tabling motions the room was never going to carry.
 * Small per occasion, ruinous as a habit — and the only route to a council
 * angry enough to fork.
 */
export const TRUST_ON_LOST_MOTION = -0.1;

export const BASE_RELIABILITY: Record<Link["kind"], number> = {
  cable: 0.95,
  fso: 0.9,
  lora: 0.7,
};

export const SITES: Site[] = [
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
    note: "The fiber stub terminates in a popcorn machine's junction box. Everything the co-op has comes through here.",
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
    note: "Two bays, one lift, and a rack of secondhand radios bolted where the compressor used to sit.",
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
    note: "Open until eleven. The node hums under the change machine and shares a meter with the dryers.",
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
    note: "A node was mounted here in the spring and has never been connected to anything. It blinks patiently.",
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
    note: "Sightlines to almost everything. No power, no ladder that anyone will admit to owning.",
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
    note: "Rear porch, third floor. There are still four anchor bolts up there from the '31 buildout.",
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
    note: "The bell tower is the second-highest thing on the block and the only one with a generator.",
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
    note: "Fourteen storeys, a parapet you could land a plane on, and a board that meets on Tuesdays.",
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
    note: "Six chairs, one autoclave, and a phone line that has been dead since the second flood.",
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
    note: "Below grade, half-flooded, and the reason this side of the block is dry. City property in the way a stray cat is city property.",
  },
];

export const NPCS: NPC[] = [
  {
    id: "yolanda",
    name: "Yolanda Reyes",
    publicPosition: "Co-op hardware is an eyesore. The tower is a landmark, not a mast.",
    trueMotivation:
      "In '31 the co-op bolted a repeater to her roof while she was at her sister's funeral. She does not care about the hardware. She cares that nobody asked. Name her a stakeholder in a motion and she will hand you the tower.",
    trust: -2,
    grudges: [],
    councilMember: true,
    quirk: "consultation",
    visits: 0,
  },
  {
    id: "marcus",
    name: "Marcus Ollivant",
    publicPosition: "Build outward from what already works. The garage is what already works.",
    trueMotivation:
      "He resells backhaul to two blocks south for cash and does not want the council auditing his throughput. Anything that routes around the garage is a threat to a business nobody has voted on.",
    trust: 1,
    grudges: ["dez"],
    councilMember: true,
    quirk: "none",
    visits: 0,
  },
  {
    id: "pastor",
    name: "Pastor Efrain Ruiz",
    publicPosition: "The church roof is neutral ground. No equipment, no antennas, no politics on it.",
    trueMotivation:
      "He buried a man last winter who could not get a call out. He will trade the roof, the tower, and his own vote for anything that puts the clinic on the network.",
    trust: 0,
    grudges: [],
    councilMember: true,
    quirk: "clinic-first",
    visits: 0,
  },
  {
    id: "dez",
    name: "Dez Okonkwo",
    publicPosition: "The fiber stub is co-op property. I am its caretaker, not its owner.",
    trueMotivation:
      "She is trying to get the co-op incorporated before the building's landlord notices what the stub is worth. Every vote is a precedent she is quietly filing away.",
    trust: 1,
    grudges: ["marcus"],
    councilMember: true,
    quirk: "none",
    visits: 0,
  },
  {
    id: "bea",
    name: "Bea Kowalczyk",
    publicPosition: "Fix what is broken before you build what is new.",
    trueMotivation:
      "The node and the dryers share a meter. Every watt the mesh draws is a wash she does not run, and she has never once said this out loud in a meeting.",
    trust: -1,
    grudges: ["marcus"],
    councilMember: true,
    quirk: "none",
    visits: 0,
  },
  {
    id: "june",
    name: "June Adeyemi",
    publicPosition: "I rent. I have no roof to give and no roof to protect.",
    trueMotivation:
      "She is the only person who has read the bylaws end to end, and she votes on precedent rather than on outcomes. She is also three months from moving to her mother's in Gary, and has told no one.",
    trust: 0,
    grudges: [],
    councilMember: true,
    quirk: "none",
    visits: 0,
  },
  {
    id: "hollis",
    name: "Hollis Trent",
    publicPosition: "Height is an asset. The building will host, at a price.",
    trueMotivation:
      "The 400's board is two votes from selling to a developer. He needs the building to become infrastructure the neighborhood would fight to keep.",
    trust: -1,
    grudges: [],
    councilMember: false,
    quirk: "none",
    visits: 0,
  },
  {
    id: "ada",
    name: "Ada Fenwick",
    publicPosition: "The clinic needs a line that works more than it needs a line that is fast.",
    trueMotivation:
      "She has been running triage over a neighbor's handheld LoRa set for five months and has not told the council, because she is certain they would take it away to be fair about it.",
    trust: 2,
    grudges: [],
    councilMember: false,
    quirk: "none",
    visits: 0,
  },
  {
    id: "sylvie",
    name: "Sylvie Boateng",
    publicPosition: "Kids first. Homework does not happen over fog.",
    trueMotivation:
      "She is documenting every council vote for a grant application. A co-op that looks well run is worth forty thousand dollars to the annex, and a co-op that looks chaotic is worth nothing.",
    trust: 1,
    grudges: [],
    councilMember: false,
    quirk: "none",
    visits: 0,
  },
  {
    id: "terrence",
    name: "Terrence Vogel",
    publicPosition: "The pump house is city property. I just have the keys.",
    trueMotivation:
      "He has kept the pumps running unpaid for three years and wants it written down somewhere official before he dies. A line to the pump house would mean the pumps are on a map.",
    trust: 0,
    grudges: ["hollis"],
    councilMember: false,
    quirk: "none",
    visits: 0,
  },
];

/** What the terrain allows. The council decides what gets built. */
export const FEASIBLE: Feasible[] = [
  { from: "rialto", to: "watertower", kind: "fso", note: "Clean shot up the alley once the tower's shroud comes off." },
  { from: "watertower", to: "lakeview", kind: "fso", note: "Tower to the 400's parapet. Four blocks, nothing in between but gulls." },
  { from: "watertower", to: "school", kind: "fso", note: "Downhill and short. Fog sits in this gap most mornings." },
  { from: "garage", to: "threeflat", kind: "fso", note: "Over the vacant lot. Line of sight depends on nobody rebuilding it." },
  { from: "lakeview", to: "church", kind: "fso", note: "Parapet to bell tower. The gulls are a real problem here." },
  { from: "laundromat", to: "clinic", kind: "fso", note: "Across Ashland. The clinic's awning clips the beam in a crosswind." },
  { from: "church", to: "clinic", kind: "lora", note: "Slow, but it does not care about weather and never has." },
  { from: "school", to: "pumphouse", kind: "lora", note: "Through two brick walls and a berm. LoRa or nothing." },
  { from: "threeflat", to: "laundromat", kind: "lora", note: "Rear porch to the roof vent. Sixty metres of nothing much." },
  { from: "garage", to: "pumphouse", kind: "lora", note: "The long way around the berm. Marginal, but it holds in weather." },
];

/** What the co-op already had on the morning you were elected. */
export const STARTING_LINKS: Link[] = [
  { id: "rialto~laundromat", from: "rialto", to: "laundromat", kind: "cable", status: "active", reliability: 0.95, },
  { id: "rialto~garage", from: "rialto", to: "garage", kind: "fso", status: "active", reliability: 0.9 },
];

export const BYLAWS: { id: string; motion: string; minute: string }[] = [
  {
    id: "consent",
    motion: "that no equipment be mounted on any roof without the owner's consent, recorded by name in the minutes",
    minute: "Consent is now on the record. Owners are named in every mounting motion from here.",
  },
  {
    id: "clinic-priority",
    motion: "that clinic and school traffic take priority on any saturated link",
    minute: "Priority traffic is now a rule rather than a favour. The hoarding argument has less air in it.",
  },
  {
    id: "mutual-aid",
    motion: "that down links be repaired before any new work is authorised",
    minute: "Repair comes first now. A crew goes out each morning without waiting to be asked.",
  },
  {
    id: "open-books",
    motion: "that every vote be recorded by name in the minutes",
    minute: "Votes are on the record. People argue their interests out loud now instead of guessing at each other.",
  },
];

export const EVENT_CARDS: Record<string, EventCard> = {
  hoarder: {
    id: "hoarder",
    title: "Saturation",
    text: "is pulling everything the link will carry, at all hours. Three people mentioned it before the meeting started. Reliability is dropping across the neighbourhood until the council addresses it.",
  },
  flare: {
    id: "flare",
    title: "Old business",
    text: "will not be in the same room civilly this week. Any motion touching either of their sites is going to take fire from everyone who is tired of it.",
  },
  fork: {
    id: "fork",
    title: "A quiet conversation on the steps",
    text: "has been asked whether their end of the network might do better on its own, and has not said no. You have until the end of the week.",
  },
  storm: {
    id: "storm",
    title: "Weather advisory",
    text: "Lake-effect system, two days out, and the forecast has not moved all morning. Anything holding below half reliability will not be holding after.",
  },
  quiet: {
    id: "quiet",
    title: "No new business",
    text: "",
  },
};

/** Flavour, and only flavour. A quiet night must not pay you in goodwill. */
export const QUIET_NIGHTS = [
  "Somebody brought tamales. The meeting ran short and nobody said anything they had to walk back.",
  "Two people came to complain about a thing the co-op does not do and left satisfied anyway.",
  "The minutes of the previous evening were read, corrected twice, and approved.",
  "A kid from the annex sat in the back for the whole meeting doing homework off the school node.",
  "The generator at the church was tested. It ran for eleven minutes and then it did not.",
];

export const EPILOGUES: Record<string, string> = {
  win: "Eight roofs, one stub, and a council that still returns your calls. The minutes for the year run to forty pages and nobody has asked for a recount. When the next delegate is elected in the spring, they will inherit a network and the habit of asking first. Both of those took twenty days and neither of them was yours alone.",
  "partial-network":
    "The network is up. Coverage holds through fog and most of a storm, and the clinic has a line that works. You also passed eleven motions over the objections of people who have to live with them, and the meeting hall is quieter than it used to be, in the bad way. Yolanda has stopped coming. The mesh does not notice.",
  "partial-community":
    "The co-op is intact, warm, and half-connected. Nobody left. Nobody stopped speaking to anyone. And when the pump house floods again, half the block will find out the way they always have, which is by seeing the water. You spent twenty days learning how to be trusted and did not spend enough of it building.",
  "lose-fork":
    "They took their roofs with them, which was always the risk and always their right. The two networks will interfere with each other on the same unlicensed band within a month, and both councils will spend the spring writing letters about it. You were not wrong about the engineering.",
  "lose-coverage":
    "Twenty days, six motions carried, and a map that still has more dark sites than lit ones. The fiber stub works. Almost nothing else reaches it. The co-op will elect somebody else in the spring and they will start where you started, which is the part that stings.",
};
