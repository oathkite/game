import {
  COLOR_HEX,
  NICKNAME_MAX,
  PLAYER_COLORS,
  WEAPON_IDS,
  WEAPON_LABELS,
  type MapChoice,
  type PlayerColor,
  type Loadout,
  type WeaponId,
  type WeaponSlot,
} from "@game/protocol";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { MapPicker } from "./MapPicker";
import type { Profile } from "@/app/profile";
import { TankPreview, type WeaponDemo } from "./TankPreview";

// プレイヤー設定。設計書 09 の 9.2、10 の 10.4、08 の 8.4。左にプレビュー、右に名前と色と武器、スクロール領域の外に出発の操作。

type Props = {
  readonly profile: Profile;
  readonly onChange: (profile: Profile) => void;
  readonly onEnterLobby: () => void;
  readonly onSolo: (mapName: MapChoice) => void;
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

type SetupActionsProps = Pick<Props, "onEnterLobby" | "onSolo" | "inviteCode"> & { readonly valid: boolean };

const SetupActions = ({ onEnterLobby, onSolo, inviteCode, valid }: SetupActionsProps) => {
  const [soloMap, setSoloMap] = useState<MapChoice>("valley");
  return (
    <footer className="menu-actions setup-actions">
      <button className="primary-action" type="button" disabled={!valid} onClick={onEnterLobby} data-testid="enter-lobby">
        {inviteCode ? `部屋 ${inviteCode} に入る` : "ロビーへ"}
      </button>
      <div className="row solo-row">
        <MapPicker value={soloMap} onChange={setSoloMap} label="solo map" />
        <button type="button" onClick={() => onSolo(soloMap)} data-testid="solo">プラクティス</button>
      </div>
    </footer>
  );
};

const PickerDialog = ({ title, children }: { readonly title: string; readonly children: ReactNode }) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (open) dialog.current?.showModal(); }, [open]);
  return (
    <>
      <button type="button" aria-label={title} aria-haspopup="dialog" onClick={() => setOpen(true)}>変更</button>
      <dialog ref={dialog} className="picker-dialog" aria-label={title} onClose={() => setOpen(false)} onClick={(e) => {
        if (e.target === e.currentTarget) dialog.current?.close();
      }}>
        <div className="picker-inner">
          <div className="label">{title}</div>
          <div className="picker-content">{open && children}</div>
          <button type="button" onClick={() => dialog.current?.close()}>完了</button>
        </div>
      </dialog>
    </>
  );
};

const ProfileSettings = ({ profile, onChange }: Pick<Props, "profile" | "onChange">) => (
  <div className="profile-settings">
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
    <div className="selection-summary">
      <div className="selected-colors">
        <span>カラー1 <span className="swatch" style={{ background: COLOR_HEX[profile.colors.secondary] }} /></span>
        <span>カラー2 <span className="swatch" style={{ background: COLOR_HEX[profile.colors.primary] }} /></span>
      </div>
      <PickerDialog title="色を変更">
        <div className="picker-preview"><TankPreview colors={profile.colors} demo={null} /></div>
        <ColorPicker label="カラー1" value={profile.colors.secondary} onPick={(c) => onChange({ ...profile, colors: { ...profile.colors, secondary: c } })} />
        <ColorPicker label="カラー2" value={profile.colors.primary} onPick={(c) => onChange({ ...profile, colors: { ...profile.colors, primary: c } })} />
      </PickerDialog>
    </div>
  </div>
);

const LoadoutSettings = ({ profile, demo, onPick }: { readonly profile: Profile; readonly demo: WeaponDemo | null; readonly onPick: (loadout: Loadout, weapon: WeaponId) => void }) => (
  <div className="loadout-settings">
    <div className="selection-summary">
      <div className="selected-weapons" data-testid="loadout-summary">
        <span>武器 1　{WEAPON_LABELS[profile.loadout[0]]}</span>
        <span>武器 2　{WEAPON_LABELS[profile.loadout[1]]}</span>
      </div>
      <PickerDialog title="武器を変更">
        <div className="picker-preview"><TankPreview colors={profile.colors} demo={demo} /></div>
        <div className="weapon-pickers">
          <WeaponPicker label="武器 1" slot={0} loadout={profile.loadout} onPick={onPick} />
          <WeaponPicker label="武器 2" slot={1} loadout={profile.loadout} onPick={onPick} />
        </div>
      </PickerDialog>
    </div>
  </div>
);

export const SetupScreen = ({ profile, onChange, onEnterLobby, onSolo, inviteCode }: Props) => {
  const [demo, setDemo] = useState<WeaponDemo | null>(null);
  const valid = profile.nickname.trim().length > 0;
  // 武器を選ぶたびにデモを撃ち直す。同じ武器を選び直しても key が変わるので撃つ
  const pickLoadout = (loadout: Loadout, weapon: WeaponId): void => {
    onChange({ ...profile, loadout });
    setDemo({ weapon, key: (demo?.key ?? 0) + 1 });
  };

  return (
    <div className="menu-shell setup">
      <div className="screen-split menu-content">
        <div className="pane setup-preview-pane">
          <div className="title">FORTRESS</div>
          <TankPreview colors={profile.colors} demo={demo} fill />
        </div>
        <div className="pane">
          <ProfileSettings profile={profile} onChange={onChange} />
          <LoadoutSettings profile={profile} demo={demo} onPick={pickLoadout} />
        </div>
      </div>
      <SetupActions onEnterLobby={onEnterLobby} onSolo={onSolo} inviteCode={inviteCode} valid={valid} />
    </div>
  );
};
