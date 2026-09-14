import type { ClientMessage, ServerMessage } from "@game/protocol";

// サーバーとの接続の抽象。WebSocket と、ブラウザ内でエンジンを動かす solo モードが同じ形を持つ。

export type ConnectionStatus = "connecting" | "open" | "closed";

export type Connection = {
  readonly reportMoveCost?: (steps: number) => void;
  /** Local practice reports a walking ring-out without firing a shot. */
  readonly reportMoveRingOut?: (x: number) => void;
  readonly send: (message: ClientMessage) => void;
  readonly subscribe: (listener: (message: ServerMessage) => void) => () => void;
  readonly onStatus: (listener: (status: ConnectionStatus) => void) => () => void;
  readonly status: () => ConnectionStatus;
  readonly close: () => void;
};

export type Listeners<T> = {
  readonly add: (fn: (v: T) => void) => () => void;
  readonly emit: (v: T) => void;
};

export const createListeners = <T>(): Listeners<T> => {
  const set = new Set<(v: T) => void>();
  return {
    add: (fn) => {
      set.add(fn);
      return () => set.delete(fn);
    },
    emit: (v) => {
      for (const fn of [...set]) fn(v);
    },
  };
};
