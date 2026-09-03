import { useCallback, useEffect, useRef, useState } from "react";

// 押している間、自前の周期で繰り返し fn を呼ぶ（設計書 03 の 3.3）。OS のキーリピートは使わない。
// ポインタとキーのどちらから始まっても同じ挙動にする。

export type Hold = {
  readonly held: boolean;
  readonly start: () => void;
  readonly stop: () => void;
};

export const useHold = (fn: () => void, intervalMs: number, enabled: boolean): Hold => {
  const [held, setHeld] = useState(false);
  const timer = useRef<number | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const stop = useCallback(() => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    setHeld(false);
  }, []);

  const start = useCallback(() => {
    if (timer.current !== null || !enabled) return;
    setHeld(true);
    fnRef.current();
    timer.current = window.setInterval(() => fnRef.current(), intervalMs);
  }, [enabled, intervalMs]);

  useEffect(() => {
    if (!enabled) stop();
  }, [enabled, stop]);

  useEffect(() => stop, [stop]);

  return { held, start, stop };
};

/** ボタン用の Pointer Events。マウスかタッチかは見ない */
export const holdHandlers = (hold: Hold) => ({
  onPointerDown: (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    hold.start();
  },
  onPointerUp: () => hold.stop(),
  onPointerCancel: () => hold.stop(),
  onPointerLeave: () => hold.stop(),
  onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
});
