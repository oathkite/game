import { useLanguage } from "@/i18n/locale";
import { useEffect, useState } from "react";
import type { CameraRig } from "./cameraRig";
import { DEFAULT_CAMERA_SETTINGS, loadCameraSettings, saveCameraSettings, type CameraSettings } from "./cameraSettings";

export const CameraSettingsPanel = ({ rig }: { readonly rig: CameraRig }) => {
  const { t } = useLanguage();
  const [settings, setSettings] = useState(loadCameraSettings);
  useEffect(() => { rig.configure(settings); saveCameraSettings(settings); }, [settings, rig]);
  const update = (key: keyof CameraSettings, value: string): void => {
    if (value !== "") setSettings(current => ({ ...current, [key]: Number(value) }));
  };
  return <fieldset className="kp-camera-settings">
    <legend>{t("カメラ調整")}</legend>
    <label htmlFor="camera-speed">{t("移動速度")} <output>{settings.speed.toFixed(2)}{t("倍")}</output></label>
    <input id="camera-speed" type="range" min="0.25" max="3" step="0.05" value={settings.speed} onChange={e => update("speed", e.target.value)} />
    <small>{t("ドラッグ・スワイプ・端スクロール・キーボードに反映")}</small>
    <label htmlFor="camera-inertia">{t("慣性の長さ")} <output>{settings.inertiaMs === 0 ? "OFF" : `${settings.inertiaMs} ms`}</output></label>
    <input id="camera-inertia" type="range" min="0" max="1000" step="20" value={settings.inertiaMs} onChange={e => update("inertiaMs", e.target.value)} />
    <small>{t("大きいほど、離したあと長く流れます。0で無効。")}</small>
    <button type="button" onClick={() => setSettings(DEFAULT_CAMERA_SETTINGS)}>{t("カメラを初期値に戻す")}</button>
    <small>{t("変更は即時反映され、このブラウザに保存されます。")}</small>
  </fieldset>;
};
