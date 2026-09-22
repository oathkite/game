import { useLanguage } from "@/i18n/locale";
import { MAP_LABELS, WEAPON_IDS, WEAPON_LABELS, WEAPON_DELAY, type MapName, type WeaponId } from "@game/protocol";
import { useState } from "react";
import type { Profile } from "@/app/profile";

type Props = { readonly profile: Profile; readonly onProfileChange: (p: Profile) => void; readonly onStart: (map: MapName | "random") => void; readonly onBack: () => void };
export const FreePracticeSetup = ({ profile, onProfileChange, onStart, onBack }: Props) => {
  const { t } = useLanguage();
  const [map, setMap] = useState<MapName | "random">("ridgeline");
  return <main className="menu-shell practice-menu"><div className="menu-content practice-content">
    <h1>{t("自由練習")}</h1><p>{t("好きなステージと装備で、両方の戦車を操作して試そう。")}</p>
    <label className="column">{t("ステージ")}<select aria-label={t("ステージ")} value={map} onChange={e => setMap(e.target.value as MapName | "random")}>
      <option value="random">{t("ランダム")}</option>{(["ridgeline", "stone-bridge", "terraces", "sky-islands"] as const).map(id => <option key={id} value={id}>{t(MAP_LABELS[id])}</option>)}
    </select></label>
    {([0, 1] as const).map(slot => <label key={slot} className="column">{t("装備")} {slot + 1}<select aria-label={`${t("装備")} ${slot + 1}`} value={profile.loadout[slot]} onChange={e => {
      const weapon = e.target.value as WeaponId;
      onProfileChange({ ...profile, loadout: slot === 0 ? [weapon, profile.loadout[1]] : [profile.loadout[0], weapon] });
    }}>{WEAPON_IDS.map(id => <option key={id} value={id} disabled={id === profile.loadout[slot === 0 ? 1 : 0]}>{t(WEAPON_LABELS[id])} · {t("コスト")} {WEAPON_DELAY[id]}</option>)}</select></label>)}
    </div><footer className="menu-actions"><button className="primary-action" onClick={() => onStart(map)}>{t("自由練習をはじめる")}</button><button onClick={onBack}>{t("プラクティスへ戻る")}</button></footer></main>;
};
