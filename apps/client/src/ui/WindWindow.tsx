import { useEffect, useRef } from "react";

// 風の小窓。設計書 08 の 8.5。葉のドットが降り落ちながら風に流される。
// 横 20 セル、縦 10 セル。落下 3 + 0.3 × |風| セル/秒、横 1 セル/秒 × 風。乱数で揺らさない。

const W = 20;
const H = 10;
const LEAVES = 5;

type Leaf = { x: number; y: number; phase: number };

type Props = {
  readonly wind: number;
  readonly cell: number;
};

export const WindWindow = ({ wind, cell }: Props) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const windRef = useRef(wind);
  windRef.current = wind;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const leaves: Leaf[] = Array.from({ length: LEAVES }, (_, i) => ({
      x: Math.random() * W,
      y: (i / LEAVES) * H,
      phase: Math.random() * Math.PI * 2,
    }));
    let last = performance.now();
    let raf = 0;
    const frame = (now: number): void => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const w = windRef.current;
      const fall = 3 + 0.3 * Math.abs(w);
      const drift = w;
      for (const leaf of leaves) {
        leaf.y += fall * dt;
        leaf.x += drift * dt;
        leaf.phase += dt * 4;
        if (leaf.y >= H) {
          leaf.y -= H;
          leaf.x = Math.random() * W;
        }
        if (leaf.x < 0) leaf.x += W;
        if (leaf.x >= W) leaf.x -= W;
      }
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#33FF66";
      for (const leaf of leaves) {
        // 左右の小さな揺れは見た目のためで、風の値とは無関係
        const wobble = Math.round(Math.sin(leaf.phase) * 0.5);
        const x = Math.floor(leaf.x) + wobble;
        const y = Math.floor(leaf.y);
        ctx.fillRect(((x + W) % W) * cell, y * cell, cell, cell);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [cell]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <canvas
        ref={ref}
        width={W * cell}
        height={H * cell}
        style={{ border: `${Math.max(1, Math.floor(cell / 2))}px solid var(--ui-dim)`, imageRendering: "pixelated", display: "block" }}
      />
      <span style={{ fontSize: 16, color: "var(--ui-dim)" }}>WIND</span>
    </div>
  );
};
