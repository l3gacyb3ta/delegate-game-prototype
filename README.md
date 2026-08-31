# DELEGATE

A social grand-strategy prototype. You are the elected delegate of a
neighbourhood mesh co-op in a flood-battered Chicago. You do not rule. You
propose, and the neighbourhood votes, and **you execute whatever passes, including
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
grudge flaring up, a storm telegraphed two days out, somebody being asked on the
church steps whether their end of the network might do better alone — or the
landlord.

Two things push back and neither is undone by an afternoon's work:

- **Storms leave scars.** A link the weather takes down can be re-aimed in an
  afternoon, but it never comes all the way back. Only hardening — a *motion*,
  paid from the fund — makes it good again, so the network ratchets down across
  the run unless you spend political capital on resilience.
- **The landlord.** Around day five he works out what a terminated fibre strand
  is worth, and the co-op has no legal existence and therefore owns nothing.
  There is a visible countdown and exactly one answer: carry the incorporation
  bylaw. Miss it and the stub is padlocked for four days, which takes the entire
  map with it. Dez has been trying to warn you; it is in her monologue.

**Day.** Two actions. Call on somebody (+trust with their whole constituency,
and you hear what they say they want), spend a monologue token (three a run, and
you hear what they actually want), walk a site, or get up on a roof and re-aim a
link that went down.

A link motion mounts whatever bare roofs it needs, so there is no way to end up
holding a node that no later vote will connect, and every build that carries
visibly moves the coverage number.

**Evening.** You bring exactly one motion, and forty-eight households vote on
it.

## The assembly

The neighbourhood does not vote as six minds. It votes as four blocs, and
**bloc membership is computed from the map rather than authored**:

| bloc | who they are | what they want |
|---|---|---|
| the dark | own a site the network does not reach | building, any building, and they resent money spent on upkeep |
| the connected | own a site it does reach | what exists to work, and not to pay for anybody else's roof |
| the clinic and the annex | speak for the sites people depend on | those up, whatever it costs |
| the renters | own no roof, pay dues anyway | rules and precedent |

This is the load-bearing idea. Connect the south block and those households
*leave* the bloc that wants expansion and join the one that resents paying for
it. Your own successes continuously rebuild the coalition that votes on you, and
by day fifteen the people who elected you to build are outnumbered by the people
you already built for.

Each constituency returns a **split, not a verdict**:

```
score  = blocInterest + ownStake + 0.8 × trust + grudge + quirk
share  = clamp(0.5 + 0.07 × score + noise, 0, 1)
votes  = round(households × share)
```

A decisive motion carries a bloc nearly whole; a marginal one visibly divides
it. Noise averages out over forty-odd votes instead of deciding six, so
outcomes are earned and margins are where the drama is.

`ownStake` is derived from the graph, never authored per motion: your roof, your
power, your bandwidth, measured against what the motion actually gets you. A
grudge against whoever it helps is −1.5.

**You never see a predicted vote.** You see the assembly: how big each bloc is
right now and what it structurally wants. Reading that is the skill. Afterwards
the minutes publish the breakdown — *the dark 12-6 for; the connected 5-9
against* — which is the answer to "why did that fail".

Standings are shown in words, never numbers: hostile, cold, wary, neutral,
civil, warm, staunch. A named figure is the face of a constituency, so a day
spent on Hollis moves twelve households and a day spent on Terrence moves two.
Household counts are public; that trade is meant to be obvious.

If your motion fails, somebody has an alternative. The highest-scoring one gets
a vote immediately, and if it carries, you are the one who goes and builds it.
That is where "playing out a decision you opposed" happens mechanically rather
than narratively.

## Winning, and the two ways of half-winning

Coverage is the fraction of the ten sites the uplink can reach through active
links. Cohesion is mean trust across the neighbourhood, weighted by households —
so the big constituencies decide it. The run ends on day 20, or when the co-op
forks with more than 40% of the map.

| | |
|---|---|
| **Win** | coverage ≥ 80% and cohesion ≥ 0.6 |
| **Partial** | you built a network and burned the community |
| **Partial** | you kept the community and did not build enough |
| **Lose** | the co-op forks, or coverage < 50% |

The dual condition is the thesis: infrastructure and social fabric are the same
resource pool.

## Reading the room, measured

`npm run sim` plays many seeded runs with four scripted delegates and prints the
spread. Over 200 runs each:

| | win | built, burned | kept, unbuilt | dark | forked | carried |
|---|---|---|---|---|---|---|
| works the big rooms | 72% | 0% | 28% | 0% | 0% | 61% |
| spreads attention thin | 12% | 56% | 32% | 0% | 0% | 60% |
| ignores the assembly | 0% | 51% | 49% | 0% | 0% | 45% |
| never talks to anyone | 0% | 4% | 10% | 75% | 13% | 15% |

The first two bots differ in exactly one thing: whether they concentrate their
days on the constituencies that carry the most households or spread them evenly.
That single choice is the difference between winning most runs and winning one
in eight, which is the lesson the game is trying to teach.

Both can see the assembly's leanings, which you cannot, so treat 72% as a
ceiling rather than a par. The number that matters for the thesis is 61%: two
motions in five fail for a competent delegate, putting the counterproposal
mechanic on screen seven or eight times a run. Mean margin is 9 votes of 48, and
tight runs go to the wire — the bulldozer's contested votes land inside four
votes half the time.

## Shape of the code

Every turn is `state -> state`. The whole game is one JSON object and a pure
reducer over a seeded mulberry32 whose cursor lives *in* the state, so a seed
plus a list of actions reproduces a run exactly. There is a test for that.

```
src/game/
  types.ts        the shape of the world
  content.ts      the entire neighbourhood - rewrite this file, get a new one
  rng.ts          mulberry32, split so the cursor can live in state
  graph.ts        reachability, coverage, cohesion, blocs, reliability
  proposals.ts    generates the menu and the counterproposals, from the graph
  vote.ts         bloc interests and the fractional vote above
  events.ts       the event deck and how a fork resolves
  reducer.ts      state -> state
  outcome.ts      endings and epilogues
  sim.ts          the tuning harness behind that table
src/ui/           three panes, plain SVG map, hand-placed coordinates
```

The mesh topology and the social graph are one data structure: sites are nodes,
people own sites, and a motion's politics fall out of the topology. That is what
makes counterproposals possible at all — the assembly can score an alternative
nobody wrote down in advance.

All the authored content is in `content.ts`: ten sites, ten constituencies
totalling 48 households, four grudges, a six-card deck, five bylaws. Which bloc
anybody is in at any moment is computed, not written down. Two people have a
true motivation that inverts how you would approach them. The water tower lady
says the co-op's hardware is an eyesore; what actually happened is that in '31
they bolted a repeater to her roof while she was at her sister's funeral, and
nobody asked. Name her as a stakeholder in a motion and she will hand you the
tower.

## The questions this is meant to answer

Still open. They are the reason to play it rather than read it.

1. Is two actions a day plus one motion a night the right pacing, or does it
   need a planning phase?
2. Do monologue tokens matter, or does trust-grinding dominate? Visits halve in
   value each time (`DIMINISHING_VISITS` in `content.ts` turns that off) and
   trust decays 7% a day, so trust is a flow rather than a stock. A token now
   buys a lever on a whole constituency rather than on one vote, which should be
   enough — but that is a question for a person playing.
3. Does the counterproposal mechanic produce "I lost and it's interesting" or
   "I lost and I'm annoyed"? This is the whole bet, and the bloc breakdown in
   the minutes is the current answer to the second half of it.
4. New: is four blocs the right number? The thesis is that a body of forty-eight
   is legible in a way six psychologies were not, because you read forces rather
   than guessing at minds. Whether the reshaping coalition reads as *political*
   or merely as a difficulty curve is the thing to watch for.
