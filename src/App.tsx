import { useEffect, useReducer, useState } from "react";
import { CouncilPane } from "./ui/CouncilPane";
import { MapPane, SiteDetail } from "./ui/MapPane";
import { PeoplePane } from "./ui/PeoplePane";
import { assembly, cohesion, coverage, households } from "./game/graph";
import { initialState, reduce } from "./game/reducer";
import { TURNS } from "./game/content";
import type { GameState } from "./game/types";
import { trustWord, weatherWord } from "./ui/words";
import "./ui/styles.css";

const SAVE_KEY = "delegate.run";

function seedFromUrl(): number {
  const raw = new URLSearchParams(location.hash.slice(1)).get("seed");
  const n = raw ? Number.parseInt(raw, 36) : NaN;
  return Number.isFinite(n) && raw ? n >>> 0 : (Math.random() * 2 ** 32) >>> 0;
}

function load(seed: number): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as GameState;
      if (saved.seed === seed && saved.sites?.length) return saved;
    }
  } catch {
    // A corrupt or absent save is not worth a word to the player.
  }
  return initialState(seed);
}

export function App() {
  const [seed, setSeed] = useState(seedFromUrl);
  const [state, dispatch] = useReducer(reduce, seed, load);
  const [site, setSite] = useState<string | null>(null);
  const [person, setPerson] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    location.hash = `seed=${seed.toString(36)}`;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch {
      // Out of quota or a private window. The run still plays.
    }
  }, [state, seed]);

  const restart = (next: number) => {
    localStorage.removeItem(SAVE_KEY);
    setSeed(next);
    location.hash = `seed=${next.toString(36)}`;
    location.reload();
  };

  const canAct = state.phase === "day" && state.actionsLeft > 0;
  const cov = Math.round(coverage(state) * 100);
  const room = trustWord(cohesion(state));
  const sizes = assembly(state);

  return (
    <>
      <div className="day-strip">
        <h1>DELEGATE</h1>
        <span className="measure">
          day <b>{Math.max(state.turn, 1)}</b>/{TURNS}
        </span>
        <span className="measure">{weatherWord(state.weather)}</span>
        <span className="measure">
          coverage <b>{cov}%</b>
        </span>
        <span className="measure">
          the room reads <b>{room}</b>
        </span>
        <span className="measure">
          {households(state)} households · <b>{sizes.dark}</b> dark · <b>{sizes.connected}</b> connected
        </span>
        <span className="measure">
          fund <b>{state.budget}</b>
        </span>
        <span className="measure">
          actions <b>{state.actionsLeft}</b> · tokens <b>{state.tokens}</b>
        </span>
        {state.flags.stormEta !== null && (
          <span className="measure storm-warning">storm expected day {state.flags.stormEta}</span>
        )}
        {state.flags.landlord !== null && (
          <span className="measure storm-warning">
            the stub goes day {state.flags.landlord.deadline}
          </span>
        )}
        {state.flags.seizedUntil !== null && (
          <span className="measure seized">STUB SEIZED until day {state.flags.seizedUntil}</span>
        )}
      </div>

      <div className="delegate-hall">
        <div>
          <MapPane state={state} selected={site} onSelect={setSite} />
          <SiteDetail
            state={state}
            siteId={site}
            canAct={canAct}
            onScout={(id) => dispatch({ type: "ACT", action: { type: "SCOUT", siteId: id } })}
            onRepair={(id) => dispatch({ type: "ACT", action: { type: "REPAIR", linkId: id } })}
          />
          <div className="colophon">
            <span>
              seed {seed.toString(36)} · delegate 0.1.0 · {state.log.length} entries in the minutes
            </span>
            <input
              aria-label="seed for a new run"
              value={draft}
              placeholder="new seed"
              onChange={(e) => setDraft(e.target.value)}
              size={10}
            />
            <button
              onClick={() =>
                restart(draft.trim() ? Number.parseInt(draft.trim(), 36) >>> 0 : (Math.random() * 2 ** 32) >>> 0)
              }
            >
              new run
            </button>
          </div>
        </div>

        <PeoplePane
          state={state}
          selected={person}
          onSelect={setPerson}
          canAct={canAct}
          onVisit={(id) => dispatch({ type: "ACT", action: { type: "VISIT", npcId: id } })}
          onMonologue={(id) => dispatch({ type: "ACT", action: { type: "MONOLOGUE", npcId: id } })}
        />

        <CouncilPane
          state={state}
          onOpenDay={() => dispatch({ type: "OPEN_DAY" })}
          onConvene={() => dispatch({ type: "CONVENE" })}
          onPropose={(id) => dispatch({ type: "PROPOSE", proposalId: id })}
          onAbstain={() => dispatch({ type: "ABSTAIN" })}
          onAcceptCounter={() => dispatch({ type: "ACCEPT_COUNTER" })}
          onRestart={() => restart((Math.random() * 2 ** 32) >>> 0)}
        />
      </div>
    </>
  );
}
