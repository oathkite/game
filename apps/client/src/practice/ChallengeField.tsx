import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { tiltOf } from "@game/sim";
import type { Loadout } from "@game/protocol";
import { BattleConsole, BattleOverlay, type ItemControls } from "@/worldUi/BattleHud";
import { battleConsoleHeight } from "@/worldUi/consoleHeight";
import { useTouchControls } from "@/worldUi/useTouchControls";
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
  /** guide が盤面と操作盤の間に 1 行（48px）を取るか。重ねて出す案内なら取らない */
  readonly guideRow: boolean;
  /** アイテムの段。渡さなければ押せない状態で出す（ターゲットチャレンジではアイテムを使えない。設計書 37.6） */
  readonly items?: ItemControls;
  /** メニューや案内のボタンを出している間は射撃操作を止める */
  readonly paused: boolean;
  readonly onMenu: () => void;
  readonly onToggleMenu: () => void;
  /** 開始時の俯瞰が終わり、操作を受け付けられるようになったとき */
  readonly onReady?: () => void;
  /** パワーの目盛りを押して目安の線を引いたとき（null は消したとき） */
  readonly onPowerMemo?: (memo: number | null) => void;
  /** 結果やメニューのダイアログ */
  readonly children?: ReactNode;
};

const openingComplete = () => {};
const GUIDE_ROW = 48;
const NO_ITEMS: ItemControls = { used: [], selected: null, disabled: true, select: () => {} };

/** ターゲットチャレンジとチュートリアルに共通の盤面と操作盤（設計書 37.1、44）。操作盤は対戦と同じく、風のメーターとアイテムの段を持ち、▲▼◀▶ と発射のボタンはタッチ端末だけに出す */
export const ChallengeField = ({ store, loadout, className, status, guide, guideRow, items = NO_ITEMS, paused, onMenu, onToggleMenu, onReady, onPowerMemo, children }: Props) => {
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const touch = useTouchControls();
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
  // 通常の対戦と同じ倍率で寄せ、盤面は対戦と同じ操作盤の高さを引いて求める（設計書 37）
  const bottom = battleConsoleHeight(size.w, size.h, touch) + (guideRow ? GUIDE_ROW : 0);
  const layout = useMemo(() => ({ ...cameraLayout(size.w, size.h, loadCameraScale()), mapHeight: Math.max(1, size.h - bottom) }), [size, bottom]);
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
    <BattleConsole steps={state.view.control?.stepsLeft ?? 0} tilt={tiltOf(state.view.mask!, pose)} elevation={state.view.lastElevation} facing={pose.facing} power={input.gauge.value} loadout={loadout} slot={state.view.lastSlot} disabled={disabled} selectSlot={store.selectSlot} onPowerMemo={onPowerMemo}
      wind={state.view.wind.value} items={{ ...items, disabled: items.disabled || disabled || input.gauge.charging }}>
      {touch && <BattleTouchControls disabled={disabled} button={input.button} />}
    </BattleConsole>
    {children}
  </main>;
};
