// The assembly, grouped the way it actually divides. This panel is the
// instrument the whole redesign exists for: you should be able to look at it
// and know why tonight's motion is going to be hard, without ever being shown
// a prediction. Bloc membership is computed from the map, so this regroups
// itself every time you connect somebody.

import { assembly, bloc, households } from "../game/graph";
import type { Bloc, GameState, NPC } from "../game/types";
import { BLOC_LABEL, BLOC_WANT, trustWord } from "./words";

const ORDER: Bloc[] = ["connected", "dark", "essential", "renters"];

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
  const sizes = assembly(state);
  const total = households(state);
  const chosen = state.npcs.find((n) => n.id === selected);
  const byBloc = (b: Bloc) =>
    state.npcs
      .filter((n) => n.households > 0 && bloc(state, n) === b)
      .sort((a, b2) => b2.households - a.households || a.name.localeCompare(b2.name));

  return (
    <div className="neighbour-roll">
      <table>
        <caption>
          The assembly · {total} households
        </caption>
        <tbody>
          {ORDER.map((b) => {
            const rows = byBloc(b);
            if (rows.length === 0) return null;
            return (
              <BlocRows
                key={b}
                b={b}
                rows={rows}
                size={sizes[b]}
                total={total}
                selected={selected}
                onSelect={onSelect}
              />
            );
          })}
        </tbody>
      </table>

      {chosen && (
        <div className="dossier">
          <h2>{chosen.name}</h2>
          <p className="mono quiet">
            speaks for {chosen.households} household{chosen.households === 1 ? "" : "s"} ·{" "}
            {BLOC_LABEL[bloc(state, chosen)]}
          </p>
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

function BlocRows({
  b,
  rows,
  size,
  total,
  selected,
  onSelect,
}: {
  b: Bloc;
  rows: NPC[];
  size: number;
  total: number;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <tr className="bloc-head">
        <td colSpan={2}>
          {BLOC_LABEL[b]} · {size} of {total}
          <br />
          <span className="bloc-want">{BLOC_WANT[b]}</span>
        </td>
      </tr>
      {rows.map((n) => (
        <tr
          key={n.id}
          className={selected === n.id ? "chosen" : undefined}
          onClick={() => onSelect(n.id)}
        >
          <td>
            {n.name}
            <br />
            <span className="seat">{n.households} households</span>
          </td>
          <td className="standing">{trustWord(n.trust)}</td>
        </tr>
      ))}
    </>
  );
}
