import type { TankColors, WeaponId } from "@game/protocol";
import { useEffect, useRef, useState } from "react";
import { computeLayout } from "@/game/scale";
import { rasterize } from "./previewRaster";
import { FIELD_COLS_MIN, demoFrame, fieldFor, prepareDemo, type DemoFrame, type Field } from "./weaponDemo";

// 設定画面の戦車プレビュー。設計書 08 の 8.2、09 の 9.2。
// 対戦と同じ倍率のマップの切れ端（黒地に白い地面）に戦車を置き、実際の大きさで見せる。
// 描画は対戦画面と同じく 1 セル 1 ピクセルのラスターを最近傍で整数倍に拡大する（設計書 07 の 7.1）。
// 武器で形は変えない（設計書 10 の 10.5）。武器を選ぶと、その武器を右へ 1 発撃つデモを流す。
// 着弾の爆風、削れた地形、破片は対戦の再生（設計書 03 の 3.9）と同じ段取りとセルの規則で描く。

/** 発射のデモ。key が変わるたびに撃ち直す */
export type WeaponDemo = { readonly weapon: WeaponId; readonly key: number };

type Props = {
  readonly colors: TankColors;
  readonly demo: WeaponDemo | null;
  readonly fill?: boolean;
};

/** 1 セルの px の下限。対戦の倍率が 1 px 台でも絵が読めるようにする */
const CELL_MIN = 2;

const EMPTY_FRAME: DemoFrame = { bullets: [], blasts: [], craters: [], debris: [], done: true };

type Geometry = { readonly cell: number; readonly field: Field; readonly height: number };

/** 対戦と同じ倍率（最も近い整数）と、置かれた要素の幅から切れ端の大きさを決める。幅が変わっても追従する */
const useGeometry = (ref: React.RefObject<HTMLDivElement | null>, fill: boolean): Geometry | null => {
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = (): void => {
      const cell = Math.max(CELL_MIN, Math.round(computeLayout(window.innerWidth, window.innerHeight).cell));
      const cols = fieldFor(el.clientWidth / cell).cols;
      const field = fieldFor(cols);
      const height = fill ? Math.max(1, el.clientHeight) : field.rows * cell;
      // 値が同じなら作り直さない。field が変わるとデモが最初からになるため
      setGeometry((prev) => (prev && prev.cell === cell && prev.field.cols === cols && prev.height === height ? prev : { cell, field, height }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ref, fill]);
  return geometry;
};

/** デモの経過に合わせてフレームを進める。終わったら止め、key が変わったら最初から */
const useDemoFrame = (demo: WeaponDemo | null, field: Field | null): DemoFrame => {
  const [frame, setFrame] = useState<DemoFrame>(EMPTY_FRAME);
  useEffect(() => {
    if (!demo || !field) return;
    const prepared = prepareDemo(demo.weapon, field);
    const startedAt = performance.now();
    let handle = 0;
    const tick = (now: number): void => {
      const next = demoFrame(prepared, (now - startedAt) / 1000);
      setFrame(next);
      if (!next.done) handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [demo, field]);
  return frame;
};

/** ラスターを 1 セル 1 ピクセルで作り、見える canvas へ最近傍で拡大して写す。source は 1 セル 1 ピクセルの作業用 canvas で、毎フレーム使い回す */
const paint = (canvas: HTMLCanvasElement, source: HTMLCanvasElement, geometry: Geometry, frame: DemoFrame, colors: TankColors): void => {
  const raster = rasterize(geometry.field, frame, colors);
  if (source.width !== raster.width) source.width = raster.width;
  if (source.height !== raster.height) source.height = raster.height;
  const sctx = source.getContext("2d");
  const ctx = canvas.getContext("2d");
  if (!sctx || !ctx) return;
  const image = sctx.createImageData(raster.width, raster.height);
  image.data.set(raster.data);
  sctx.putImageData(image, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const scale = Math.max(1, Math.min(geometry.cell, Math.floor(canvas.height / raster.height)));
  const width = raster.width * scale;
  const height = raster.height * scale;
  ctx.drawImage(source, Math.floor((canvas.width - width) / 2), canvas.height - height, width, height);
};

export const TankPreview = ({ colors, demo, fill = false }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<HTMLCanvasElement | null>(null);
  const geometry = useGeometry(ref, fill);
  const frame = useDemoFrame(demo, geometry?.field ?? null);
  const cell = geometry?.cell ?? CELL_MIN;
  const field = geometry?.field ?? fieldFor(FIELD_COLS_MIN);

  useEffect(() => {
    if (!canvasRef.current || !geometry) return;
    sourceRef.current ??= document.createElement("canvas");
    paint(canvasRef.current, sourceRef.current, geometry, frame, colors);
  }, [geometry, frame, colors]);

  return (
    <div ref={ref} className="preview-frame">
      <canvas
        ref={canvasRef}
        width={field.cols * cell}
        height={geometry?.height ?? field.rows * cell}
        data-testid="tank-preview"
        data-demo={demo?.weapon ?? ""}
      />
    </div>
  );
};
