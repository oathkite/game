import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { GameCanvas } from "@/game/GameCanvas";
import { computeLayout } from "@/game/scale";
import type { MatchStore } from "@/match/matchStore";
import { LeftPanel } from "./LeftPanel";
import { RightPanel } from "./RightPanel";
import { Timer } from "./Timer";
import { useHold } from "./useHold";
import { usePowerGauge } from "./usePowerGauge";

// 対戦画面。設計書 03 の 3.2 のレイアウト。左右のパネルと中央のマップ領域。

type Props = {
  readonly store: MatchStore;
  readonly clockOffset: number;
  readonly swapPanels: boolean;
  readonly onSurrender: () => void;
  readonly onLeave: () => void;
};

const useViewport = () => {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const onResize = (): void => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return size;
};

export const GameScreen = ({ store, clockOffset, swapPanels, onSurrender, onLeave }: Props) => {
  const view = useSyncExternalStore(store.subscribe, store.getView, store.getView);
  const { w, h } = useViewport();
  const layout = useMemo(() => computeLayout(w, h), [w, h]);
  const acting = view.phase === "acting" && view.control !== null;
  const [confirmSurrender, setConfirmSurrender] = useState(false);

  const holds = {
    up: useHold(() => store.changeElevation(1), 50, acting),
    down: useHold(() => store.changeElevation(-1), 50, acting),
    left: useHold(() => store.moveStep(-1), 80, acting),
    right: useHold(() => store.moveStep(1), 80, acting),
  };
  const gauge = usePowerGauge(acting, (power) => store.fire(power));

  // キーボード。keydown で開始、keyup で停止。オートリピートの keydown は無視する（設計書 03 の 3.3）
  useEffect(() => {
    const down = (e: KeyboardEvent): void => {
      if (e.repeat) return;
      if (e.target instanceof HTMLInputElement) return;
      switch (e.code) {
        case "ArrowUp":
          holds.up.start();
          break;
        case "ArrowDown":
          holds.down.start();
          break;
        case "ArrowLeft":
          holds.left.start();
          break;
        case "ArrowRight":
          holds.right.start();
          break;
        case "Space":
          gauge.begin("key");
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    const up = (e: KeyboardEvent): void => {
      switch (e.code) {
        case "ArrowUp":
          holds.up.stop();
          break;
        case "ArrowDown":
          holds.down.stop();
          break;
        case "ArrowLeft":
          holds.left.stop();
          break;
        case "ArrowRight":
          holds.right.stop();
          break;
        case "Space":
          gauge.release("key");
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [holds.up, holds.down, holds.left, holds.right, gauge]);

  const left = <LeftPanel view={view} store={store} width={layout.panelWidth} cell={layout.cell} holds={holds} />;
  const right = <RightPanel width={layout.panelWidth} height={h} enabled={acting} gauge={gauge} />;
  const myTurn = view.mySeat !== null && view.currentSeat === view.mySeat && !view.spectator;

  return (
    <div className="game-root" onContextMenu={(e) => e.preventDefault()}>
      {swapPanels ? right : left}
      <div className="map-area">
        <div className="map-frame" style={{ width: layout.mapWidth, height: layout.mapHeight }}>
          <div className="map-topline" />
          <Timer deadlineAt={view.deadlineAt} clockOffset={clockOffset} myTurn={myTurn} />
          <GameCanvas store={store} view={view} layout={layout} />
          {view.opponentDisconnectedUntil !== null && (
            <div className="overlay">
              <div className="box">相手の再接続を待っています</div>
            </div>
          )}
          {view.phase === "loading" && (
            <div className="overlay">
              <div className="dim">LOADING</div>
            </div>
          )}
        </div>
        {!view.spectator && view.phase !== "finished" && (
          <button
            type="button"
            style={{ position: "absolute", right: 8, bottom: 8, padding: "4px 8px", fontSize: 16, borderColor: "var(--ui-dim)", color: "var(--ui-dim)" }}
            onClick={() => setConfirmSurrender(true)}
          >
            降参
          </button>
        )}
        {view.spectator && (
          <button type="button" style={{ position: "absolute", right: 8, bottom: 8, padding: "4px 8px", fontSize: 16 }} onClick={onLeave}>
            退出
          </button>
        )}
        {confirmSurrender && (
          <div className="overlay">
            <div className="box column" style={{ width: 320 }}>
              <div>降参しますか</div>
              <div className="row">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmSurrender(false);
                    onSurrender();
                  }}
                >
                  降参する
                </button>
                <button type="button" onClick={() => setConfirmSurrender(false)}>
                  戻る
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {swapPanels ? left : right}
    </div>
  );
};
