import {
  COLOR_HEX,
  MAP_LABELS,
  MAP_NAMES,
  NICKNAME_MAX,
  PLAYER_COLORS,
  WEAPON_IDS,
  WEAPON_LABELS,
  type MapName,
  type PlayerColor,
  type Loadout,
  type WeaponId,
  type WeaponSlot,
} from "@game/protocol";
import { useState } from "react";
import type { Profile } from "@/app/profile";
import { TankPreview, type WeaponDemo } from "./TankPreview";

// プレイヤー設定。設計書 09 の 9.2、10 の 10.4、08 の 8.4。左のペインに名前と色とプレビュー、右のペインに武器と出発の操作。

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

/** 装備のスロット slot に武器 w を入れる。もう一方のスロットが同じ武器なら入れ替えて、同じ武器が 2 つ並ばないようにする */
export const pickWeapon = (loadout: Loadout, slot: WeaponSlot, w: WeaponId): Loadout => {
  const other = slot === 0 ? 1 : 0;
  const next: [WeaponId, WeaponId] = [loadout[0], loadout[1]];
  if (loadout[other] === w) next[other] = loadout[slot];
  next[slot] = w;
  return next;
};

/** 装備の 1 スロット。8 つの候補から 1 つ選ぶ。名前だけを出し、性格はプレビューのデモで伝える。もう一方のスロットで選んでいる武器には印を付ける。選んだ武器も返し、呼び出し側がデモを撃つ */
const WeaponPicker = ({ label, slot, loadout, onPick }: { label: string; slot: WeaponSlot; loadout: Loadout; onPick: (l: Loadout, w: WeaponId) => void }) => (
  <div className="column" style={{ gap: 8 }}>
    <div className="label">{label}</div>
    <div className="weapon-grid" role="radiogroup" aria-label={label}>
      {WEAPON_IDS.map((w) => (
        <button
          key={w}
          type="button"
          role="radio"
          aria-checked={loadout[slot] === w}
          aria-label={`${label} ${w}`}
          className={`weapon-cell${loadout[slot] === w ? " active" : ""}${loadout[slot === 0 ? 1 : 0] === w ? " other" : ""}`}
          onClick={() => onPick(pickWeapon(loadout, slot, w), w)}
        >
          {WEAPON_LABELS[w]}
        </button>
      ))}
    </div>
  </div>
);

type LoadoutPaneProps = {
  readonly profile: Profile;
  readonly onPick: (loadout: Loadout, weapon: WeaponId) => void;
  readonly onEnterLobby: () => void;
  readonly onSolo: (mapName: MapName) => void;
  readonly inviteCode: string | null;
  readonly valid: boolean;
};

/** 右のペイン。武器 1 と武器 2、下端にロビーへ、ひとりで撃つ、キーの案内 */
const LoadoutPane = ({ profile, onPick, onEnterLobby, onSolo, inviteCode, valid }: LoadoutPaneProps) => {
  const [soloMap, setSoloMap] = useState<MapName>("valley");
  return (
    <div className="pane">
      <WeaponPicker label="武器 1" slot={0} loadout={profile.loadout} onPick={onPick} />
      <WeaponPicker label="武器 2" slot={1} loadout={profile.loadout} onPick={onPick} />
      <div className="pane-bottom">
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
          矢印キー: 上下で仰角、左右で移動。Tab: メインとサブの切り替え。スペース: 押して溜め、離して発射。Esc: 設定。
        </div>
      </div>
    </div>
  );
};

export const SetupScreen = ({ profile, onChange, onEnterLobby, onSolo, inviteCode }: Props) => {
  const [demo, setDemo] = useState<WeaponDemo | null>(null);
  const valid = profile.nickname.trim().length > 0;
  // 武器を選ぶたびにデモを撃ち直す。同じ武器を選び直しても key が変わるので撃つ
  const pickLoadout = (loadout: Loadout, weapon: WeaponId): void => {
    onChange({ ...profile, loadout });
    setDemo({ weapon, key: (demo?.key ?? 0) + 1 });
  };

  return (
    <div className="screen-split">
      <div className="pane">
        <div className="title">FORTRESS</div>
        <TankPreview colors={profile.colors} demo={demo} />
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
        {/* 絵と同じ上下の順に並べる。砲塔（副色）が上、車体（主色）が下 */}
        <ColorPicker label="副色（砲塔）" value={profile.colors.secondary} onPick={(c) => onChange({ ...profile, colors: { ...profile.colors, secondary: c } })} />
        <ColorPicker label="主色（車体）" value={profile.colors.primary} onPick={(c) => onChange({ ...profile, colors: { ...profile.colors, primary: c } })} />
      </div>
      <LoadoutPane profile={profile} onPick={pickLoadout} onEnterLobby={onEnterLobby} onSolo={onSolo} inviteCode={inviteCode} valid={valid} />
    </div>
  );
};
