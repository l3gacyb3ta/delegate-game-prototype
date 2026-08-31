# Playtest brief

> **Handing this over:** give the other model `play.mjs` and this file, and say
> *"read PLAYTEST.md and do what it says."* Nothing else. The single file is
> self-contained — it needs Node and no install, no clone, no build. If you can,
> put it in an empty directory on its own; the point of the exercise is spoiled
> by reading the repository.
>
> When it is done, `.delegate-transcript.md` in that directory is a full record
> of what it actually did, so you can check its report against its play.

---

You are about to play a prototype of a strategy game. Nobody is going to tell
you whether you played it well. What we want is your honest opinion of whether
it is any good.

## The situation

The second flood took the last of the internet providers with it. What the
neighbourhood has now is a co-operative: a fibre stub in the back of a derelict
theatre, some second-hand radios, and permission to bolt equipment to whatever
roofs people will lend. You have just been elected its delegate.

You do not run it. You propose, the neighbourhood votes, and you carry out
whatever passes — including the things you argued against. You have twenty days.

## How to play

```
node play.mjs help
node play.mjs new
```

The game explains itself from there. Every command prints what you can do next.
There is nothing to install and nothing to configure.

## Rules of the exercise

1. **Play blind.** Do not read the source, do not read `README.md`, do not grep
   or open `play.mjs`. The whole question is whether the game teaches itself, and
   you can only answer that once. We cannot stop you looking; we are asking you
   not to.
2. **Play at least two full runs, on different seeds.** `node play.mjs new
   <word>` — any word works as a seed and the same seed always plays the same.
3. **Play the second run differently on purpose.** Not better, differently. If
   the first run was cautious, be reckless.
4. Write your impressions *before* you read anything else.

## What to tell us

Prose, not a rubric. Say what you actually thought, including if the answer is
that it was boring. Four things we specifically want:

1. **When a motion of yours failed, did you understand why?** And did it land as
   *you misjudged the room* or as *the game rolled a die at you*? This is the
   one we care about most.
2. **Was there a moment you were surprised** — where you changed your mind about
   somebody, or where something you did turned out to mean more than you thought?
   If there wasn't, say so; that is the more useful answer.
3. **When you were made to carry out a decision you had argued against, how did
   that feel?** Interesting, or annoying? Be specific about which and why.
4. **Would you play a third run?** If yes, what would you be trying to do
   differently, and did the game give you that idea or did you have to invent it?

Anything else you noticed is welcome — pacing, whether twenty days is the right
length, whether the writing is doing work or getting in the way, whether you
ever felt you had nothing meaningful to choose between.

## Then, and only then

Read `README.md` if you have it, and tell us where the game it describes and the
game you played came apart. That gap is the most valuable thing you can give us,
and it only works if you write your own impressions first.
