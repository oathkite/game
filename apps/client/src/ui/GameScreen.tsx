import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { GameCanvas } from "@/game/GameCanvas";
import { computeLayout } from "@/game/scale";
import type { MatchStore } from "@/match/matchStore";
import { LeftPanel } from "./LeftPanel";
import { RightPanel } from "./RightPanel";
import { Timer } from "./Timer";
import { TurnBanner, TurnLabel } from "./TurnIndicator";
import { useHold } from "./useHold";
import { useKeyboardInput } from "./useKeyboardInput";
import { usePowerGauge } from "./usePowerGauge";
import { useSwipeAim } from "./useSwipeAim";

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
  // マップをなぞっても移動と仰角を変えられる。十字キーが押しにくい小さな画面のため
  const swipe = useSwipeAim(acting, { moveStep: store.moveStep, changeElevation: store.changeElevation });

  useKeyboardInput(holds, gauge);

  const left = <LeftPanel view={view} store={store} width={layout.panelWidth} height={h} cell={layout.panelCell} holds={holds} />;
  // 離脱のボタンは右パネルの上端に置く。対戦中は降参、観戦なら退出
  const exitLabel = view.spectator ? "退出" : view.phase === "finished" ? null : "降参";
  const onExit = view.spectator ? onLeave : () => setConfirmSurrender(true);
  const right = <RightPanel width={layout.panelWidth} height={h} enabled={acting} gauge={gauge} exitLabel={exitLabel} onExit={onExit} />;
  const myTurn = view.mySeat !== null && view.currentSeat === view.mySeat && !view.spectator;

  return (
    <div className="game-root" onContextMenu={(e) => e.preventDefault()}>
      {swapPanels ? right : left}
      <div className="map-area">
        <div className="map-frame" style={{ width: layout.mapWidth, height: layout.mapHeight }}>
          <div className="map-topline" />
          <div className="hud-top">
            <Timer deadlineAt={view.deadlineAt} clockOffset={clockOffset} myTurn={myTurn} />
            <TurnLabel view={view} />
          </div>
          <GameCanvas store={store} view={view} layout={layout} swipe={swipe} />
          <TurnBanner view={view} />
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
