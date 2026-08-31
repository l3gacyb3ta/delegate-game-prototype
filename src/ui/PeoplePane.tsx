// Standing is shown in words. There is no number here and there is no
// predicted vote anywhere in this application.

import type { GameState, NPC } from "../game/types";
import { trustWord } from "./words";

export function PeoplePane({
  state,
  selected,
  onSelect,
  canAct,
  onVisit,
  onMonologue,
}: {
  state: GameState;
  selected: string | null;
  onSelect: (id: string) => void;
  canAct: boolean;
  onVisit: (id: string) => void;
  onMonologue: (id: string) => void;
}) {
  const seats = (n: NPC) => (n.councilMember ? "council" : "");
  const roll = [...state.npcs].sort(
    (a, b) => Number(b.councilMember) - Number(a.councilMember) || a.name.localeCompare(b.name),
  );
  const chosen = state.npcs.find((n) => n.id === selected);

  return (
    <div className="neighbour-roll">
      <table>
        <caption>The neighbourhood</caption>
        <tbody>
          {roll.map((n) => (
            <tr
              key={n.id}
              className={selected === n.id ? "chosen" : undefined}
              onClick={() => onSelect(n.id)}
            >
              <td>
                {n.name}
                <br />
                <span className="seat">{seats(n)}</span>
              </td>
              <td className="standing">
                {trustWord(n.trust)}
                {state.revealed.includes(n.id) ? <><br />read</> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {chosen && (
        <div className="dossier">
          <h2>{chosen.name}</h2>
          <p className="said">"{chosen.publicPosition}"</p>
          {state.revealed.includes(chosen.id) ? (
            <p className="heard">{chosen.trueMotivation}</p>
          ) : (
            <p className="unheard">
              What they actually want, you do not know. That costs a monologue token, and you have{" "}
              {state.tokens}.
            </p>
          )}
          <p>
            <button disabled={!canAct} onClick={() => onVisit(chosen.id)}>
              Call on them
            </button>{" "}
            <button
              disabled={!canAct || state.tokens <= 0 || state.revealed.includes(chosen.id)}
              onClick={() => onMonologue(chosen.id)}
            >
              Stay until the room empties
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
