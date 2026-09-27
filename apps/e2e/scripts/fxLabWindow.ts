// client の FX ラボ（apps/client/src/dev/FxLab.tsx、設計書 41.11）が window.__fxLab に置く操作のうち、e2e と測定で使うもの

export type FxLabStats = {
  readonly frames: number;
  readonly frameP50: number;
  readonly frameP95: number;
  readonly workP50: number;
  readonly workP95: number;
  readonly particles: number;
  readonly maxParticles: number;
  readonly carves: number;
};

export type FxLabHandle = {
  readonly fire: (weapon: string) => void;
  readonly setLoop: (on: boolean) => void;
  readonly step: (ms: number) => void;
  readonly stats: () => FxLabStats;
  readonly resetStats: () => void;
  readonly setTargetHp: (hp: number) => void;
};

declare global {
  interface Window {
    __fxLab?: FxLabHandle;
  }
}
