import { useEffect, useRef } from "react";
import { worldArt } from "./assets";
// Visual-only particles. Wind is the same signed value displayed by the battle HUD.
export const WindLeaves = ({ wind = 2 }: { readonly wind?: number }) => {
  const ref = useRef<HTMLCanvasElement>(null), current = useRef(wind); current.current = wind;
  useEffect(() => {
    const canvas = ref.current, ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const image = new Image(); image.src = worldArt.leaf;
    const particles = Array.from({ length: 24 }, (_, i) => ({ x: (i * .618) % 1, y: (i * .381) % 1 }));
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0, last = performance.now();
    const draw = (now: number): void => {
      const width = canvas.clientWidth, height = canvas.clientHeight;
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      const dt = Math.min(50, now - last) / 1000; last = now;
      ctx.clearRect(0, 0, width, height); ctx.imageSmoothingEnabled = false;
      if (!reduced.matches && image.complete && image.naturalWidth) for (const [i, p] of particles.entries()) {
        p.x = (p.x + current.current * dt * .006 + 1) % 1;
        p.y = (p.y + dt * (.035 + i % 3 * .009)) % 1;
        ctx.drawImage(image, Math.round(p.x * width), Math.round(p.y * height), 12 + i % 3 * 3, 12 + i % 3 * 3);
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw); return () => cancelAnimationFrame(frame);
  }, []);
  return <canvas ref={ref} className="world-leaves" aria-hidden="true" data-testid="world-wind" data-wind={wind} />;
};
