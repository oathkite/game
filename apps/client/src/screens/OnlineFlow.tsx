import type { Profile } from "@/app/profile";

// ロビー、部屋、対戦、リザルトの流れ。サーバー実装と一緒に足す。

type Props = {
  readonly profile: Profile;
  readonly onProfileChange: (profile: Profile) => void;
  readonly inviteCode: string | null;
  readonly onExit: () => void;
};

export const OnlineFlow = ({ onExit }: Props) => (
  <div className="screen">
    <div className="column">
      <div className="dim">オンライン対戦は準備中</div>
      <button type="button" onClick={onExit}>
        戻る
      </button>
    </div>
  </div>
);
