// The mesh topology and the social graph are one data structure. Sites are
// nodes, NPCs own sites, links are edges. Everything a council member believes
// about a proposal is derived from this graph, never authored per proposal.

export type PowerKind = "grid" | "solar" | "none";
export type LinkKind = "fso" | "lora" | "cable";
export type LinkStatus = "proposed" | "active" | "down";
export type WeatherKind = "clear" | "fog" | "rain" | "storm";

export interface Site {
  id: string;
  name: string;
  short: string; // what fits on the map
  owner: string; // NPC id
  hasNode: boolean; // is co-op equipment mounted here
  power: PowerKind;
  elevation: number; // 1-3, affects line-of-sight
  x: number; // hand-placed map coordinates, no force layout
  y: number;
  uplink: boolean;
  hardened: boolean; // a battery and a shroud, bought with the co-op fund
  /** The clinic, the annex, the pump house. People vote differently about these. */
  essential: boolean;
  note: string; // flavor, shown once scouted
}

/** The quirks that make two NPCs read differently once you know their real reason. */
export type Quirk = "consultation" | "clinic-first" | "none";

/**
 * Not a voter: the face of one. Everybody in the neighbourhood votes, and a
 * named figure carries the households they speak for with them.
 */
export interface NPC {
  id: string;
  name: string;
  publicPosition: string; // what they say they want
  trueMotivation: string; // revealed by a monologue token
  trust: number; // -3..+3 toward the player
  grudges: string[]; // NPC ids they're mad at
  /** How many households vote with them. Public, and the whole reason to
   *  spend a day on Hollis rather than on Terrence. */
  households: number;
  quirk: Quirk;
  visits: number; // for diminishing returns on trust-grinding
}

/**
 * Where a constituency sits, computed from the map rather than authored. This
 * is the load-bearing idea: connect a block and its households move out of the
 * bloc that wants expansion and into the one that resents paying for it.
 */
export type Bloc = "essential" | "connected" | "dark" | "renters";

export interface Link {
  id: string;
  from: string;
  to: string;
  kind: LinkKind;
  status: LinkStatus;
  reliability: number; // 0..1, kind + weather + power derived
  /** Every storm that takes this link down leaves a mark. Repair restores the
   *  link, never the mark; only hardening, paid from the fund, does that. */
  scar: number;
}

/** A link the terrain allows but the co-op has not built. */
export interface Feasible {
  from: string;
  to: string;
  kind: LinkKind;
  note: string;
}

export type ProposalKind = "build-link" | "harden" | "raise-dues" | "bylaw";

export interface Proposal {
  id: string;
  kind: ProposalKind;
  /** Read as a motion in the minutes: "that the co-op string an FSO link…" */
  motion: string;
  cost: number;
  from?: string;
  to?: string;
  linkKind?: LinkKind;
  siteId?: string;
  bylawId?: string;
  /** Naming an owner as a stakeholder — the move the water tower is waiting for. */
  namedStakeholder?: string;
}

/** One constituency's return, which is a split rather than a yes or a no. */
export interface Ballot {
  npcId: string;
  bloc: Bloc;
  households: number;
  yes: number;
  no: number;
  blocInterest: number;
  trustTerm: number;
  grudge: number;
  flare: number;
  quirk: number;
  score: number;
}

export interface BlocTally {
  bloc: Bloc;
  households: number;
  yes: number;
  no: number;
}

export interface VoteResult {
  proposal: Proposal;
  ballots: Ballot[];
  blocs: BlocTally[];
  passed: boolean;
  yes: number;
  no: number;
}

export type LogKind =
  | "day"
  | "weather"
  | "event"
  | "action"
  | "motion"
  | "vote"
  | "minute"
  | "execution"
  | "ending";

export interface LogEntry {
  turn: number;
  kind: LogKind;
  text: string;
  /** Set on tallies, so the minutes can be read at a glance. */
  tone?: "carried" | "lost";
}

export interface EventCard {
  id: string;
  title: string;
  /** Rendered into the minutes when the card is drawn. */
  text: string;
}

export interface Flags {
  /** Telegraphed two turns before it lands. */
  stormEta: number | null;
  /** So the forecast does not cry wolf every other evening. */
  lastStorm: number;
  /**
   * The one pressure no amount of action-grinding touches: the landlord has
   * worked out what the fiber stub is worth. Only the incorporation bylaw
   * answers it. `seizedUntil` is set if you did not get there in time.
   */
  landlord: { deadline: number } | null;
  seizedUntil: number | null;
  hoarder: { siteId: string; since: number } | null;
  flare: { a: string; b: string; until: number } | null;
  fork: { npcId: string; deadline: number } | null;
  bylaws: string[];
  /** Neighborhood-wide reliability drag from an unaddressed hoarder. */
  drag: number;
}

export type Ending =
  | "win"
  | "partial-network"
  | "partial-community"
  | "lose-fork"
  | "lose-coverage";

export interface Outcome {
  ending: Ending;
  coverage: number;
  cohesion: number;
  epilogue: string;
}

export type Phase = "morning" | "day" | "council" | "counter" | "over";

export interface GameState {
  seed: number;
  rng: number; // the RNG cursor lives in state so the reducer stays pure
  turn: number;
  phase: Phase;
  actionsLeft: number;
  tokens: number; // monologue tokens, 3 per run
  budget: number;
  weather: WeatherKind;
  sites: Site[];
  npcs: NPC[];
  links: Link[];
  feasible: Feasible[];
  scouted: string[];
  revealed: string[]; // NPC ids whose true motivation you have heard
  seceded: string[]; // site ids lost to a fork
  flags: Flags;
  log: LogEntry[];
  lastVote: VoteResult | null;
  /** Set when your motion fails and the council has an alternative in hand. */
  pendingCounter: VoteResult | null;
  outcome: Outcome | null;
}

export type PlayerAction =
  | { type: "VISIT"; npcId: string }
  | { type: "MONOLOGUE"; npcId: string }
  | { type: "SCOUT"; siteId: string }
  | { type: "REPAIR"; linkId: string };

export type GameAction =
  | { type: "OPEN_DAY" }
  | { type: "ACT"; action: PlayerAction }
  | { type: "SKIP_ACTIONS" }
  | { type: "CONVENE" }
  | { type: "PROPOSE"; proposalId: string }
  | { type: "ACCEPT_COUNTER" }
  | { type: "ABSTAIN" };
