import { MAP_CHOICE_LABELS, MAP_CHOICES, RANDOM_MAP, type MapChoice, type MapName } from "@game/protocol";
import { useEffect, useRef, useState } from "react";
import { mapThumbnail, THUMB_HEIGHT, THUMB_WIDTH } from "./mapThumbnail";

// マップの選択。設計書 09 の 9.4、9.5。
// 今の選択をサムネイルと名前で見せるボタンを押すと、9 枚（ランダムと 8 枚）のサムネイルを並べたモーダルが開く。
// 描画はマップ画面と同じく黒地に白い地面で、1 点 1 ピクセルの絵を最近傍で拡大する。

type ThumbnailProps = { readonly choice: MapChoice };

/** 1 枚のサムネイル。ランダムは「?」 */
export const MapThumbnail = ({ choice }: ThumbnailProps) =>
  choice === RANDOM_MAP ? <div className="map-thumb map-thumb-random">?</div> : <MapCanvas name={choice} />;

const MapCanvas = ({ name }: { readonly name: MapName }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const cells = mapThumbnail(name);
    const image = ctx.createImageData(THUMB_WIDTH, THUMB_HEIGHT);
    for (let i = 0; i < cells.length; i++) {
      const v = cells[i] === 1 ? 255 : 0;
      image.data.set([v, v, v, 255], i * 4);
    }
    ctx.putImageData(image, 0, 0);
  }, [name]);
  return <canvas ref={ref} className="map-thumb" width={THUMB_WIDTH} height={THUMB_HEIGHT} aria-hidden="true" />;
};

type PickerProps = {
  readonly value: MapChoice;
  readonly onChange: (choice: MapChoice) => void;
  /** ボタンの aria-label。画面ごとに変えて e2e で区別する */
  readonly label: string;
};

/** 今の選択を見せるボタン。押すとモーダルが開く。閉じたらフォーカスをこのボタンへ戻す */
export const MapPicker = ({ value, onChange, label }: PickerProps) => {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const close = (): void => {
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <>
      <button ref={trigger} type="button" className="map-pick" aria-label={label} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <MapThumbnail choice={value} />
        <span>{MAP_CHOICE_LABELS[value]}</span>
      </button>
      {open && (
        <MapPickerModal
          value={value}
          onPick={(choice) => {
            onChange(choice);
            close();
          }}
          onClose={close}
        />
      )}
    </>
  );
};

/** 選べないときの表示。部屋のオーナー以外に見せる */
export const MapDisplay = ({ value }: { readonly value: MapChoice }) => (
  <div className="map-pick" data-testid="map-display">
    <MapThumbnail choice={value} />
    <span>{MAP_CHOICE_LABELS[value]}</span>
  </div>
);

type ModalProps = {
  readonly value: MapChoice;
  readonly onPick: (choice: MapChoice) => void;
  readonly onClose: () => void;
};

/** Escape で閉じる。対戦画面の設定と同じ鍵にする（useKeyboardInput） */
const useEscape = (onClose: () => void): void => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
};

const MapPickerModal = ({ value, onPick, onClose }: ModalProps) => {
  useEscape(onClose);
  const first = useRef<HTMLButtonElement | null>(null);
  useEffect(() => first.current?.focus(), []);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="box column map-modal" role="dialog" aria-modal="true" aria-label="map picker" data-testid="map-picker" onClick={(e) => e.stopPropagation()}>
        <div className="label">マップを選ぶ</div>
        <div className="map-grid">
          {MAP_CHOICES.map((choice) => (
            <button
              key={choice}
              ref={choice === value ? first : undefined}
              type="button"
              className={`map-tile${choice === value ? " active" : ""}`}
              aria-pressed={choice === value}
              onClick={() => onPick(choice)}
            >
              <MapThumbnail choice={choice} />
              <span>{MAP_CHOICE_LABELS[choice]}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose}>
          戻る
        </button>
      </div>
    </div>
  );
};
