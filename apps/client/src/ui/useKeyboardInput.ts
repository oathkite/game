import { useEffect, useRef } from "react";
import type { Hold } from "./useHold";
import type { PowerGauge } from "./usePowerGauge";

// キーボード。設計書 03 の 3.3。keydown で開始、keyup で停止し、オートリピートの keydown は無視する。
// listener は 1 回だけ登録し、最新の hold と gauge は ref で参照する。

export type Holds = {
  readonly up: Hold;
  readonly down: Hold;
  readonly left: Hold;
  readonly right: Hold;
};

const holdFor = (holds: Holds, code: string): Hold | null => {
  switch (code) {
    case "ArrowUp":
      return holds.up;
    case "ArrowDown":
      return holds.down;
    case "ArrowLeft":
      return holds.left;
    case "ArrowRight":
      return holds.right;
    default:
      return null;
  }
};

export const useKeyboardInput = (holds: Holds, gauge: PowerGauge): void => {
  const inputRef = useRef({ holds, gauge });
  inputRef.current = { holds, gauge };

  useEffect(() => {
    const down = (e: KeyboardEvent): void => {
      if (e.repeat || e.target instanceof HTMLInputElement) return;
      const { holds: h, gauge: g } = inputRef.current;
      const hold = holdFor(h, e.code);
      if (hold) hold.start();
      else if (e.code === "Space") g.begin("key");
      else return;
      e.preventDefault();
    };
    const up = (e: KeyboardEvent): void => {
      const { holds: h, gauge: g } = inputRef.current;
      const hold = holdFor(h, e.code);
      if (hold) hold.stop();
      else if (e.code === "Space") g.release("key");
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);
};
