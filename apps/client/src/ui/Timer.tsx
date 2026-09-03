import { useEffect, useRef, useState } from "react";
import { playSound } from "@/app/audio";

// 残り時間。設計書 03 の 3.7。サーバー時刻の期限をクライアントの時計に変換して減らす。
// 残り 5 秒からは明滅し、手番側にだけ 1 秒ごとに電子音を鳴らす。

type Props = {
  /** サーバー時刻の期限 */
  readonly deadlineAt: number | null;
  /** サーバー時刻 − クライアント時刻 */
  readonly clockOffset: number;
  readonly myTurn: boolean;
};

export const Timer = ({ deadlineAt, clockOffset, myTurn }: Props) => {
  const [seconds, setSeconds] = useState<number | null>(null);
  const lastBeep = useRef<number | null>(null);

  useEffect(() => {
    if (deadlineAt === null) {
      setSeconds(null);
      lastBeep.current = null;
      return;
    }
    const tick = (): void => {
      const remainMs = deadlineAt - (Date.now() + clockOffset);
      const s = Math.max(0, Math.ceil(remainMs / 1000));
      setSeconds(s);
      if (myTurn && s <= 5 && s > 0 && lastBeep.current !== s) {
        lastBeep.current = s;
        playSound("tick");
      }
    };
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [deadlineAt, clockOffset, myTurn]);

  if (seconds === null) return null;
  return <div className={`timer${seconds <= 5 ? " blink" : ""}`}>{seconds}</div>;
};
