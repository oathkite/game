import { useEffect, useRef } from "react";
import type { Hold } from "./useHold";
import type { PowerGauge } from "./usePowerGauge";

// キーボード。設計書 03 の 3.3。keydown で開始、keyup で停止し、オートリピートの keydown は無視する。
// Tab はメインとサブの切り替え（設計書 10 の 10.3）、Escape は設定メニューの開閉。
// 設定メニューが開いている間は Escape だけを受け、Tab はフォーカス移動に任せる。
// listener は 1 回だけ登録し、最新の hold と gauge は ref で参照する。

export type Holds = {
  readonly up: Hold;
  readonly down: Hold;
  readonly left: Hold;
  readonly right: Hold;
};

export type KeyActions = {
  readonly toggleWeapon: () => void;
  readonly toggleOptions: () => void;
  /** 設定メニューが開いているか。開いている間は対戦の操作を受けない */
  readonly menuOpen: boolean;
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

export const useKeyboardInput = (holds: Holds, gauge: PowerGauge, actions: KeyActions): void => {
  const inputRef = useRef({ holds, gauge, actions });
  inputRef.current = { holds, gauge, actions };

  useEffect(() => {
    const down = (e: KeyboardEvent): void => {
      if (e.repeat) return;
      const { holds: h, gauge: g, actions: a } = inputRef.current;
      // Escape はどこにフォーカスがあっても受ける。メニューの部品にフォーカスしたまま閉じられるようにするため
      if (e.code === "Escape") {
        a.toggleOptions();
        e.preventDefault();
        return;
      }
      if (a.menuOpen || e.target instanceof HTMLInputElement) return;
      const hold = holdFor(h, e.code);
      if (hold) hold.start();
      else if (e.code === "Space") g.begin("key");
      else if (e.code === "Tab") a.toggleWeapon();
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
