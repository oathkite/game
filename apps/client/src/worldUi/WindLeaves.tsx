import { useEffect, useRef } from "react";
// Background-only pixel flecks indicate the simulation wind.
export const WindLeaves = ({ wind = 2 }: { readonly wind?: number }) => {
  const ref = useRef<HTMLCanvasElement>(null), current = useRef(wind); current.current = wind;
  useEffect(() => {
    const canvas = ref.current, ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const particles = Array.from({ length: 24 }, (_, i) => ({ x: (i * .618) % 1, y: (i * .381) % 1 }));
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0, last = performance.now();
    const draw = (now: number): void => {
      const width = canvas.clientWidth, height = canvas.clientHeight;
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      const dt = Math.min(50, now - last) / 1000; last = now;
      ctx.clearRect(0, 0, width, height); ctx.imageSmoothingEnabled = false;
      if (!reduced.matches) for (const [i, p] of particles.entries()) {
        p.x = (p.x + current.current * dt * 9 / Math.max(1,width) + 1) % 1;
        p.y = (p.y + dt * (22 + i % 3 * 6) / Math.max(1,height)) % 1;
        ctx.fillStyle = i % 3 === 0 ? "#53a877" : "#2b6944";
        ctx.fillRect(Math.round(p.x * width / 2) * 2, Math.round(p.y * height / 2) * 2, i % 3 === 0 ? 4 : 2, 2);
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw); return () => cancelAnimationFrame(frame);
  }, []);
  return <canvas ref={ref} className="world-leaves" aria-hidden="true" data-testid="world-wind" data-wind={wind} />;
};
