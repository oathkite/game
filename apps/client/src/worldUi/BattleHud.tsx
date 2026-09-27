import { DelayIndicator, type DelayInfo } from "./DelayIndicator";
import { WindGauge } from "./WindGauge";
import { DotIcon } from "./DotIcon";
import { useLanguage } from "@/i18n/locale";
import { WeaponIcon } from "./WeaponIcon";
import type { ReactNode } from "react";
import { WEAPON_DELAY, WEAPON_LABELS, type TankColors, type Loadout } from "@game/protocol";
import { AngleDial, PowerRuler, MovementReserve } from "./BattleInstruments";
import "./battleHud.css";
import "./battleHudDesktop.css";
import "./battleTouch.css";

export type HudPlayer = { readonly id: string; readonly name: string; readonly hp: number; readonly team: number; readonly colors?: TankColors | undefined };
export const BattleOverlay = ({ clock, onMenu }: { readonly clock: ReactNode; readonly onMenu: () => void }) => { const { t } = useLanguage();
  return <>
  <div className="battle-countdown battle-floating-timer">{clock}</div>
  <button className="battle-menu" aria-label={t("設定を開く")} onClick={onMenu}><DotIcon name="settings" /></button>
</>; };

type Props = { readonly delay?: DelayInfo | undefined; readonly player?: HudPlayer | undefined; readonly steps: number; readonly tilt: number; readonly elevation: number; readonly facing: -1 | 1; readonly power: number; readonly loadout?: Loadout | undefined; readonly slot: number; readonly disabled: boolean; readonly selectSlot: (slot: 0 | 1) => void; readonly wind?: number | null | undefined; readonly children?: ReactNode };
/** wind を渡すと操作盤を 2 段にし、角度メーターの真下に風のメーターを出す（設計書 08 の 8.5）。null は風が決まる前で「—」を出す。 */
export const BattleConsole = (p: Props) => { const { t } = useLanguage(); return <footer className={["battle-console", p.children ? "has-touch" : "", p.wind !== undefined ? "has-wind" : ""].filter(Boolean).join(" ")}>
  <AngleDial tilt={p.tilt} elevation={p.elevation} facing={p.facing} />
  {p.wind !== undefined && <WindGauge wind={p.wind} />}
  {/* 風を出す 2 段の操作盤では、パワーと残り移動を別の段に置くので入れ物に入れない */}
  {p.wind !== undefined ? <><PowerRuler value={p.power} /><MovementReserve steps={p.steps} /></> : <div className="battle-gauges"><PowerRuler value={p.power} /><MovementReserve steps={p.steps} /></div>}
  {p.delay && <DelayIndicator info={p.delay} steps={p.steps} weapon={p.loadout?.[p.slot]} />}
  <div className="battle-weapons">{p.loadout?.map((weapon, slot) => <button key={slot} title={`${t(WEAPON_LABELS[weapon])} · ${t("コスト")} ${WEAPON_DELAY[weapon]}`} aria-label={t(WEAPON_LABELS[weapon])} aria-pressed={p.slot === slot} disabled={p.disabled} onClick={() => p.selectSlot(slot as 0 | 1)}><WeaponIcon weapon={weapon} />{!p.children && <span>{slot === 0 ? "Q" : "E"}</span>}</button>)}</div>
  {p.children && <div className="battle-touch">{p.children}</div>}
</footer>; };
