import { useEffect, useRef } from "react";
import { Application } from "pixi.js";
import { loadSpriteTanks } from "@/prototype/spriteTank";
export const TankPortrait = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false, cleanup = () => {};
    const start = async () => {
      const art = await loadSpriteTanks(), app = new Application();
      await app.init({ width: 320, height: 220, backgroundAlpha: 0, antialias: false });
      const tank = art.create({ primary: "yellow", secondary: "red" }, "");
      tank.world.scale.set(15); app.stage.addChild(tank.world);
      tank.setPose({ x: 10, y: 13, tilt: 0, facing: 1, elevation: 10, hp: 100, visible: true, aiming: false, flash: false }, 1);
      tank.world.position.set(160, 190);
      cleanup = () => { tank.destroy(); app.destroy(true, { children: true }); art.destroy(); };
      if (disposed) { cleanup(); return; }
      ref.current?.appendChild(app.canvas);
      if (ref.current) ref.current.dataset.loaded = "true";
    };
    void start().catch(console.error);
    return () => { disposed = true; cleanup(); };
  }, []);
  return <div ref={ref} className="tank-portrait" role="img" aria-label="カエルのパイロットと黄色いケロポッド" />;
};
