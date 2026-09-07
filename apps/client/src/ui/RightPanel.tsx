import { WEAPON_LABELS, type Loadout, type WeaponSlot } from "@game/protocol";
import { useState } from "react";
import { GAUGE_BORDER, markerBottom, powerAtOffset, toggleMarker } from "./powerMarker";
import type { PowerGauge } from "./usePowerGauge";

// 右パネル。設計書 03 の 3.5、10 の 10.3。上端に離脱のボタン、下端に武器の切り替え、パワーゲージ、射撃ボタン。
// ゲージは射撃ボタンの上端から武器の切り替えの下端までを 100 段に区切る。

/** 武器の切り替えの高さ。2 つのボタンと隙間 */
const WEAPON_SWITCH_HEIGHT = 36 * 2 + 4;

type Props = {
  readonly width: number;
  readonly height: number;
  readonly enabled: boolean;
  readonly gauge: PowerGauge;
  /** 上端に置く離脱のボタン。観戦者なら退出、対戦中なら降参 */
  readonly exitLabel: string | null;
  readonly onExit: () => void;
  /** 自分の装備。観戦者は null で、切り替えを出さない */
  readonly loadout: Loadout | null;
  readonly slot: WeaponSlot;
  readonly onSelectSlot: (slot: WeaponSlot) => void;
};

type SwitchProps = {
  readonly loadout: Loadout;
  readonly slot: WeaponSlot;
  readonly enabled: boolean;
  readonly onSelectSlot: (slot: WeaponSlot) => void;
};

/** メインとサブの切り替え。選んでいる側を明るい緑で塗り、手番の間だけ押せる */
const WeaponSwitch = ({ loadout, slot, enabled, onSelectSlot }: SwitchProps) => (
  <div className="weapon-switch" data-testid="weapon-switch" data-slot={slot}>
    {(["main", "sub"] as const).map((s) => (
      <button
        key={s}
        type="button"
        className={slot === s ? "active" : ""}
        disabled={!enabled}
        aria-label={`weapon ${s}`}
        aria-pressed={slot === s}
        onClick={() => onSelectSlot(s)}
      >
        {s === "main" ? "MAIN" : "SUB"} {WEAPON_LABELS[s === "main" ? loadout.main : loadout.sub]}
      </button>
    ))}
  </div>
);

type Heights = { readonly fire: number; readonly exit: number; readonly gauge: number; readonly inner: number };

/** 上端の離脱ボタン、武器の切り替え、ゲージ、射撃ボタンを縦に積む。ボタンが無いときはゲージがその分だけ伸びる */
const heightsOf = (width: number, height: number, hasExit: boolean, hasSwitch: boolean): Heights => {
  // 幅に合わせて縦に伸ばすが、画面が低いときにゲージの取り分を食わないよう高さの 3 割で止める
  const fire = Math.max(48, Math.min(Math.floor(width * 1.2), Math.floor(height * 0.3)));
  const exit = hasExit ? 36 : 0;
  const switchHeight = hasSwitch ? WEAPON_SWITCH_HEIGHT + 8 : 0;
  const gauge = Math.max(0, height - fire - exit - switchHeight - 24);
  // 枠線の内側の高さ。溜まった量も目安ラインもこの中に収める
  return { fire, exit, gauge, inner: Math.max(0, gauge - GAUGE_BORDER * 2) };
};

/** パワーゲージ。押した高さに目安のラインを引く（設計書 03 の 3.5） */
const GaugeView = ({ gauge, heights }: { gauge: PowerGauge; heights: Heights }) => {
  const [marker, setMarker] = useState<number | null>(null);
  const fill = Math.floor((gauge.value / 100) * heights.inner);
  const press = (e: React.PointerEvent<HTMLDivElement>): void => {
    e.preventDefault();
    // 枠の内側で測る。getBoundingClientRect は枠線を含むので、上端を押しても 100 に届かなくなる
    const box = e.currentTarget;
    const top = box.getBoundingClientRect().top + box.clientTop;
    setMarker((current) => toggleMarker(current, powerAtOffset(e.clientY - top, box.clientHeight)));
  };
  return (
    <div
      className="gauge"
      style={{ height: heights.gauge }}
      data-testid="power-gauge"
      data-power={gauge.value}
      data-marker={marker ?? ""}
      onPointerDown={press}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="gauge-fill" style={{ height: fill }} />
      {marker !== null && <div className="gauge-marker" style={{ bottom: Math.floor(markerBottom(marker, heights.inner)) }} data-testid="power-marker" />}
    </div>
  );
};

export const RightPanel = ({ width, height, enabled, gauge, exitLabel, onExit, loadout, slot, onSelectSlot }: Props) => {
  const hs = heightsOf(width, height, exitLabel !== null, loadout !== null);

  return (
    <div className="panel" style={{ width, padding: 4, gap: 8 }}>
      {exitLabel !== null && (
        <button type="button" className="exit" style={{ height: hs.exit }} onClick={onExit}>
          {exitLabel}
        </button>
      )}
      <div className="panel-bottom">
        {loadout !== null && <WeaponSwitch loadout={loadout} slot={slot} enabled={enabled} onSelectSlot={onSelectSlot} />}
        <GaugeView gauge={gauge} heights={hs} />
        <button
          type="button"
          className={`fire${gauge.charging ? " held" : ""}`}
          style={{ height: hs.fire }}
          disabled={!enabled}
          aria-label="fire"
          data-testid="fire"
          onPointerDown={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
            gauge.begin("pointer");
          }}
          onPointerUp={() => gauge.release("pointer")}
          onPointerCancel={() => gauge.cancel()}
          onContextMenu={(e) => e.preventDefault()}
        >
          FIRE
        </button>
      </div>
    </div>
  );
};
