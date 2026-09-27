import { useEffect, useRef } from "react";
import { toRgba } from "@/game/pixelGrid";
import { paintTitleScene } from "@/game/titleScene";

// タイトル画面の背景の絵。設計書 40.10。画面の高さに合わせた整数の倍率で art px を拡大し、nearest で描く。
// 絵は大きさが変わったときだけ描き直す。

/** 1 art px の CSS px。縦 180 art px 前後、横 150 art px 以上になる整数。縦長の画面で機体が大きくなりすぎないようにする */
const scaleFor = (width: number, height: number): number => Math.max(2, Math.round(Math.min(height / 180, width / 150)));

export const TitleScene = () => {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let drawn = "";
    const draw = (): void => {
      const box = element.getBoundingClientRect(), scale = scaleFor(box.width || innerWidth, box.height || innerHeight);
      const width = Math.max(1, Math.ceil((box.width || innerWidth) / scale)), height = Math.max(1, Math.ceil((box.height || innerHeight) / scale));
      const key = `${width}x${height}`;
      if (key === drawn) return;
      drawn = key;
      element.width = width;
      element.height = height;
      const ctx = element.getContext("2d");
      if (!ctx) return;
      const image = ctx.createImageData(width, height);
      toRgba(paintTitleScene(width, height), image.data);
      ctx.putImageData(image, 0, 0);
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <canvas ref={canvas} className="title-scene" aria-hidden="true" />;
};
