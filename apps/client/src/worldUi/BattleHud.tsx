import { useLanguage } from "@/i18n/locale";
import { TankPortrait } from "./TankPortrait";
import { WeaponIcon } from "./WeaponIcon";
import type { CSSProperties, ReactNode } from "react";
import { WEAPON_LABELS, type Loadout } from "@game/protocol";
import { AngleDial, PowerRuler } from "./BattleInstruments";
import { teamColor, teamColorName } from "./teamColors";
import "./battleHud.css";

export type HudPlayer = { readonly id: string; readonly name: string; readonly hp: number; readonly team: number };
export const BattleRoster = ({ players, actorId, clock, wind, onMenu }: { readonly players: readonly HudPlayer[]; readonly actorId: string; readonly clock: ReactNode; readonly wind: number; readonly onMenu: () => void }) => { const { t } = useLanguage();
  const seats = (group: readonly HudPlayer[]) => <div className="battle-seats">{group.map(p => <div className={`battle-seat ${p.id === actorId ? "is-actor" : ""}`} key={p.id} style={{ "--team": teamColor(p.team) } as CSSProperties} aria-label={`${p.name}, ${t("{color}チーム", { color: t(teamColorName(p.team)) })}, HP ${p.hp}${p.id === actorId ? ` ${t("手番")}` : ""}`}>
    <div className="battle-seat-portrait" aria-hidden="true"><TankPortrait /></div><span className="battle-team-dot" /><strong>{p.name}</strong><div className="battle-hp"><i style={{ width: `${Math.max(0, Math.min(100, p.hp))}%` }} /></div>
  </div>)}</div>;
  const middle = Math.ceil(players.length / 2);
  return <header className="battle-roster">
  {seats(players.slice(0, middle))}<div className="battle-countdown">{clock}</div>{seats(players.slice(middle))}<div className="battle-wind" aria-label={`${t("風")} ${wind}`}><span>{wind < 0 ? "←" : wind > 0 ? "→" : "↔"}</span><b>{Math.abs(wind)}</b></div>
  <button className="battle-menu" aria-label={t("設定を開く")} onClick={onMenu}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8l3 3M5 19l3-3m8-8l3-3" stroke="currentColor" strokeWidth="3" /><circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="3" /><circle cx="12" cy="12" r="2" fill="currentColor" /></svg></button>
</header>; };

type Props = { readonly player?: HudPlayer | undefined; readonly steps: number; readonly tilt: number; readonly elevation: number; readonly facing: -1 | 1; readonly power: number; readonly loadout?: Loadout | undefined; readonly slot: number; readonly disabled: boolean; readonly selectSlot: (slot: 0 | 1) => void; readonly children?: ReactNode };
export const BattleConsole = (p: Props) => { const { t } = useLanguage(); return <footer className={`battle-console ${p.children ? "has-touch" : ""}`}>
  <div className="battle-self" style={{ "--team": teamColor(p.player?.team ?? 0) } as CSSProperties}><strong>{p.player?.name ?? "—"}</strong><div className="battle-hp"><i style={{ width: `${Math.max(0, Math.min(100, p.player?.hp ?? 0))}%` }} /></div><span>{p.player?.hp ?? 0}/100</span><small aria-label={`${t("残り移動")} ${p.steps}`}>↔ {p.steps}</small></div>
  <AngleDial tilt={p.tilt} elevation={p.elevation} facing={p.facing} /><PowerRuler value={p.power} />
  <div className="battle-weapons">{p.loadout?.map((weapon, slot) => <button key={slot} title={t(WEAPON_LABELS[weapon])} aria-label={t(WEAPON_LABELS[weapon])} aria-pressed={p.slot === slot} disabled={p.disabled} onClick={() => p.selectSlot(slot as 0 | 1)}><WeaponIcon weapon={weapon} /><span>{slot === 0 ? "Q" : "E"}</span></button>)}</div>
  {p.children && <div className="battle-touch">{p.children}</div>}
</footer>; };
