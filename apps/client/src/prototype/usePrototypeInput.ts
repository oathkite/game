import { wheelPan } from "./wheelPan";
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
  const drag = useRef<{ x: number; y: number; active: boolean; at: number } | null>(null);
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
    else rig.releasePan(performance.now());
    owner.current = null; drag.current = null;
  };
  useEffect(() => { if (blocked || !enabled) cancel(); }, [blocked, enabled]);
  useEffect(() => {
    let panKey: string | null = null, raf = 0, previous = performance.now();
    let cycleTurn = -1, cycleSeat = -1;
    const keyAction = (code: string): Action | null => ({ KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right", KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down", Space: "fire" } as const)[code as "KeyA"] ?? null;
    const stop = (): void => { panKey = null; cancel(); };
    const down = (e: KeyboardEvent): void => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === "Escape") { stop(); latest.current.toggleMenu(); e.preventDefault(); return; }
      if (latest.current.blocked || (e.target instanceof HTMLElement && e.target.matches("input, select, textarea, [contenteditable]"))) return;
      if (e.code === "Tab" && !e.shiftKey) {
        e.preventDefault();
        if (owner.current) return;
        const view = store.getView();
        const seats = view.players?.filter(p => p.hp > 0 && p.y < (view.mask?.height ?? 225)) ?? [];
        if (!seats.length) return;
        if (cycleTurn !== view.turnNumber) { cycleTurn = view.turnNumber; cycleSeat = view.currentSeat; }
        const next = seats[(seats.findIndex(p => p.seat === cycleSeat) + 1) % seats.length]!;
        cycleSeat = next.seat;
        const position = next.seat === view.mySeat ? view.control ?? next : next;
        rig.focus({ x: position.x, y: position.y - 6 }, "manual", matchMedia("(prefers-reduced-motion: reduce)").matches);
        return;
      }
      if ((e.code === "KeyQ" || e.code === "KeyE") && !owner.current && latest.current.enabled) { store.selectSlot(e.code === "KeyQ" ? 0 : 1); e.preventDefault(); return; }
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
    onWheel: (e: React.WheelEvent<HTMLDivElement>) => {
      if (!latest.current.blocked && !owner.current && !e.ctrlKey) wheelPan(rig, e.deltaX, e.deltaY, e.deltaMode);
    },
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!e.isPrimary || e.button !== 0 || owner.current || latest.current.blocked) return;
      e.preventDefault(); e.currentTarget.focus({ preventScroll: true }); owner.current = { id: e.pointerId, action: "pan" }; rig.stop();
      drag.current = { x: e.clientX, y: e.clientY, active: false, at: performance.now() }; e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (latest.current.blocked) return;
      const from = drag.current;
      if (from && owner.current?.id === e.pointerId && owner.current.action === "pan") {
        const x = e.clientX - from.x, y = e.clientY - from.y;
        if (!from.active && Math.hypot(x, y) < 8) return;
        const now = performance.now();
        rig.pan({ x, y }, now - from.at, now); drag.current = { x: e.clientX, y: e.clientY, active: true, at: now };
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
