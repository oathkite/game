import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { MatchStore } from "@/match/matchStore";
import { useHold } from "@/ui/useHold";
import { usePowerGauge } from "@/ui/usePowerGauge";
import type { CameraRig } from "./cameraRig";
import { actorPoint } from "./PrototypeCanvas";

type Action = "left" | "right" | "up" | "down" | "fire";
type Owner = { readonly id: number | string; readonly action: Action | "pan" };
export const usePrototypeInput = (store: MatchStore, rig: CameraRig, enabled: boolean, blocked: boolean, toggleMenu: () => void) => {
  const gauge = usePowerGauge(enabled && !blocked, store.fire);
  const holds = {
    left: useHold(() => store.moveStep(-1), 80, enabled && !blocked && !gauge.charging),
    right: useHold(() => store.moveStep(1), 80, enabled && !blocked && !gauge.charging),
    up: useHold(() => store.changeElevation(1), 50, enabled && !blocked && !gauge.charging),
    down: useHold(() => store.changeElevation(-1), 50, enabled && !blocked && !gauge.charging),
  };
  const owner = useRef<Owner | null>(null);
  const drag = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const latest = useRef({ gauge, holds, enabled, blocked, toggleMenu });
  latest.current = { gauge, holds, enabled, blocked, toggleMenu };
  const cancel = (): void => {
    Object.values(latest.current.holds).forEach((h) => h.stop());
    latest.current.gauge.cancel(); owner.current = null; drag.current = null; rig.stop();
  };
  const begin = (id: number | string, action: Action): boolean => {
    if (owner.current || !latest.current.enabled || latest.current.blocked) return false;
    owner.current = { id, action }; rig.stop();
    if (action === "fire") latest.current.gauge.begin(typeof id === "number" ? "pointer" : "key");
    else latest.current.holds[action].start();
    return true;
  };
  const release = (id: number | string): void => {
    if (owner.current?.id !== id) return;
    if (owner.current.action === "fire") latest.current.gauge.release(typeof id === "number" ? "pointer" : "key");
    else if (owner.current.action !== "pan") latest.current.holds[owner.current.action].stop();
    owner.current = null; drag.current = null;
  };
  useEffect(() => { if (blocked || !enabled) cancel(); }, [blocked, enabled]);
  useEffect(() => {
    let panKey: string | null = null, raf = 0, previous = performance.now();
    const keyAction = (code: string): Action | null => ({ KeyA: "left", KeyD: "right", ArrowUp: "up", ArrowDown: "down", Space: "fire" } as const)[code as "KeyA"] ?? null;
    const stop = (): void => { panKey = null; cancel(); };
    const down = (e: KeyboardEvent): void => {
      if (e.repeat) return;
      if (e.code === "Escape") { stop(); latest.current.toggleMenu(); e.preventDefault(); return; }
      if (latest.current.blocked || (e.target instanceof HTMLElement && e.target.matches("input, select, textarea, [contenteditable]"))) return;
      if (e.code === "KeyC" && !owner.current) { rig.focus(actorPoint(store.getView()), "actor", matchMedia("(prefers-reduced-motion: reduce)").matches); e.preventDefault(); return; }
      if (e.shiftKey && e.code.startsWith("Arrow") && !owner.current) { panKey = e.code; e.preventDefault(); return; }
      if (panKey || (e.code === "Space" && e.target instanceof HTMLElement && e.target.closest("button"))) return;
      const action = keyAction(e.code);
      if (action && begin(e.code, action)) e.preventDefault();
    };
    const up = (e: KeyboardEvent): void => {
      if (e.code === panKey || e.code.startsWith("Shift")) panKey = null;
      if (owner.current?.id === e.code) { release(e.code); e.preventDefault(); }
    };
    const frame = (now: number): void => {
      const delta = Math.min(50, now - previous) * 0.48; previous = now;
      if (panKey && !latest.current.blocked) rig.pan({ x: panKey === "ArrowLeft" ? delta : panKey === "ArrowRight" ? -delta : 0, y: panKey === "ArrowUp" ? delta : panKey === "ArrowDown" ? -delta : 0 });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    window.addEventListener("blur", stop); window.addEventListener("resize", stop);
    document.addEventListener("visibilitychange", stop);
    return () => {
      cancelAnimationFrame(raf); stop();
      window.removeEventListener("keydown", down); window.removeEventListener("keyup", up);
      window.removeEventListener("blur", stop); window.removeEventListener("resize", stop);
      document.removeEventListener("visibilitychange", stop);
    };
  }, [rig, store]);
  const button = (action: Action) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (e.isPrimary && e.button === 0 && begin(e.pointerId, action)) e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => release(e.pointerId),
    onPointerCancel: (e: ReactPointerEvent<HTMLButtonElement>) => { if (owner.current?.id === e.pointerId) cancel(); },
    onLostPointerCapture: (e: ReactPointerEvent<HTMLButtonElement>) => { if (owner.current?.id === e.pointerId) cancel(); },
    onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => { if (!e.repeat && (e.code === "Space" || e.code === "Enter")) { e.preventDefault(); begin(e.code, action); } },
    onKeyUp: (e: React.KeyboardEvent<HTMLButtonElement>) => { if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); release(e.code); } },
    onBlur: cancel,
  });
  const world = {
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!e.isPrimary || e.button !== 0 || owner.current || latest.current.blocked) return;
      e.preventDefault(); owner.current = { id: e.pointerId, action: "pan" }; rig.stop();
      drag.current = { x: e.clientX, y: e.clientY, active: false }; e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (latest.current.blocked) return;
      const from = drag.current;
      if (from && owner.current?.id === e.pointerId && owner.current.action === "pan") {
        const x = e.clientX - from.x, y = e.clientY - from.y;
        if (!from.active && Math.hypot(x, y) < 8) return;
        rig.pan({ x, y }); drag.current = { x: e.clientX, y: e.clientY, active: true };
      } else if (!owner.current && e.pointerType === "mouse") {
        const rect = e.currentTarget.getBoundingClientRect();
        rig.edge({ x: e.clientX - rect.left, y: e.clientY - rect.top }, performance.now());
      }
    },
    onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => release(e.pointerId),
    onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => { if (owner.current?.id === e.pointerId) cancel(); },
    onLostPointerCapture: (e: ReactPointerEvent<HTMLDivElement>) => { if (owner.current?.id === e.pointerId) cancel(); },
    onPointerLeave: () => rig.stop(),
  };
  return { gauge, button, world, cancel };
};
