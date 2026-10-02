import { useEffect, useRef, type PointerEvent } from "react";
import { useHold } from "@/ui/useHold";
import { usePowerGauge } from "@/ui/usePowerGauge";

type Action = "left" | "right" | "up" | "down" | "fire";
/** preparation は相手の手番の準備。角度（W/S、上下）と武器（Q/E）と向き（A/D、左右を face へ）だけを受け付け、移動と発射は enabled のときだけ（設計書 30 章） */
export const useBattleInput = (enabled: boolean, move: (direction: -1 | 1) => void, aim: (delta: number) => void, fire: (power: number) => void, slot: (value: 0 | 1) => void, paused = false, preparation = false, face: (direction: -1 | 1) => void = () => {}) => {
  const aimOwner = useRef<{ id: string | number; action: "up" | "down" } | null>(null);
  const ownedAction = useRef<Action | null>(null);
  const pause = useRef(paused); pause.current = paused;
  const gauge = usePowerGauge(enabled && !paused, fire), owner = useRef<string | number | null>(null);
  const holds = { left: useHold(() => { if (!pause.current) move(-1); }, 100, enabled && !gauge.charging), right: useHold(() => { if (!pause.current) move(1); }, 100, enabled && !gauge.charging), up: useHold(() => { if (!pause.current) aim(1); }, 50, enabled || preparation), down: useHold(() => { if (!pause.current) aim(-1); }, 50, enabled || preparation) };
  const latest = useRef({ enabled, preparation, holds, gauge, slot, face }); latest.current = { enabled, preparation, holds, gauge, slot, face };
  const cancel = () => { Object.values(latest.current.holds).forEach(h => h.stop()); latest.current.gauge.cancel(); owner.current = null; aimOwner.current = null; };
  const begin = (id: string | number, action: Action) => {
    const aiming = action === "up" || action === "down";
    if (pause.current || !(latest.current.enabled || (action !== "fire" && latest.current.preparation))) return;
    // 相手の手番の左右は向きだけを変える。押し続けても繰り返さない
    if (!latest.current.enabled && (action === "left" || action === "right")) { latest.current.face(action === "left" ? -1 : 1); return; }
    if (aiming) {
      if (aimOwner.current || (owner.current !== null && ownedAction.current !== "fire")) return;
      aimOwner.current = { id, action }; latest.current.holds[action].start(); return;
    }
    if (owner.current !== null || (aimOwner.current && action !== "fire")) return;
    owner.current = id; ownedAction.current = action;
    if (action === "fire") latest.current.gauge.begin(typeof id === "number" ? "pointer" : "key"); else latest.current.holds[action].start();
  };
  const release = (id: string | number) => {
    if (aimOwner.current?.id === id) {
      latest.current.holds[aimOwner.current.action].stop(); aimOwner.current = null; return;
    }
    if (owner.current !== id) return;
    latest.current.holds.left.stop(); latest.current.holds.right.stop();
    latest.current.gauge.release(typeof id === "number" ? "pointer" : "key"); owner.current = null;
  };
  // 自分の手番でないときに、手番か準備の可否が変わったら押し続けを止める
  useEffect(() => { if (!enabled) cancel(); }, [enabled, preparation]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || !(latest.current.enabled || latest.current.preparation) || (e.target instanceof HTMLElement && e.target.matches("input,select,textarea,[contenteditable]"))) return;
      if (e.code === "KeyQ" || e.code === "KeyE") { if (owner.current === null && !aimOwner.current) latest.current.slot(e.code === "KeyQ" ? 0 : 1); e.preventDefault(); return; }
      const action = ({ KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right", KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down", Space: "fire" } as const)[e.code as "KeyA"];
      if (action) { e.preventDefault(); begin(e.code, action); }
    };
    const up = (e: KeyboardEvent) => { if (owner.current === e.code || aimOwner.current?.id === e.code) { e.preventDefault(); release(e.code); } };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", cancel); window.addEventListener("resize", cancel); document.addEventListener("visibilitychange", cancel);
    return () => { cancel(); window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", cancel); window.removeEventListener("resize", cancel); document.removeEventListener("visibilitychange", cancel); };
  }, []);
  const button = (action: Action) => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => { if (!e.isPrimary || e.button !== 0) return; e.preventDefault(); begin(e.pointerId, action); if (owner.current === e.pointerId || aimOwner.current?.id === e.pointerId) e.currentTarget.setPointerCapture(e.pointerId); },
    onPointerUp: (e: PointerEvent<HTMLButtonElement>) => release(e.pointerId),
    onPointerCancel: cancel, onLostPointerCapture: (e: PointerEvent<HTMLButtonElement>) => { if (owner.current === e.pointerId || aimOwner.current?.id === e.pointerId) cancel(); },
  });
  return { gauge, button, cancel };
};
