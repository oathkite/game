import type { PowerGauge } from "./usePowerGauge";

// 右パネル。設計書 03 の 3.5。パワーゲージ（数値と文字なし）と射撃ボタン。
// ゲージは射撃ボタンの上端からパネル上端までを 100 段に区切る。

type Props = {
  readonly width: number;
  readonly height: number;
  readonly enabled: boolean;
  readonly gauge: PowerGauge;
};

export const RightPanel = ({ width, height, enabled, gauge }: Props) => {
  const fireHeight = Math.max(48, Math.floor(width * 1.2));
  const gaugeHeight = Math.max(0, height - fireHeight - 16);
  const step = gaugeHeight / 100;
  const fill = Math.floor(gauge.value * step);

  return (
    <div className="panel" style={{ width, padding: 4, gap: 8 }}>
      <div className="gauge" style={{ height: gaugeHeight }} data-testid="power-gauge" data-power={gauge.value}>
        <div className="gauge-fill" style={{ height: fill }} />
      </div>
      <button
        type="button"
        className={`fire${gauge.charging ? " held" : ""}`}
        style={{ height: fireHeight }}
        disabled={!enabled}
        aria-label="fire"
        data-testid="fire"
        onPointerDown={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          gauge.begin("pointer");
        }}
        onPointerUp={() => gauge.release("pointer")}
        onPointerCancel={() => gauge.cancel()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <svg width={24} height={24} viewBox="0 0 24 24" shapeRendering="crispEdges">
          <rect x={8} y={8} width={8} height={8} fill="currentColor" />
        </svg>
      </button>
    </div>
  );
};
