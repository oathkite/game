import { useCallback, useEffect, useRef, useState } from "react";
import { type GaugeState, IDLE_GAUGE, type PowerSource, stepGauge } from "./powerGauge";

// パワーの長押し。時間の計測と状態遷移は powerGauge.ts の純関数に置き、ここでは時計と描画ループだけを持つ。

export type { PowerSource } from "./powerGauge";

export type PowerGauge = {
  /** 表示用。押していないときは離した瞬間の値を一瞬固定表示する */
  readonly value: number;
  readonly charging: boolean;
  readonly begin: (source: PowerSource) => void;
  /** 離した。発射するなら onFire が呼ばれる。100 に達して自動発射した後の解放は何もしない */
  readonly release: (source: PowerSource) => void;
  /** pointercancel やフォーカス喪失。溜めていたパワーを捨てる */
  readonly cancel: () => void;
};

type Driver = {
  readonly begin: (source: PowerSource) => void;
  readonly release: (source: PowerSource) => void;
  readonly cancel: () => void;
  readonly dispose: () => void;
};

type DriverDeps = {
  /** 溜めてよいか。false の間は始められず、溜めている途中なら捨てる */
  readonly enabled: () => boolean;
  readonly onFire: (power: number) => void;
  readonly onChange: (state: GaugeState) => void;
};

// 溜めている間だけ rAF を回す。状態は powerGauge の純関数が持ち、ここは時計と rAF の後始末だけを見る
const createDriver = (deps: DriverDeps): Driver => {
  let state = IDLE_GAUGE;
  let raf: number | null = null;

  const stop = (): void => {
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;
  };

  const apply = (next: ReturnType<typeof stepGauge>): void => {
    state = next.state;
    deps.onChange(state);
    if (state.startedAt === null) stop();
    if (next.fire !== null) deps.onFire(next.fire);
  };

  const loop = (): void => {
    if (state.startedAt === null) return;
    apply(stepGauge(state, { type: "tick", now: performance.now(), enabled: deps.enabled() }));
    if (state.startedAt !== null) raf = requestAnimationFrame(loop);
  };

  return {
    begin: (source) => {
      if (!deps.enabled() || state.startedAt !== null) return;
      apply(stepGauge(state, { type: "begin", source, now: performance.now() }));
      raf = requestAnimationFrame(loop);
    },
    release: (source) => apply(stepGauge(state, { type: "release", source, now: performance.now() })),
    // 溜めている途中だけ捨てる。離した瞬間の高さは次に溜め始めるまで残す（設計書 03 の 3.5）
    cancel: () => {
      if (state.startedAt !== null) apply(stepGauge(state, { type: "cancel" }));
    },
    dispose: stop,
  };
};

export const usePowerGauge = (enabled: boolean, onFire: (power: number) => void): PowerGauge => {
  const [shown, setShown] = useState<GaugeState>(IDLE_GAUGE);
  const latest = useRef({ enabled, onFire });
  latest.current = { enabled, onFire };
  const driver = useRef<Driver | null>(null);
  if (driver.current === null) {
    driver.current = createDriver({
      enabled: () => latest.current.enabled,
      onFire: (power) => latest.current.onFire(power),
      onChange: setShown,
    });
  }
  const d = driver.current;

  const begin = useCallback((source: PowerSource) => d.begin(source), [d]);
  const release = useCallback((source: PowerSource) => d.release(source), [d]);
  const cancel = useCallback(() => d.cancel(), [d]);

  // 操作が無効になったら、溜めている途中のパワーだけ捨てる。
  // 離した瞬間の高さは次に溜め始めるまで固定表示する（設計書 03 の 3.5）
  useEffect(() => {
    if (!enabled) cancel();
  }, [enabled, cancel]);

  useEffect(() => {
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("blur", cancel);
      d.dispose();
    };
  }, [cancel, d]);

  return { value: shown.value, charging: shown.startedAt !== null, begin, release, cancel };
};
