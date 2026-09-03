import { COLOR_HEX, MAP_LABELS, MAP_NAMES, NICKNAME_MAX, PLAYER_COLORS, type MapName, type PlayerColor } from "@game/protocol";
import { useState } from "react";
import type { Profile } from "@/app/profile";
import { TankPreview } from "./TankPreview";

// プレイヤー設定。設計書 09 の 9.2。名前、主色と副色、プレビュー。

type Props = {
  readonly profile: Profile;
  readonly onChange: (profile: Profile) => void;
  readonly onEnterLobby: () => void;
  readonly onSolo: (mapName: MapName) => void;
  readonly inviteCode: string | null;
};

const ColorPicker = ({ value, onPick, label }: { value: PlayerColor; onPick: (c: PlayerColor) => void; label: string }) => (
  <div className="column" style={{ gap: 8 }}>
    <div className="label">{label}</div>
    <div className="color-grid" role="radiogroup" aria-label={label}>
      {PLAYER_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={`${label} ${c}`}
          className={`color-cell${value === c ? " selected" : ""}`}
          style={{ background: COLOR_HEX[c], padding: 0 }}
          onClick={() => onPick(c)}
        />
      ))}
    </div>
  </div>
);

export const SetupScreen = ({ profile, onChange, onEnterLobby, onSolo, inviteCode }: Props) => {
  const [soloMap, setSoloMap] = useState<MapName>("valley");
  const valid = profile.nickname.trim().length > 0;
  const cell = Math.max(4, Math.min(24, Math.floor(Math.min(window.innerWidth, window.innerHeight) / 2 / 12)));

  return (
    <div className="screen">
      <div className="column">
        <div className="title">FORTRESS</div>
        <div style={{ display: "flex", justifyContent: "center", padding: 16 }}>
          <TankPreview colors={profile.colors} cell={cell} />
        </div>
        <label className="column" style={{ gap: 8 }}>
          <span className="label">プレイヤー名</span>
          <input
            value={profile.nickname}
            maxLength={NICKNAME_MAX}
            placeholder="1 から 12 文字"
            aria-label="nickname"
            onChange={(e) => onChange({ ...profile, nickname: e.target.value.slice(0, NICKNAME_MAX) })}
          />
        </label>
        <ColorPicker label="主色" value={profile.colors.primary} onPick={(c) => onChange({ ...profile, colors: { ...profile.colors, primary: c } })} />
        <ColorPicker label="副色" value={profile.colors.secondary} onPick={(c) => onChange({ ...profile, colors: { ...profile.colors, secondary: c } })} />
        <div className="row">
          <label className="row" style={{ flex: 1 }}>
            <input
              type="checkbox"
              checked={profile.muted}
              style={{ flex: "none", width: 24, height: 24 }}
              onChange={(e) => onChange({ ...profile, muted: e.target.checked })}
            />
            <span>消音</span>
          </label>
          <label className="row" style={{ flex: 1 }}>
            <input
              type="checkbox"
              checked={profile.swapPanels}
              style={{ flex: "none", width: 24, height: 24 }}
              onChange={(e) => onChange({ ...profile, swapPanels: e.target.checked })}
            />
            <span>左右を入れ替える</span>
          </label>
        </div>
        <button type="button" disabled={!valid} onClick={onEnterLobby} data-testid="enter-lobby">
          {inviteCode ? `部屋 ${inviteCode} に入る` : "ロビーへ"}
        </button>
        <div className="row">
          <select value={soloMap} aria-label="solo map" onChange={(e) => setSoloMap(e.target.value as MapName)}>
            {MAP_NAMES.map((m) => (
              <option key={m} value={m}>
                {MAP_LABELS[m]}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => onSolo(soloMap)} data-testid="solo">
            ひとりで撃つ
          </button>
        </div>
        <div className="dim" style={{ fontSize: 16, lineHeight: 1.5 }}>
          矢印キー: 上下で仰角、左右で移動。スペース: 押して溜め、離して発射。
        </div>
      </div>
    </div>
  );
};
