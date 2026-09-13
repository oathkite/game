import { useState } from "react";
import { loadProfile, saveProfile } from "@/app/profile";
import { setAudioSettings, unlockAudio } from "@/app/audio";
import { useLanguage } from "@/i18n/locale";
import { PixelButton } from "./PixelUi";
export const AudioControls = () => {
  const { t } = useLanguage();
  const [audio, setAudio] = useState(() => { const { volume, muted, bgmVolume } = loadProfile(); return { volume, muted, bgmVolume: bgmVolume ?? volume }; });
  const update = (patch: Partial<typeof audio>) => {
    const next = { ...audio, ...patch };
    setAudio(next); saveProfile({ ...loadProfile(), ...next });
    setAudioSettings(next.volume, next.muted, next.bgmVolume); unlockAudio();
  };
  return <div className="audio-controls">
    {(["bgmVolume", "volume"] as const).map(key => <label key={key}>{t(key === "bgmVolume" ? "BGM音量" : "効果音量")} {audio.muted ? 0 : Math.round(audio[key] * 100)}%<span className="volume-segments"><span className="volume-bars" aria-hidden="true">{Array.from({ length:20 }, (_, index) => <i key={index} className={!audio.muted && index < Math.round(audio[key] * 20) ? "is-lit" : ""} />)}</span><input aria-label={t(key === "bgmVolume" ? "BGM音量" : "効果音量")} type="range" min="0" max="100" value={audio[key] * 100} onChange={e => update({ [key]: Number(e.target.value) / 100 })} /></span></label>)}
    <PixelButton aria-pressed={audio.muted} onClick={() => update({ muted: !audio.muted })}>{audio.muted ? t("音を出す") : t("音を消す")}</PixelButton>
  </div>;
};
