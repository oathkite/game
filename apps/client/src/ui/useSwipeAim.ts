import { useCallback, useRef } from "react";
import { swipeAdvance, swipeDelta, type SwipeDelta } from "./swipeAim";

// マップの上をなぞる操作を Pointer Events で受ける。設計書 03 の 3.3。
// 押した位置からの移動量を歩数と仰角に変え、送った分を覚えて差だけを進める。

const ZERO: SwipeDelta = { steps: 0, elevation: 0 };

export type SwipeAim = {
  readonly onPointerDown: (e: React.PointerEvent) => void;
  readonly onPointerMove: (e: React.PointerEvent) => void;
  readonly onPointerUp: (e: React.PointerEvent) => void;
  readonly onPointerCancel: () => void;
};

export type SwipeActions = {
  readonly moveStep: (dir: -1 | 1) => void;
  readonly changeElevation: (delta: number) => void;
};

export const useSwipeAim = (enabled: boolean, actions: SwipeActions): SwipeAim => {
  const origin = useRef<{ x: number; y: number; id: number } | null>(null);
  const sent = useRef<SwipeDelta>(ZERO);
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  const end = useCallback(() => {
    origin.current = null;
    sent.current = ZERO;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return;
      origin.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      sent.current = ZERO;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [enabled],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const from = origin.current;
      if (!enabled || !from || from.id !== e.pointerId) return;
      const current = swipeDelta(e.clientX - from.x, e.clientY - from.y);
      const advance = swipeAdvance(sent.current, current);
      sent.current = current;
      const { moveStep, changeElevation } = actionsRef.current;
      for (let i = 0; i < Math.abs(advance.steps); i++) moveStep(advance.steps > 0 ? 1 : -1);
      if (advance.elevation !== 0) changeElevation(advance.elevation);
    },
    [enabled],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (origin.current?.id === e.pointerId) end();
    },
    [end],
  );

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: end };
};
