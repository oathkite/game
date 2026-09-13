import { DotIcon } from "./DotIcon";
import { useLanguage } from "@/i18n/locale";
import { WeaponIcon } from "./WeaponIcon";
import type { ReactNode } from "react";
import { WEAPON_LABELS, type TankColors, type Loadout } from "@game/protocol";
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

type Props = { readonly player?: HudPlayer | undefined; readonly steps: number; readonly tilt: number; readonly elevation: number; readonly facing: -1 | 1; readonly power: number; readonly loadout?: Loadout | undefined; readonly slot: number; readonly disabled: boolean; readonly selectSlot: (slot: 0 | 1) => void; readonly children?: ReactNode };
export const BattleConsole = (p: Props) => { const { t } = useLanguage(); return <footer className={`battle-console ${p.children ? "has-touch" : ""}`}>
  <AngleDial tilt={p.tilt} elevation={p.elevation} facing={p.facing} />
  <div className="battle-gauges"><PowerRuler value={p.power} /><MovementReserve steps={p.steps} /></div>
  <div className="battle-weapons">{p.loadout?.map((weapon, slot) => <button key={slot} title={t(WEAPON_LABELS[weapon])} aria-label={t(WEAPON_LABELS[weapon])} aria-pressed={p.slot === slot} disabled={p.disabled} onClick={() => p.selectSlot(slot as 0 | 1)}><WeaponIcon weapon={weapon} />{!p.children && <span>{slot === 0 ? "Q" : "E"}</span>}</button>)}</div>
  {p.children && <div className="battle-touch">{p.children}</div>}
</footer>; };
