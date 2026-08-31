// Plain SVG, coordinates placed by hand in content.ts. Link kind is carried by
// stroke texture rather than colour, so the map survives being photocopied and
// so the two hues stay reserved for state.

import { activeLinks, linkId, reachable } from "../game/graph";
import type { GameState, Site } from "../game/types";
import { kindWord, powerWord } from "./words";

const DASH = { fso: undefined, lora: "7 5", cable: undefined } as const;
const WIDTH = { fso: 2, lora: 2, cable: 5 } as const;

function WeatherTexture({ weather }: { weather: GameState["weather"] }) {
  if (weather === "clear") return null;
  const id = `weather-${weather}`;
  return (
    <>
      <defs>
        <pattern id={id} width="10" height="10" patternUnits="userSpaceOnUse">
          {weather === "fog" && <circle cx="3" cy="3" r="1.1" fill="#c9c9c9" />}
          {weather === "rain" && <path d="M0 10 L10 0" stroke="#d4d4d4" strokeWidth="1" />}
          {weather === "storm" && (
            <path d="M0 10 L10 0 M0 0 L10 10" stroke="#bdbdbd" strokeWidth="1.2" />
          )}
        </pattern>
      </defs>
      <rect x="0" y="0" width="700" height="600" fill={`url(#${id})`} pointerEvents="none" />
    </>
  );
}

export function MapPane({
  state,
  selected,
  onSelect,
}: {
  state: GameState;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const up = reachable(state);
  const built = activeLinks(state);
  const down = state.links.filter((l) => l.status === "down");
  const at = (id: string) => state.sites.find((s) => s.id === id) as Site;

  return (
    <div>
      <svg className="mesh-map" viewBox="46 70 588 472" role="img" aria-label="the neighbourhood mesh">
        <WeatherTexture weather={state.weather} />

        {/* What the terrain would allow, once you have walked both ends. */}
        {state.feasible
          .filter(
            (f) =>
              state.scouted.includes(f.from) &&
              state.scouted.includes(f.to) &&
              !state.links.some((l) => l.id === linkId(f.from, f.to)),
          )
          .map((f) => (
            <line
              key={`t-${f.from}-${f.to}`}
              className="terrain"
              x1={at(f.from).x}
              y1={at(f.from).y}
              x2={at(f.to).x}
              y2={at(f.to).y}
            />
          ))}

        {[...built, ...down].map((l) => (
          <line
            key={l.id}
            className={`span ${l.status}`}
            x1={at(l.from).x}
            y1={at(l.from).y}
            x2={at(l.to).x}
            y2={at(l.to).y}
            strokeWidth={WIDTH[l.kind]}
            strokeDasharray={l.status === "down" ? "3 4" : DASH[l.kind]}
          />
        ))}

        {state.sites.map((s) => {
          const gone = state.seceded.includes(s.id);
          const lit = up.has(s.id);
          const common = {
            fill: lit ? "var(--ink)" : "var(--paper)",
            stroke: gone ? "var(--muted)" : "var(--ink)",
            strokeWidth: 2,
            // A hollow outline means there is no co-op equipment on that roof.
            strokeDasharray: s.hasNode ? undefined : "3 3",
          };
          return (
            <g
              key={s.id}
              className="site-marker"
              onClick={() => onSelect(s.id)}
              aria-label={s.name}
            >
              {/* The dot and its label are one target; nobody wants to hit an 8px circle. */}
              <rect x={s.x - 34} y={s.y - 16} width={68} height={48} fill="transparent" />
              {selected === s.id && <circle className="selected" cx={s.x} cy={s.y} r={14} />}
              {s.uplink ? (
                <rect x={s.x - 8} y={s.y - 8} width={16} height={16} {...common} />
              ) : (
                <circle cx={s.x} cy={s.y} r={8} {...common} />
              )}
              <text
                className={`site-label ${lit ? "" : "dark"}`}
                x={s.x}
                y={s.y + 26}
                textAnchor="middle"
              >
                {gone ? `${s.short} (gone)` : s.short}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="map-legend">
        <span>■ uplink</span>
        <span>● on the network</span>
        <span>○ dark</span>
        <span>dotted outline = no equipment</span>
        <span>── optical</span>
        <span>–– LoRa</span>
        <span>━━ cable</span>
        <span>red = down</span>
      </div>
    </div>
  );
}

export function SiteDetail({
  state,
  siteId,
  canAct,
  onScout,
  onRepair,
}: {
  state: GameState;
  siteId: string | null;
  canAct: boolean;
  onScout: (id: string) => void;
  onRepair: (id: string) => void;
}) {
  if (!siteId) {
    return (
      <div className="site-detail quiet">
        <p>Click a roof to see who owns it and what the terrain allows from there.</p>
      </div>
    );
  }
  const s = state.sites.find((x) => x.id === siteId);
  if (!s) return null;
  const holder = state.npcs.find((n) => n.id === s.owner);
  const walked = state.scouted.includes(s.id);
  const links = state.links.filter((l) => l.from === s.id || l.to === s.id);
  const terrain = state.feasible.filter((f) => f.from === s.id || f.to === s.id);
  const other = (f: { from: string; to: string }) =>
    state.sites.find((x) => x.id === (f.from === s.id ? f.to : f.from))?.short ?? "";

  return (
    <div className="site-detail">
      <h2>{s.name}</h2>
      <dl>
        <dt>owner</dt>
        <dd>{holder?.name ?? s.owner}</dd>
        <dt>power</dt>
        <dd>{powerWord(s.power)}</dd>
        <dt>elevation</dt>
        <dd>{"███".slice(0, s.elevation) + "···".slice(s.elevation)} ({s.elevation} of 3)</dd>
        <dt>equipment</dt>
        <dd>{s.hasNode ? (s.hardened ? "node, hardened" : "node") : "none"}</dd>
        <dt>links</dt>
        <dd>
          {links.length === 0
            ? "none"
            : links
                .map((l) => `${other(l)} · ${kindWord(l.kind)} · ${l.status} ${l.reliability.toFixed(2)}`)
                .join(" / ")}
        </dd>
      </dl>
      {walked ? (
        <>
          <p>{s.note}</p>
          <p className="mono quiet">
            terrain allows: {terrain.map((f) => `${other(f)} (${kindWord(f.kind)})`).join(", ") || "nothing from here"}
          </p>
        </>
      ) : (
        <p className="unwalked">
          Nobody has walked this one. Spend a day on it and you will know what it can reach.
        </p>
      )}
      <p>
        <button disabled={!canAct || walked} onClick={() => onScout(s.id)}>
          Walk the site
        </button>{" "}
        {links
          .filter((l) => l.status === "down")
          .map((l) => (
            <button key={l.id} disabled={!canAct} onClick={() => onRepair(l.id)}>
              Get on a roof and re-aim {other(l)}
            </button>
          ))}
      </p>
    </div>
  );
}
