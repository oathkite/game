import type { Profile } from "@/app/profile";

// 対戦中の設定メニュー。右パネル上端の「設定」から開く。
// 消音と左右の入れ替えに加えて、離脱（対戦者は降参、観戦者は退出）をここに置く。

type Props = {
  readonly profile: Profile;
  readonly onProfileChange: (profile: Profile) => void;
  /** 離脱のボタンの文字。決着後など離脱が要らないときは null */
  readonly exitLabel: string | null;
  readonly onExit: () => void;
  readonly onClose: () => void;
};

const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="row">
    <input type="checkbox" checked={checked} style={{ flex: "none", width: 24, height: 24 }} onChange={(e) => onChange(e.target.checked)} />
    <span>{label}</span>
  </label>
);

export const OptionsMenu = ({ profile, onProfileChange, exitLabel, onExit, onClose }: Props) => (
  <div className="overlay">
    <div className="box column" style={{ width: 320 }} data-testid="options">
      <div className="label">設定</div>
      <Toggle label="消音" checked={profile.muted} onChange={(muted) => onProfileChange({ ...profile, muted })} />
      <Toggle label="左右を入れ替える" checked={profile.swapPanels} onChange={(swapPanels) => onProfileChange({ ...profile, swapPanels })} />
      <div className="row" style={{ marginTop: 16 }}>
        {exitLabel !== null && (
          <button type="button" onClick={onExit}>
            {exitLabel}
          </button>
        )}
        <button type="button" onClick={onClose}>
          戻る
        </button>
      </div>
    </div>
  </div>
);
