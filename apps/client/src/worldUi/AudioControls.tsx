import { useState } from "react";
import { loadProfile, saveProfile } from "@/app/profile";
import { setAudioSettings, unlockAudio } from "@/app/audio";
import { useLanguage } from "@/i18n/locale";
import { PixelButton } from "./PixelUi";
export const AudioControls = () => {
  const { t } = useLanguage();
  const [audio, setAudio] = useState(() => { const { volume, muted } = loadProfile(); return { volume, muted }; });
  const update = (patch: Partial<typeof audio>) => {
    const next = { ...audio, ...patch };
    setAudio(next); saveProfile({ ...loadProfile(), ...next });
    setAudioSettings(next.volume, next.muted); unlockAudio();
  };
  return <div className="audio-controls">
    <label>{t("音量")} {Math.round(audio.volume * 100)}%<input aria-label={t("音量")} type="range" min="0" max="100" value={audio.volume * 100} onChange={e => update({ volume: Number(e.target.value) / 100 })} /></label>
    <PixelButton aria-pressed={audio.muted} onClick={() => update({ muted: !audio.muted })}>{audio.muted ? t("音を出す") : t("音を消す")}</PixelButton>
  </div>;
};
