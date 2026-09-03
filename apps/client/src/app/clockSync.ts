import type { Connection } from "@/net/connection";

// 設計書 05 の 5.6。接続直後に往復時間を数回測り、サーバー時刻との差の中央値を取る。

const SAMPLES = 5;

export type ClockSync = {
  /** サーバー時刻 − クライアント時刻（ms） */
  readonly offset: number;
};

export const measureClockOffset = (connection: Connection, timeoutMs = 3000): Promise<ClockSync> =>
  new Promise((resolve) => {
    const offsets: number[] = [];
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      unsubscribe();
      const sorted = [...offsets].sort((a, b) => a - b);
      const mid = sorted[Math.floor(sorted.length / 2)] ?? 0;
      resolve({ offset: mid });
    };
    const unsubscribe = connection.subscribe((m) => {
      if (m.type !== "time.pong") return;
      const now = Date.now();
      const rtt = now - m.sentAt;
      offsets.push(m.serverTime + rtt / 2 - now);
      if (offsets.length >= SAMPLES) finish();
      else connection.send({ type: "time.ping", sentAt: Date.now() });
    });
    connection.send({ type: "time.ping", sentAt: Date.now() });
    window.setTimeout(finish, timeoutMs);
  });
