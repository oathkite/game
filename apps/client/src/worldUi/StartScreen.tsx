import { useCallback, useEffect, useState } from "react";
import { PixelButton } from "./PixelUi";
import { TankPortrait } from "./TankPortrait";
import { worldArt } from "./assets";
import "./intro.css";
const seenKey = "keropod.intro-seen";
const shouldAnimate = (replay: boolean): boolean => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return false;
  try { return replay || localStorage.getItem(seenKey) !== "1"; } catch { return true; }
};
export const StartScreen = ({ onBegin, replay }: { readonly onBegin: () => void; readonly replay: boolean }) => {
  const [intro, setIntro] = useState(() => shouldAnimate(replay));
  const finish = useCallback(() => {
    setIntro(false);
    try { localStorage.setItem(seenKey, "1"); } catch { /* Storage can be disabled; starting the game still works. */ }
  }, []);
  useEffect(() => {
    if (!intro) return;
    const timer = setTimeout(finish, 3000);
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => { if (media.matches) finish(); };
    media.addEventListener("change", changed);
    return () => { clearTimeout(timer); media.removeEventListener("change", changed); };
  }, [intro, finish]);
  return <section className={`world-start ${intro ? "world-intro" : ""}`} data-intro={intro}>
    {intro && <div className="world-intro-machine" aria-hidden="true"><TankPortrait /></div>}
    <h1><img className="world-title-logo" src={worldArt.logo} alt="KEROPOD（ケロポッド）" width="1536" height="1024" fetchPriority="high" /></h1>
    <PixelButton onClick={() => { finish(); onBegin(); }}>はじめる</PixelButton>
    {intro && <button className="world-intro-skip" onClick={finish}>スキップ</button>}
  </section>;
};
