import { DelayIndicator, type DelayInfo } from "./DelayIndicator";
import { WindGauge } from "./WindGauge";
import { DotIcon } from "./DotIcon";
import { useLanguage } from "@/i18n/locale";
import { WeaponIcon } from "./WeaponIcon";
import type { ReactNode } from "react";
import { ITEM_IDS, ITEM_LABELS, TELEPORT_DELAY, WEAPON_DELAY, WEAPON_LABELS, type ItemId, type TankColors, type Loadout } from "@game/protocol";
import { AngleDial, PowerRuler, MovementReserve } from "./BattleInstruments";
import "./battleHud.css";
import "./battleHudDesktop.css";
import "./battleTouch.css";

/** タッチの操作盤の高さ。縦持ちのスマートフォンはパワーと残り移動を別の段に分けるので高い。battleTouch.css の media query と同じ条件で決める */
export const touchConsoleHeight = (width: number, height: number): number => (height >= width && width < 600 ? 216 : 112);

export type HudPlayer = { readonly id: string; readonly name: string; readonly hp: number; readonly team: number; readonly colors?: TankColors | undefined };
export const BattleOverlay = ({ clock, onMenu }: { readonly clock: ReactNode; readonly onMenu: () => void }) => { const { t } = useLanguage();
  return <>
  <div className="battle-countdown battle-floating-timer">{clock}</div>
  <button className="battle-menu" aria-label={t("設定を開く")} onClick={onMenu}><DotIcon name="settings" /></button>
</>; };

/** アイテムの操作（設計書 42.1）。selected は撃つ前に選んだアイテムで、もう一度押すと外す */
export type ItemControls = { readonly used: readonly ItemId[]; readonly selected: ItemId | null; readonly disabled: boolean; readonly select: (item: ItemId | null) => void };
const BattleItems = ({ items }: { readonly items: ItemControls }) => { const { t } = useLanguage();
  return <div className="battle-items" role="group" aria-label={t("アイテム")}>{ITEM_IDS.map(item => { const used = items.used.includes(item);
    return <button key={item} aria-pressed={items.selected === item} data-used={used || undefined} disabled={items.disabled || used} aria-label={`${t(ITEM_LABELS[item])}${used ? `（${t("使用済み")}）` : ""}`}
      title={`${t(ITEM_LABELS[item])} · ${t("コスト")} ${item === "double" ? t("武器をもう一度") : `+${TELEPORT_DELAY}`}`} onClick={() => items.select(items.selected === item ? null : item)}><DotIcon name={item} /></button>; })}</div>; };

type Props = { readonly items?: ItemControls | undefined; readonly delay?: DelayInfo | undefined; readonly player?: HudPlayer | undefined; readonly steps: number; readonly tilt: number; readonly elevation: number; readonly facing: -1 | 1; readonly power: number; readonly loadout?: Loadout | undefined; readonly slot: number; readonly disabled: boolean; readonly selectSlot: (slot: 0 | 1) => void; readonly wind?: number | null | undefined; readonly children?: ReactNode };
/** wind を渡すと操作盤を 2 段にし、角度メーターの真下に風のメーターを出す（設計書 08 の 8.5）。null は風が決まる前で「—」を出す。 */
export const BattleConsole = (p: Props) => { const { t } = useLanguage(); return <footer className={["battle-console", p.children ? "has-touch" : "", p.wind !== undefined ? "has-wind" : ""].filter(Boolean).join(" ")}>
  <AngleDial tilt={p.tilt} elevation={p.elevation} facing={p.facing} />
  {p.wind !== undefined && <WindGauge wind={p.wind} />}
  {/* 風を出す 2 段の操作盤では、パワーと残り移動を別の段に置くので入れ物に入れない */}
  {p.wind !== undefined ? <><PowerRuler value={p.power} /><MovementReserve steps={p.steps} /></> : <div className="battle-gauges"><PowerRuler value={p.power} /><MovementReserve steps={p.steps} /></div>}
  {p.delay && <DelayIndicator info={p.delay} steps={p.steps} weapon={p.loadout?.[p.slot]} item={p.items?.selected ?? undefined} />}
  {/* アイテムは武器の上の段に並べる。DOM では武器の後ろに置き、武器のボタンの順（1 番目が Q、2 番目が E）を変えない */}
  <div className="battle-weapons">{p.loadout?.map((weapon, slot) => <button key={slot} title={`${t(WEAPON_LABELS[weapon])} · ${t("コスト")} ${WEAPON_DELAY[weapon]}`} aria-label={t(WEAPON_LABELS[weapon])} aria-pressed={p.slot === slot} disabled={p.disabled} onClick={() => p.selectSlot(slot as 0 | 1)}><WeaponIcon weapon={weapon} /></button>)}{p.items && <BattleItems items={p.items} />}</div>
  {p.children && <div className="battle-touch">{p.children}</div>}
</footer>; };
