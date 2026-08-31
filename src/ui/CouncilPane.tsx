// The minutes read like minutes. Vote breakdowns appear here after the fact
// and never before it.

import { useEffect, useRef } from "react";
import { availableProposals } from "../game/proposals";
import { endingTitle } from "../game/outcome";
import type { GameState, Proposal, VoteResult } from "../game/types";

const GROUPS: { kind: Proposal["kind"]; heading: string }[] = [
  { kind: "build-link", heading: "string a link" },
  { kind: "mount-node", heading: "mount equipment" },
  { kind: "harden", heading: "spend the fund" },
  { kind: "raise-dues", heading: "the fund itself" },
  { kind: "bylaw", heading: "change a bylaw" },
];

function Tally({ state, vote, heading }: { state: GameState; vote: VoteResult; heading: string }) {
  const name = (id: string) => state.npcs.find((n) => n.id === id)?.name ?? id;
  return (
    <>
      <h3>{heading}</h3>
      <table className="tally">
        <tbody>
          {vote.ballots.map((b) => (
            <tr key={b.npcId}>
              <td>{name(b.npcId)}</td>
              <td className={b.yes ? "aye" : "nay"}>{b.yes ? "aye" : "no"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function CouncilPane({
  state,
  onOpenDay,
  onConvene,
  onPropose,
  onAbstain,
  onAcceptCounter,
  onRestart,
}: {
  state: GameState;
  onOpenDay: () => void;
  onConvene: () => void;
  onPropose: (id: string) => void;
  onAbstain: () => void;
  onAcceptCounter: () => void;
  onRestart: () => void;
}) {
  const tail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    tail.current?.scrollIntoView({ block: "end" });
  }, [state.log.length]);

  const menu = state.phase === "council" ? availableProposals(state) : [];

  return (
    <div className="council-minutes">
      <div className="minute-log">
        {state.log.map((e, i) => (
          <div key={i} className={`entry ${e.kind} ${e.tone ?? ""}`}>
            {e.kind === "ending" ? (
              <>
                <h2>{state.outcome ? endingTitle(state.outcome.ending) : "The run ends"}</h2>
                <p>{e.text}</p>
              </>
            ) : (
              e.text
            )}
          </div>
        ))}
        <div ref={tail} />
      </div>

      <div className="floor">
        {state.phase === "morning" && (
          <>
            {state.lastVote && (
              <Tally
                state={state}
                vote={state.lastVote}
                heading={`Last night: ${state.lastVote.passed ? "carried" : "not carried"}`}
              />
            )}
            <button onClick={onOpenDay}>Open day {state.turn + 1}</button>
          </>
        )}

        {state.phase === "day" && (
          <>
            <h2>Day {state.turn}</h2>
            <p className="quiet">
              {state.actionsLeft > 0
                ? `${state.actionsLeft} action${state.actionsLeft === 1 ? "" : "s"} left. Call on somebody, walk a site, or get up on a roof and fix something.`
                : "The day is spent."}
            </p>
            <button onClick={onConvene}>Convene the council</button>
          </>
        )}

        {state.phase === "council" && (
          <>
            <h2>You may bring one motion</h2>
            <div className="motion-picker">
            {GROUPS.map((g) => {
              const items = menu.filter((p) => p.kind === g.kind);
              if (items.length === 0) return null;
              return (
                <section key={g.kind}>
                  <div className="motion-group">{g.heading}</div>
                  <ul className="motion-list">
                    {items.map((p) => (
                      <li key={p.id}>
                        <span className="price">{p.cost > 0 ? `${p.cost}` : "\u2014"}</span>
                        <span className="motion-text">{p.motion}</span>
                        <button onClick={() => onPropose(p.id)}>move</button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
            </div>
            <button onClick={onAbstain}>Bring no motion tonight</button>
          </>
        )}

        {state.phase === "counter" && state.pendingCounter && (
          <>
            <Tally
              state={state}
              vote={state.pendingCounter}
              heading={
                state.pendingCounter.passed
                  ? "The amendment carried. You will be the one who builds it."
                  : "The amendment failed too."
              }
            />
            <button onClick={onAcceptCounter}>Enter it in the minutes</button>
          </>
        )}

        {state.phase === "over" && state.outcome && (
          <>
            <p className="mono quiet">
              coverage {Math.round(state.outcome.coverage * 100)}% · cohesion{" "}
              {state.outcome.cohesion.toFixed(2)} · {state.turn} days
            </p>
            <button onClick={onRestart}>Stand for election again</button>
          </>
        )}
      </div>
    </div>
  );
}
