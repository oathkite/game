import { useEffect, useSyncExternalStore } from "react";
import type { Profile } from "@/app/profile";
import type { MatchStore } from "@/match/matchStore";
import type { MatchView } from "@/match/types";
import { findRobustAim, type Aim } from "@/dev/aim";
import { GameScreen } from "@/ui/GameScreen";
import { ResultScreen } from "./ResultScreen";

// 対戦画面とリザルトの切り替え。solo とオンラインで共有する。

type Props = {
  readonly store: MatchStore;
  readonly clockOffset: number;
  readonly profile: Profile;
  readonly onProfileChange: (profile: Profile) => void;
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

export const MatchStage = ({ store, clockOffset, profile, onProfileChange, closeLabel, onClose, onLeave }: Props) => {
  const view = useSyncExternalStore(store.subscribe, store.getView, store.getView);
  // 開発と e2e のためのフック。本番ビルドでは置かない。照準の探索は相手に当たる撃ち方を教えるので、遊びに持ち込ませない
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__fortress = { getView: store.getView, store, aim: () => findRobustAim(store.getView()) };
    return () => {
      delete window.__fortress;
    };
  }, [store]);
  if (view.phase === "finished" && view.result && view.players) {
    return <ResultScreen result={view.result} players={view.players} onClose={onClose} closeLabel={closeLabel} onLeave={onLeave} />;
  }
  return (
    <GameScreen
      store={store}
      clockOffset={clockOffset}
      profile={profile}
      onProfileChange={onProfileChange}
      onSurrender={() => store.surrender()}
      onLeave={onLeave}
    />
  );
};
