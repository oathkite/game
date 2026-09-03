import { useCallback, useEffect, useRef, useState } from "react";

// パワーの長押し。押し始めから離すまでの時間を performance.now() で測り、1.5 秒で 100 に達して止まる（設計書 03 の 3.5）。
// ポインタとキーが同時に来たら先に始まった方だけを有効にする。

export const POWER_FULL_MS = 1500;

export type PowerSource = "pointer" | "key";

export type PowerGauge = {
  /** 表示用。押していないときは離した瞬間の値を一瞬固定表示する */
  readonly value: number;
  readonly charging: boolean;
  readonly begin: (source: PowerSource) => void;
  /** 離した。発射するなら onFire が呼ばれる */
  readonly release: (source: PowerSource) => void;
  /** pointercancel やフォーカス喪失。溜めていたパワーを捨てる */
  readonly cancel: () => void;
};

export const powerFromElapsed = (elapsedMs: number): number => Math.min(100, Math.max(0, Math.floor((elapsedMs / POWER_FULL_MS) * 100)));

export const usePowerGauge = (enabled: boolean, onFire: (power: number) => void): PowerGauge => {
  const [value, setValue] = useState(0);
  const [charging, setCharging] = useState(false);
  const startedAt = useRef<number | null>(null);
  const source = useRef<PowerSource | null>(null);
  const raf = useRef<number | null>(null);
  const onFireRef = useRef(onFire);
  onFireRef.current = onFire;

  const stopLoop = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
  }, []);

  const loop = useCallback(() => {
    if (startedAt.current === null) return;
    setValue(powerFromElapsed(performance.now() - startedAt.current));
    raf.current = requestAnimationFrame(loop);
  }, []);

  const begin = useCallback(
    (from: PowerSource) => {
      if (!enabled || startedAt.current !== null) return;
      source.current = from;
      startedAt.current = performance.now();
      setCharging(true);
      setValue(0);
      raf.current = requestAnimationFrame(loop);
    },
    [enabled, loop],
  );

  const release = useCallback(
    (from: PowerSource) => {
      if (startedAt.current === null || source.current !== from) return;
      const power = powerFromElapsed(performance.now() - startedAt.current);
      startedAt.current = null;
      source.current = null;
      stopLoop();
      setCharging(false);
      setValue(power);
      onFireRef.current(power);
    },
    [stopLoop],
  );

  const cancel = useCallback(() => {
    startedAt.current = null;
    source.current = null;
    stopLoop();
    setCharging(false);
    setValue(0);
  }, [stopLoop]);

  useEffect(() => {
    if (!enabled) cancel();
  }, [enabled, cancel]);

  useEffect(() => {
    const onBlur = (): void => cancel();
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("blur", onBlur);
      stopLoop();
    };
  }, [cancel, stopLoop]);

  return { value, charging, begin, release, cancel };
};
