# DELEGATE

A social grand-strategy prototype. You are the elected delegate of a
neighbourhood mesh co-op in a flood-battered Chicago. You do not rule. You
propose, and the council votes, and **you execute whatever passes, including
the counterproposals you argued against.**

Twenty days, about ten minutes a run, seeded so a run can be shared as a
string.

## What this prototype is for

One claim: **that losing votes is fun.** The delegate loop — build
relationships, bring a motion, sometimes lose, live with the outcome — is the
mechanic no other strategy game has. Everything else in the design (FSO link
budgets, climate simulation, epistolary delays, federation between co-ops) is
stubbed to flavour text or cut outright.

## Running it

With nix and direnv:

```sh
direnv allow      # or: nix develop --impure
npm run dev
```

Without nix:

```sh
npm install && npm run dev
```

Other commands: `npm run check` (typecheck, tests, production build) and
`npm run sim` (below).

Two notes on the nix side. `flake.lock` is not committed — nix writes one the
first time you enter the shell, which pins it to whatever `devenv-nixpkgs`
rolling is that day. And the flake was authored on a machine without nix
installed, so it has never actually been evaluated; if it fails, it fails on
the first `direnv allow` and the fallback above works regardless.

## How a day goes

**Morning.** Weather rolls. Fog is the villain and only bothers the optical
links. At most one card comes off the event deck: saturation on a link, an old
grudge flaring up, a storm telegraphed two days out, somebody being asked on
the church steps whether their end of the network might do better alone.

**Day.** Two actions. Call on somebody (+trust, and you hear what they say they
want), spend a monologue token (you get three a run, and you hear what they
actually want), walk a site (learn what the terrain allows from that roof), or
get up on a roof and re-aim a link that went down.

**Evening.** You bring exactly one motion. The council votes:

```
score = selfInterest + 0.8 × trust + grudgeModifier + noise(-0.5 .. +0.5)
```

`selfInterest` is derived from the graph, never authored per motion: +2 if the
motion puts your site on the network, −2 if it spends your roof, your power or
your bandwidth and gives you nothing. A grudge against whoever the motion helps
is −1.5. Above zero is an aye, and a majority carries. Ties fail; the chair does
not break them.

**You never see a predicted vote.** Reading the room is the skill, and a number
would do the reading for you. Standings are shown in words — hostile, cold,
wary, neutral, civil, warm, staunch — and the breakdown of who voted how is
published in the minutes after the fact.

If your motion fails, somebody in the room has an alternative. The
highest-scoring one gets a vote immediately, and if it carries, you are the one
who goes and builds it. That is where "playing out a decision you opposed"
happens mechanically rather than narratively.

## Winning, and the two ways of half-winning

Coverage is the fraction of the ten sites the uplink can reach through active
links. Cohesion is mean trust across the council. The run ends on day 20, or
when the co-op forks with more than 40% of the map.

| | |
|---|---|
| **Win** | coverage ≥ 80% and cohesion ≥ 1.0 |
| **Partial** | you built a network and burned the community |
| **Partial** | you kept the community and did not build enough |
| **Lose** | the co-op forks, or coverage < 50% |

The dual condition is the thesis: infrastructure and social fabric are the same
resource pool.

## Reading the room, measured

`npm run sim` plays many seeded runs with three scripted delegates and prints
the spread. Over 200 runs:

| | win | built, burned | kept, unbuilt | dark | forked | motions carried |
|---|---|---|---|---|---|---|
| reads the room | 30% | 32% | 33% | 6% | 0% | 78% |
| ignores the room | 0% | 9% | 26% | 65% | 0% | 41% |
| never talks to anyone | 0% | 0% | 0% | 56% | 45% | 0% |

The first bot can see the council's leanings, which you cannot, so treat 30% as
a ceiling rather than a par. The number that matters for the thesis is 78%:
about one motion in five fails for a competent delegate, which puts the
counterproposal mechanic on screen four or five times a run.

## Shape of the code

Every turn is `state -> state`. The whole game is one JSON object and a pure
reducer over a seeded mulberry32 whose cursor lives *in* the state, so a seed
plus a list of actions reproduces a run exactly. There is a test for that.

```
src/game/
  types.ts        the shape of the world
  content.ts      the entire neighbourhood - rewrite this file, get a new one
  rng.ts          mulberry32, split so the cursor can live in state
  graph.ts        reachability, coverage, cohesion, reliability
  proposals.ts    generates the menu and the counterproposals, from the graph
  vote.ts         the scoring function above
  events.ts       the event deck and how a fork resolves
  reducer.ts      state -> state
  outcome.ts      endings and epilogues
  sim.ts          the tuning harness behind that table
src/ui/           three panes, plain SVG map, hand-placed coordinates
```

The mesh topology and the social graph are one data structure: sites are nodes,
people own sites, and a motion's politics fall out of the topology. That is what
makes counterproposals possible at all — the council can score an alternative
nobody wrote down in advance.

All the authored content is in `content.ts`: ten sites, ten people, six of them
on the council, four grudges, a five-card deck, four bylaws. Two people have a
true motivation that inverts how you would approach them. The water tower lady
says the co-op's hardware is an eyesore; what actually happened is that in '31
they bolted a repeater to her roof while she was at her sister's funeral, and
nobody asked. Name her as a stakeholder in a motion and she will hand you the
tower.

## The questions this is meant to answer

Still open. They are the reason to play it rather than read it.

1. Is two actions a day plus one motion a night the right pacing, or does it
   need a planning phase?
2. Do monologue tokens matter, or does trust-grinding dominate? Visits already
   halve in value each time (`DIMINISHING_VISITS` in `content.ts` turns that
   off) and trust decays 7% a day, so the current answer is "trust is a flow" —
   but whether the tokens earn their place is a question for a person playing.
3. Does the counterproposal mechanic produce "I lost and it's interesting" or
   "I lost and I'm annoyed"? This is the whole bet.
