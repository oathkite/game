import { WEAPON_IDS, type WeaponId } from "@game/protocol";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createFxLab, type FxLab as Lab, type FxLabStats } from "./fxLabScene";

// FX ラボの画面。設計書 41.11。?prototype=fx で開く開発用の画面で、本番には入れない。
// e2e と測定のために window.__fxLab から同じ操作を呼べる。

declare global {
  interface Window {
    __fxLab?: Lab;
  }
}

const SPEEDS = [1, 0.5, 0.25, 0.1] as const;

const panel: CSSProperties = { position: "fixed", top: 8, left: 8, zIndex: 2, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: 8, background: "rgba(0,0,0,0.75)", color: "#33ff66", font: "12px monospace" };

const statsText = (s: FxLabStats | null): string =>
  s ? `particles ${s.particles} (max ${s.maxParticles}) / frame p50 ${s.frameP50} p95 ${s.frameP95} ms / work p50 ${s.workP50} p95 ${s.workP95} ms` : "loading";

export const FxLab = () => {
  const host = useRef<HTMLDivElement>(null);
  const [lab, setLab] = useState<Lab | null>(null);
  const [weapon, setWeapon] = useState<WeaponId>("cannon");
  const [stats, setStats] = useState<FxLabStats | null>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false, created: Lab | null = null;
    // still=1 では時計を止めたまま開き、撃つのも進めるのも呼び出す側に任せる（e2e の決めた時刻の絵）
    const still = new URLSearchParams(location.search).get("still") === "1";
    void createFxLab(element, { still }).then((l) => {
      if (disposed) { l.destroy(); return; }
      created = l; window.__fxLab = l; setLab(l);
      if (still) setPaused(true); else l.fire("cannon");
    });
    const timer = setInterval(() => { if (created) setStats(created.stats()); }, 500);
    return () => { disposed = true; clearInterval(timer); created?.destroy(); delete window.__fxLab; };
  }, []);
  const choose = (w: WeaponId): void => { setWeapon(w); lab?.fire(w); };
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }}>
      <div ref={host} data-testid="fx-lab" data-ready={lab !== null} style={{ position: "absolute", inset: 0 }} />
      <div style={panel} data-testid="fx-panel">
        <select aria-label="weapon" value={weapon} onChange={(e) => choose(e.target.value as WeaponId)}>
          {WEAPON_IDS.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
        <button type="button" onClick={() => lab?.fire(weapon)}>fire</button>
        <label><input type="checkbox" defaultChecked onChange={(e) => lab?.setLoop(e.target.checked)} />loop</label>
        <select aria-label="speed" defaultValue="1" onChange={(e) => lab?.setSpeed(Number(e.target.value))}>
          {SPEEDS.map((s) => <option key={s} value={s}>{`x${s}`}</option>)}
        </select>
        <button type="button" onClick={() => { if (paused) lab?.resume(); else lab?.pause(); setPaused(!paused); }}>{paused ? "resume" : "pause"}</button>
        <button type="button" disabled={!paused} onClick={() => lab?.step(1000 / 60)}>step</button>
        <label><input type="checkbox" onChange={(e) => lab?.setReduceMotion(e.target.checked)} />reduce motion</label>
        <button type="button" onClick={() => lab?.resetStats()}>reset stats</button>
        <span data-testid="fx-stats">{statsText(stats)}</span>
      </div>
    </div>
  );
};
