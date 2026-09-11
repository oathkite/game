import { useEffect, useRef, type PointerEvent } from "react";
import { useHold } from "@/ui/useHold";
import { usePowerGauge } from "@/ui/usePowerGauge";

type Action = "left" | "right" | "up" | "down" | "fire";
export const useBattleInput = (enabled: boolean, move: (direction: -1 | 1) => void, aim: (delta: number) => void, fire: (power: number) => void, slot: (value: 0 | 1) => void) => {
  const gauge = usePowerGauge(enabled, fire), owner = useRef<string | number | null>(null);
  const holds = { left: useHold(() => move(-1), 100, enabled && !gauge.charging), right: useHold(() => move(1), 100, enabled && !gauge.charging), up: useHold(() => aim(1), 50, enabled && !gauge.charging), down: useHold(() => aim(-1), 50, enabled && !gauge.charging) };
  const latest = useRef({ enabled, holds, gauge, slot }); latest.current = { enabled, holds, gauge, slot };
  const cancel = () => { Object.values(latest.current.holds).forEach(h => h.stop()); latest.current.gauge.cancel(); owner.current = null; };
  const begin = (id: string | number, action: Action) => {
    if (!latest.current.enabled || owner.current !== null) return;
    owner.current = id;
    if (action === "fire") latest.current.gauge.begin(typeof id === "number" ? "pointer" : "key"); else latest.current.holds[action].start();
  };
  const release = (id: string | number) => {
    if (owner.current !== id) return;
    Object.values(latest.current.holds).forEach(h => h.stop());
    latest.current.gauge.release(typeof id === "number" ? "pointer" : "key"); owner.current = null;
  };
  useEffect(() => { if (!enabled) cancel(); }, [enabled]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || !latest.current.enabled || (e.target instanceof HTMLElement && e.target.matches("input,select,textarea,[contenteditable]"))) return;
      if (e.code === "KeyQ" || e.code === "KeyE") { if (owner.current === null) latest.current.slot(e.code === "KeyQ" ? 0 : 1); e.preventDefault(); return; }
      const action = ({ KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right", KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down", Space: "fire" } as const)[e.code as "KeyA"];
      if (action) { e.preventDefault(); begin(e.code, action); }
    };
    const up = (e: KeyboardEvent) => { if (owner.current === e.code) { e.preventDefault(); release(e.code); } };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", cancel); document.addEventListener("visibilitychange", cancel);
    return () => { cancel(); window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", cancel); document.removeEventListener("visibilitychange", cancel); };
  }, []);
  const button = (action: Action) => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => { if (!e.isPrimary || e.button !== 0) return; e.preventDefault(); begin(e.pointerId, action); if (owner.current === e.pointerId) e.currentTarget.setPointerCapture(e.pointerId); },
    onPointerUp: (e: PointerEvent<HTMLButtonElement>) => release(e.pointerId),
    onPointerCancel: cancel, onLostPointerCapture: cancel,
  });
  return { gauge, button, cancel };
};
