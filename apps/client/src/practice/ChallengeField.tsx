import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { tiltOf } from "@game/sim";
import type { Loadout } from "@game/protocol";
import { BattleConsole, BattleOverlay } from "@/worldUi/BattleHud";
import { BattleTouchControls } from "@/worldUi/BattleTouchControls";
import { useBrowserBackAction } from "@/worldUi/browserBack";
import { createCameraRig } from "@/prototype/cameraRig";
import { cameraLayout } from "@/prototype/camera";
import { PrototypeCanvas } from "@/prototype/PrototypeCanvas";
import { usePrototypeInput } from "@/prototype/usePrototypeInput";
import { hudPose } from "@/match/hudPose";
import { loadCameraScale } from "@/worldUi/displayScale";
import type { ChallengeStore } from "./store";
import "@/prototype/prototype.css";

type Props = {
  readonly store: ChallengeStore;
  readonly loadout: Loadout;
  readonly className: string;
  /** 上部に置く面の名前と残りの数 */
  readonly status: ReactNode;
  /** 盤面と操作盤の間に置くヒントや案内 */
  readonly guide: ReactNode;
  /** メニューや案内のボタンを出している間は射撃操作を止める */
  readonly paused: boolean;
  readonly onMenu: () => void;
  readonly onToggleMenu: () => void;
  /** 開始時の俯瞰が終わり、操作を受け付けられるようになったとき */
  readonly onReady?: () => void;
  /** 結果やメニューのダイアログ */
  readonly children?: ReactNode;
};

const openingComplete = () => {};

/** ターゲットチャレンジとチュートリアルに共通の盤面と操作盤（設計書 37.1、44） */
export const ChallengeField = ({ store, loadout, className, status, guide, paused, onMenu, onToggleMenu, onReady, children }: Props) => {
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const [size, setSize] = useState({ w: innerWidth, h: innerHeight });
  const [ready, setReady] = useState(false);
  const rig = useMemo(createCameraRig, []);
  const readyListener = useRef(onReady);
  readyListener.current = onReady;
  // PrototypeCanvas は onReady が変わると作り直すので、同じ関数を渡し続ける
  const handleReady = useCallback((value: boolean) => { setReady(value); if (value) readyListener.current?.(); }, []);
  useEffect(() => {
    const resize = () => setSize({ w: innerWidth, h: innerHeight });
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  // 通常の対戦と同じ倍率で寄せる（設計書 37）
  const layout = useMemo(() => ({ ...cameraLayout(size.w, size.h, loadCameraScale()), mapHeight: Math.max(1, size.h - 160) }), [size]);
  const blocked = paused || state.status !== "playing";
  const input = usePrototypeInput(store, rig, ready && state.view.phase === "acting", blocked, onToggleMenu);
  const openMenu = () => { input.cancel(); onMenu(); };
  useBrowserBackAction(true, openMenu);
  const pose = hudPose(state.view, 0)!;
  const disabled = blocked || !ready || state.view.phase !== "acting";
  return <main className={`kp-root ${className}`} onContextMenu={e => e.preventDefault()}>
    <BattleOverlay clock={status} onMenu={openMenu} />
    <PrototypeCanvas store={store} rig={rig} layout={layout} handlers={input.world} blocked={blocked || input.gauge.charging} followShot onReady={handleReady} onOpeningComplete={openingComplete} worldArt practice={store} />
    {guide}
    <BattleConsole steps={state.view.control?.stepsLeft ?? 0} tilt={tiltOf(state.view.mask!, pose)} elevation={state.view.lastElevation} facing={pose.facing} power={input.gauge.value} loadout={loadout} slot={state.view.lastSlot} disabled={disabled} selectSlot={store.selectSlot}>
      <BattleTouchControls disabled={disabled} button={input.button} />
    </BattleConsole>
    {children}
  </main>;
};
