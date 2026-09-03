import type { Facing } from "@game/protocol";
import { STEPS_PER_TURN, tiltOf } from "@game/sim";
import type { MatchStore } from "@/match/matchStore";
import type { MatchView } from "@/match/types";
import { AngleGauge, fireAngleLabel } from "./AngleGauge";
import { holdHandlers, type Hold } from "./useHold";
import { WindWindow } from "./WindWindow";

// 左パネル。設計書 03 の 3.2。上端に風の小窓、下端に角度計、発射角、傾きと仰角、残り歩数、十字キー。

type Props = {
  readonly view: MatchView;
  readonly store: MatchStore;
  readonly width: number;
  readonly cell: number;
  readonly holds: { readonly up: Hold; readonly down: Hold; readonly left: Hold; readonly right: Hold };
};

const Arrow = ({ dir }: { dir: "up" | "down" | "left" | "right" }) => {
  const d = { up: "M 4 12 L 8 4 L 12 12 Z", down: "M 4 4 L 8 12 L 12 4 Z", left: "M 12 4 L 4 8 L 12 12 Z", right: "M 4 4 L 12 8 L 4 12 Z" }[dir];
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" shapeRendering="crispEdges">
      <path d={d} fill="currentColor" />
    </svg>
  );
};

export const LeftPanel = ({ view, store, width, cell, holds }: Props) => {
  const acting = view.phase === "acting" && view.control !== null;
  const control = view.control;
  const mask = view.mask;
  const me = view.mySeat !== null && view.players ? view.players[view.mySeat] : null;
  const x = control ? control.x : me?.x ?? 0;
  const facing: Facing = control ? control.facing : me?.facing ?? 1;
  const elevation = control ? control.elevation : 45;
  const tilt = mask ? tiltOf(mask, x) : 0;
  const stepsLeft = control ? control.stepsLeft : STEPS_PER_TURN;
  const gaugeSize = Math.min(width - 8, 22 * cell);
  const btn = Math.floor((width - 8) / 3);
  const canLeft = store.canStep(-1);
  const canRight = store.canStep(1);

  return (
    <div className="panel" style={{ width, padding: 4 }}>
      <WindWindow wind={view.wind.value} cell={cell} />
      <div className="panel-bottom">
        <AngleGauge size={gaugeSize} tilt={tilt} elevation={elevation} facing={facing} />
        <div style={{ fontSize: 32, fontVariantNumeric: "tabular-nums" }} data-testid="fire-angle">
          {fireAngleLabel(tilt, elevation, facing)}
        </div>
        <div className="dim" style={{ fontSize: 16 }}>
          {tilt > 0 ? `+${tilt}` : tilt} / {elevation}
        </div>
        <div className="steps" data-testid="steps" style={{ height: cell }}>
          {Array.from({ length: STEPS_PER_TURN }, (_, i) => (
            <span key={i} style={{ width: cell, height: cell, background: i < stepsLeft ? "var(--ui)" : "var(--ui-dim)" }} />
          ))}
        </div>
        <div className="dpad" style={{ gridAutoRows: btn, gridTemplateColumns: `repeat(3, ${btn}px)` }}>
          <span />
          <button type="button" className={holds.up.held ? "held" : ""} disabled={!acting} aria-label="up" {...holdHandlers(holds.up)}>
            <Arrow dir="up" />
          </button>
          <span />
          <button
            type="button"
            className={holds.left.held ? "held" : ""}
            disabled={!acting}
            aria-label="left"
            style={!canLeft && acting ? { color: "var(--ui-dim)" } : undefined}
            {...holdHandlers(holds.left)}
          >
            <Arrow dir="left" />
          </button>
          <span />
          <button
            type="button"
            className={holds.right.held ? "held" : ""}
            disabled={!acting}
            aria-label="right"
            style={!canRight && acting ? { color: "var(--ui-dim)" } : undefined}
            {...holdHandlers(holds.right)}
          >
            <Arrow dir="right" />
          </button>
          <span />
          <button type="button" className={holds.down.held ? "held" : ""} disabled={!acting} aria-label="down" {...holdHandlers(holds.down)}>
            <Arrow dir="down" />
          </button>
          <span />
        </div>
      </div>
    </div>
  );
};
