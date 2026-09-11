import { useEffect, useState } from "react";

// Browsers expose pointer capabilities, not physical keyboard attachment.
export const useTouchControls = (): boolean => {
  const [touch, setTouch] = useState(() => matchMedia("(pointer: coarse)").matches);
  useEffect(() => {
    const media = matchMedia("(pointer: coarse)");
    const changed = () => setTouch(media.matches);
    const keyboard = (event: KeyboardEvent) => { if (event.isTrusted && ["Tab", "KeyQ", "KeyE", "KeyA", "KeyD", "KeyW", "KeyS", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(event.code)) setTouch(false); };
    media.addEventListener("change", changed); window.addEventListener("keydown", keyboard);
    return () => { media.removeEventListener("change", changed); window.removeEventListener("keydown", keyboard); };
  }, []);
  return touch;
};
