import { useEffect, useSyncExternalStore } from "react";
import type { MatchStore } from "@/match/matchStore";
import type { MatchView } from "@/match/types";
import { findRobustAim, type Aim } from "@/dev/aim";
import { GameScreen } from "@/ui/GameScreen";
import { ResultScreen } from "./ResultScreen";

// 対戦画面とリザルトの切り替え。solo とオンラインで共有する。

type Props = {
  readonly store: MatchStore;
  readonly clockOffset: number;
  readonly swapPanels: boolean;
  readonly closeLabel: string;
  readonly onClose: () => void;
  readonly onLeave: () => void;
};

declare global {
  interface Window {
    /** e2e テストと開発時の確認用。表示状態を読むだけで、進めることはできない */
    __fortress?: { readonly getView: () => MatchView; readonly store: MatchStore; readonly aim: () => Aim | null };
  }
}

export const MatchStage = ({ store, clockOffset, swapPanels, closeLabel, onClose, onLeave }: Props) => {
  const view = useSyncExternalStore(store.subscribe, store.getView, store.getView);
  useEffect(() => {
    window.__fortress = { getView: store.getView, store, aim: () => findRobustAim(store.getView()) };
    return () => {
      delete window.__fortress;
    };
  }, [store]);
  if (view.phase === "finished" && view.result && view.players) {
    return <ResultScreen result={view.result} players={view.players} onClose={onClose} closeLabel={closeLabel} onLeave={onLeave} />;
  }
  return <GameScreen store={store} clockOffset={clockOffset} swapPanels={swapPanels} onSurrender={() => store.surrender()} onLeave={onLeave} />;
};
