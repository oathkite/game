import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Profile } from "@/app/profile";
import { GameCanvas } from "@/game/GameCanvas";
import { computeLayout } from "@/game/scale";
import type { MatchStore } from "@/match/matchStore";
import { LeftPanel } from "./LeftPanel";
import { OptionsMenu } from "./OptionsMenu";
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
  readonly profile: Profile;
  readonly onProfileChange: (profile: Profile) => void;
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

export const GameScreen = ({ store, clockOffset, profile, onProfileChange, onSurrender, onLeave }: Props) => {
  const view = useSyncExternalStore(store.subscribe, store.getView, store.getView);
  const { w, h } = useViewport();
  const layout = useMemo(() => computeLayout(w, h), [w, h]);
  const acting = view.phase === "acting" && view.control !== null;
  const [optionsOpen, setOptionsOpen] = useState(false);

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

  // 左右を入れ替えても同じ要素を動かすだけにするため key を付ける。マップ（PixiJS）を作り直さない
  const left = <LeftPanel key="left" view={view} store={store} width={layout.panelWidth} height={h} cell={layout.panelCell} holds={holds} />;
  const right = <RightPanel key="right" width={layout.panelWidth} height={h} enabled={acting} gauge={gauge} onOpenOptions={() => setOptionsOpen(true)} />;
  // 離脱は設定メニューの中に置く。対戦中は降参、観戦なら退出。決着後は要らない
  const exitLabel = view.spectator ? "退出する" : view.phase === "finished" ? null : "降参する";
  const onExit = (): void => {
    setOptionsOpen(false);
    if (view.spectator) onLeave();
    else onSurrender();
  };
  const myTurn = view.mySeat !== null && view.currentSeat === view.mySeat && !view.spectator;
  const swapPanels = profile.swapPanels;

  return (
    <div className="game-root" onContextMenu={(e) => e.preventDefault()}>
      {swapPanels ? right : left}
      <div className="map-area" key="map">
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
        {optionsOpen && (
          <OptionsMenu profile={profile} onProfileChange={onProfileChange} exitLabel={exitLabel} onExit={onExit} onClose={() => setOptionsOpen(false)} />
        )}
      </div>
      {swapPanels ? left : right}
    </div>
  );
};
