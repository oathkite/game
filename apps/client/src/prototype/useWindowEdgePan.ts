import { useEffect, type RefObject } from "react";
import type { CameraRig } from "./cameraRig";

/** Extend field edge scrolling to the window edges across the HUD. */
export const useWindowEdgePan = (host: RefObject<HTMLDivElement | null>, rig: CameraRig, blocked: boolean) => {
  useEffect(() => {
    let active = false;
    const stop = () => { if (active) rig.stop(); active = false; };
    const move = (event: PointerEvent) => {
      const field = host.current;
      if (!field || blocked || event.pointerType !== "mouse" || event.buttons || field.dataset.opening === "true" || document.querySelector("dialog[open]")) { stop(); return; }
      if (event.target instanceof Node && field.contains(event.target)) { active = false; return; }
      const edge = 16;
      const x = event.clientX < edge ? 0 : event.clientX > innerWidth-edge ? rig.get().viewport.width : rig.get().viewport.width/2;
      const y = event.clientY < edge ? 0 : event.clientY > innerHeight-edge ? rig.get().viewport.height : rig.get().viewport.height/2;
      if (x === rig.get().viewport.width/2 && y === rig.get().viewport.height/2) { stop(); return; }
      active = true;
      rig.edge({x,y},performance.now());
    };
    const leave = (event: PointerEvent) => { if (!event.relatedTarget) stop(); };
    window.addEventListener("pointermove",move);
    window.addEventListener("pointerdown",stop);
    window.addEventListener("pointerout",leave);
    window.addEventListener("blur",stop);
    window.addEventListener("resize",stop);
    return () => {
      stop(); window.removeEventListener("pointermove",move); window.removeEventListener("pointerdown",stop);
      window.removeEventListener("pointerout",leave); window.removeEventListener("blur",stop); window.removeEventListener("resize",stop);
    };
  },[host,rig,blocked]);
};
