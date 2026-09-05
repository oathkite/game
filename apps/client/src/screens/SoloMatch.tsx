import type { MapName } from "@game/protocol";
import { useEffect, useState } from "react";
import type { Profile } from "@/app/profile";
import { createMatchStore, type MatchStore } from "@/match/matchStore";
import { createLocalConnection, defaultOpponentColors } from "@/net/localConnection";
import { MatchStage } from "./MatchStage";

// solo モード。サーバーなしでひとりで撃つ。両席を交互に自分が操作する。

type Props = {
  readonly profile: Profile;
  readonly onProfileChange: (profile: Profile) => void;
  readonly mapName: MapName;
  readonly onExit: () => void;
};

export const SoloMatch = ({ profile, onProfileChange, mapName, onExit }: Props) => {
  const [store, setStore] = useState<MatchStore | null>(null);

  // 接続とストアは effect の中で作る。StrictMode の二重マウントでも cleanup と対にする
  useEffect(() => {
    const connection = createLocalConnection({
      mapName,
      nickname: profile.nickname,
      colors: profile.colors,
      opponentColors: defaultOpponentColors(profile.colors),
    });
    const created = createMatchStore(connection, { followCurrentSeat: true, mySeat: 0, spectator: false });
    setStore(created);
    return () => {
      created.dispose();
      connection.close();
      setStore(null);
    };
    // プロファイルの変更で対戦を作り直さない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapName]);

  if (!store) return null;
  return (
    <MatchStage
      store={store}
      clockOffset={0}
      profile={profile}
      onProfileChange={onProfileChange}
      closeLabel="もう一度"
      onClose={() => store.closeResult()}
      onLeave={onExit}
    />
  );
};
