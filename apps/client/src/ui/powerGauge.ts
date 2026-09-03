// パワーゲージの状態遷移。設計書 03 の 3.5。
// 押し始めから離すまでの時間でパワーが決まり、1.5 秒で 100 に達した瞬間に自動で発射する。
// ポインタとキーが同時に来たら先に始まった方だけを有効にする。

export const POWER_FULL_MS = 1500;

export type PowerSource = "pointer" | "key";

export type GaugeState = {
  readonly startedAt: number | null;
  readonly source: PowerSource | null;
  /** 表示用。押していないときは離した瞬間の値を固定表示する */
  readonly value: number;
};

export type GaugeEvent =
  | { readonly type: "begin"; readonly source: PowerSource; readonly now: number }
  /** enabled が false なら、100 に達しても発射せず溜めていたパワーを捨てる */
  | { readonly type: "tick"; readonly now: number; readonly enabled: boolean }
  | { readonly type: "release"; readonly source: PowerSource; readonly now: number }
  | { readonly type: "cancel" };

export type GaugeStep = {
  readonly state: GaugeState;
  /** 発射が確定したパワー。確定しなければ null */
  readonly fire: number | null;
};

export const IDLE_GAUGE: GaugeState = { startedAt: null, source: null, value: 0 };

export const powerFromElapsed = (elapsedMs: number): number => Math.min(100, Math.max(0, Math.floor((elapsedMs / POWER_FULL_MS) * 100)));

const fireAt = (power: number): GaugeStep => ({ state: { startedAt: null, source: null, value: power }, fire: power });

export const stepGauge = (state: GaugeState, event: GaugeEvent): GaugeStep => {
  switch (event.type) {
    case "begin":
      if (state.startedAt !== null) return { state, fire: null };
      return { state: { startedAt: event.now, source: event.source, value: 0 }, fire: null };
    case "tick": {
      if (state.startedAt === null) return { state, fire: null };
      // 時間切れのパスなどで操作が無効になっていたら、100 に達していても撃たずに捨てる
      if (!event.enabled) return { state: IDLE_GAUGE, fire: null };
      const elapsed = event.now - state.startedAt;
      if (elapsed >= POWER_FULL_MS) return fireAt(100);
      return { state: { ...state, value: powerFromElapsed(elapsed) }, fire: null };
    }
    case "release":
      if (state.startedAt === null || state.source !== event.source) return { state, fire: null };
      return fireAt(powerFromElapsed(event.now - state.startedAt));
    case "cancel":
      return { state: IDLE_GAUGE, fire: null };
  }
};
