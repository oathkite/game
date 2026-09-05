import { useState } from "react";
import { GAUGE_BORDER, markerBottom, powerAtOffset, toggleMarker } from "./powerMarker";
import type { PowerGauge } from "./usePowerGauge";

// 右パネル。設計書 03 の 3.5。上端に設定のボタン、下端にパワーゲージと射撃ボタン。
// ゲージは射撃ボタンの上端からパネル上端までを 100 段に区切る。

type Props = {
  readonly width: number;
  readonly height: number;
  readonly enabled: boolean;
  readonly gauge: PowerGauge;
  /** 上端の設定ボタン。押すと設定メニュー（消音、左右の入れ替え、降参か退出）を開く */
  readonly onOpenOptions: () => void;
};

const OPTIONS_HEIGHT = 36;

export const RightPanel = ({ width, height, enabled, gauge, onOpenOptions }: Props) => {
  const [marker, setMarker] = useState<number | null>(null);
  // 幅に合わせて縦に伸ばすが、画面が低いときにゲージの取り分を食わないよう高さの 3 割で止める
  const fireHeight = Math.max(48, Math.min(Math.floor(width * 1.2), Math.floor(height * 0.3)));
  // 上端の設定ボタンとゲージ、射撃ボタンを縦に積む
  const gaugeHeight = Math.max(0, height - fireHeight - OPTIONS_HEIGHT - 24);
  // 枠線の内側の高さ。溜まった量も目安ラインもこの中に収める
  const inner = Math.max(0, gaugeHeight - GAUGE_BORDER * 2);
  const fill = Math.floor((gauge.value / 100) * inner);

  const press = (e: React.PointerEvent<HTMLDivElement>): void => {
    e.preventDefault();
    // 枠の内側で測る。getBoundingClientRect は枠線を含むので、上端を押しても 100 に届かなくなる
    const box = e.currentTarget;
    const top = box.getBoundingClientRect().top + box.clientTop;
    setMarker((current) => toggleMarker(current, powerAtOffset(e.clientY - top, box.clientHeight)));
  };

  return (
    <div className="panel" style={{ width, padding: 4, gap: 8 }}>
      <button type="button" className="options" style={{ height: OPTIONS_HEIGHT }} onClick={onOpenOptions} data-testid="options-open">
        設定
      </button>
      <div className="panel-bottom">
        <div
          className="gauge"
          style={{ height: gaugeHeight }}
          data-testid="power-gauge"
          data-power={gauge.value}
          data-marker={marker ?? ""}
          onPointerDown={press}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="gauge-fill" style={{ height: fill }} />
          {marker !== null && <div className="gauge-marker" style={{ bottom: Math.floor(markerBottom(marker, inner)) }} data-testid="power-marker" />}
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
          FIRE
        </button>
      </div>
    </div>
  );
};
