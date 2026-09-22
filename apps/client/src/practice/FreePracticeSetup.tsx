import { CPU_LEVEL_LABELS, CPU_LEVEL_HINTS, type CpuLevel } from "./cpuLevel";
import { useLanguage } from "@/i18n/locale";
import { MAP_LABELS, WEAPON_IDS, WEAPON_LABELS, WEAPON_DELAY, type MapName, type WeaponId } from "@game/protocol";
import { useState } from "react";
import type { Profile } from "@/app/profile";

type Props = { readonly cpu?: boolean; readonly profile: Profile; readonly onProfileChange: (p: Profile) => void; readonly onStart: (map: MapName | "random", level: CpuLevel) => void; readonly onBack: () => void };
export const FreePracticeSetup = ({ cpu = false, profile, onProfileChange, onStart, onBack }: Props) => {
  const { t } = useLanguage();
  const [level, setLevel] = useState<CpuLevel>("normal");
  const [map, setMap] = useState<MapName | "random">("ridgeline");
  return <main className="menu-shell practice-menu"><div className="menu-content practice-content">
    <header className="practice-header"><h1>{t(cpu ? "CPU戦" : "自由練習")}</h1><p className="dim">{t(cpu ? "好きなステージと装備で、CPUと対戦しよう。" : "好きなステージと装備で、両方の戦車を操作して試そう。")}</p></header>
    {cpu && <div className="column"><label className="column">{t("CPUレベル")}<select aria-label={t("CPUレベル")} aria-describedby="cpu-level-hint" value={level} onChange={e => setLevel(e.target.value as CpuLevel)}>
      {(["easy", "normal", "hard"] as const).map(value => <option key={value} value={value}>{t(CPU_LEVEL_LABELS[value])}</option>)}
    </select></label><p className="dim" id="cpu-level-hint">{t(CPU_LEVEL_HINTS[level])}</p></div>}
    <label className="column">{t("ステージ")}<select aria-label={t("ステージ")} value={map} onChange={e => setMap(e.target.value as MapName | "random")}>
      <option value="random">{t("ランダム")}</option>{(["ridgeline", "stone-bridge", "terraces", "sky-islands"] as const).map(id => <option key={id} value={id}>{t(MAP_LABELS[id])}</option>)}
    </select></label>
    {([0, 1] as const).map(slot => <label key={slot} className="column">{t("装備")} {slot + 1}<select aria-label={`${t("装備")} ${slot + 1}`} value={profile.loadout[slot]} onChange={e => {
      const weapon = e.target.value as WeaponId;
      onProfileChange({ ...profile, loadout: slot === 0 ? [weapon, profile.loadout[1]] : [profile.loadout[0], weapon] });
    }}>{WEAPON_IDS.map(id => <option key={id} value={id} disabled={id === profile.loadout[slot === 0 ? 1 : 0]}>{t(WEAPON_LABELS[id])} · {t("コスト")} {WEAPON_DELAY[id]}</option>)}</select></label>)}
    </div><footer className="menu-actions"><button className="primary-action" onClick={() => onStart(map, level)}>{t(cpu ? "CPU戦をはじめる" : "自由練習をはじめる")}</button><button onClick={onBack}>{t("プラクティスへ戻る")}</button></footer></main>;
};
