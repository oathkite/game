import { isRingOut, surfaceY, tiltOf } from "@game/sim";
import { useEffect, useRef } from "react";
import { playSound } from "@/app/audio";
import type { MatchStore } from "@/match/matchStore";
import type { MatchView } from "@/match/types";
import { createRenderer, type Renderer } from "./renderer";
import { playReplay } from "./replay";
import type { Layout } from "./scale";
import type { SwipeAim } from "@/ui/useSwipeAim";
import type { TankPose } from "./tankView";

// PixiJS の Canvas を React から 1 箇所でマウントする（設計書 07 の 7.1）。

type Props = {
  readonly store: MatchStore;
  readonly view: MatchView;
  readonly layout: Layout;
  /** マップの上をなぞる操作。Pointer Events のハンドラをそのまま渡す */
  readonly swipe: SwipeAim;
};

const posesOf = (view: MatchView, elevations: readonly [number, number]): readonly [TankPose, TankPose] | null => {
  const { mask, players } = view;
  if (!mask || !players) return null;
  const pose = (seat: 0 | 1): TankPose => {
    const p = players[seat];
    const mine = view.control && view.mySeat === seat && (view.phase === "acting" || view.phase === "fired");
    const x = mine && view.control ? view.control.x : p.x;
    const facing = mine && view.control ? view.control.facing : p.facing;
    const elevation = mine && view.control ? view.control.elevation : elevations[seat];
    return { x, y: surfaceY(mask, x), tilt: tiltOf(mask, x), facing, elevation, hp: p.hp, visible: !isRingOut(mask, x), flash: false };
  };
  return [pose(0), pose(1)];
};

export const GameCanvas = ({ store, view, layout, swipe }: Props) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const elevationsRef = useRef<[number, number]>([45, 45]);
  const replayCancelRef = useRef<(() => void) | null>(null);
  const replayIdRef = useRef<number | null>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  // Application の生成と破棄。マップと両者が決まった時点で 1 回だけ作る
  const ready = view.mask !== null && view.players !== null;
  useEffect(() => {
    const host = hostRef.current;
    const v = store.getView();
    if (!ready || !host || !v.mask || !v.players) return;
    let cancelled = false;
    let created: Renderer | null = null;
    void createRenderer({ host, layout: layoutRef.current, mask: v.mask, players: v.players }).then((r) => {
      if (cancelled) {
        r.destroy();
        return;
      }
      created = r;
      rendererRef.current = r;
      const poses = posesOf(store.getView(), elevationsRef.current);
      if (poses) {
        r.setTank(0, poses[0]);
        r.setTank(1, poses[1]);
      }
    });
    return () => {
      cancelled = true;
      if (replayCancelRef.current) replayCancelRef.current();
      replayCancelRef.current = null;
      if (created) created.destroy();
      rendererRef.current = null;
    };
  }, [ready, store]);

  useEffect(() => {
    rendererRef.current?.setLayout(layout);
  }, [layout]);

  // 状態の反映。再生中は replay.ts が描くので触らない
  useEffect(() => {
    const r = rendererRef.current;
    if (!r || !view.mask) return;
    if (view.replay) {
      if (replayIdRef.current === view.replay.id) return;
      replayIdRef.current = view.replay.id;
      const job = view.replay;
      elevationsRef.current[job.shot.input.seat] = job.shot.input.elevation;
      if (replayCancelRef.current) replayCancelRef.current();
      replayCancelRef.current = playReplay(r, job, elevationsRef.current, view.mySeat, {
        sound: playSound,
        done: () => {
          replayCancelRef.current = null;
          store.completeReplay(job.id);
        },
      });
      return;
    }
    if (replayCancelRef.current) {
      // 再生の途中で次のターンが来たら打ち切って確定状態に合わせる（設計書 04 の 4.4）
      replayCancelRef.current();
      replayCancelRef.current = null;
    }
    r.setTerrain(view.mask);
    if (view.control && view.mySeat !== null) elevationsRef.current[view.mySeat] = view.control.elevation;
    const poses = posesOf(view, elevationsRef.current);
    if (poses) {
      r.setTank(0, poses[0]);
      r.setTank(1, poses[1]);
    }
  }, [view, store]);

  return <div ref={hostRef} className="map-frame" style={{ width: layout.mapWidth, height: layout.mapHeight }} {...swipe} />;
};
