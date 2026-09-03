import type { ClientMessage, ServerMessage, TankColors } from "@game/protocol";
import { handleCommand } from "../src/server.js";
import { createServerState, DEFAULT_SERVER_TIMING, type Outgoing, type ServerState } from "../src/state.js";

// サーバーのテスト補助。時計は数値、乱数は固定列。

export type Harness = {
  readonly state: ServerState;
  readonly open: (connId: string) => void;
  readonly send: (connId: string, message: ClientMessage) => readonly Outgoing[];
  readonly close: (connId: string) => readonly Outgoing[];
  readonly tick: () => readonly Outgoing[];
  readonly at: (t: number) => void;
  readonly now: () => number;
  /** これまでに接続へ送られた全メッセージ */
  readonly inbox: (connId: string) => readonly ServerMessage[];
  readonly lastWakeAt: () => number | null;
};

export const T0 = 1_000_000;

/** 0.5 固定なら風は変わらず、先攻は席 0、左右の入れ替えなし */
export const harness = (rng: () => number = () => 0.5): Harness => {
  const state = createServerState({ ...DEFAULT_SERVER_TIMING, rng });
  let now = T0;
  let wakeAt: number | null = null;
  const mail = new Map<string, ServerMessage[]>();
  const record = (effects: readonly Outgoing[]): readonly Outgoing[] => {
    for (const e of effects) {
      const list = mail.get(e.connId) ?? [];
      list.push(e.message);
      mail.set(e.connId, list);
    }
    return effects;
  };
  const run = (command: Parameters<typeof handleCommand>[1]): readonly Outgoing[] => {
    const r = handleCommand(state, command, now);
    wakeAt = r.wakeAt;
    return record(r.effects);
  };
  return {
    state,
    open: (connId) => {
      run({ type: "open", connId });
    },
    send: (connId, message) => run({ type: "message", connId, message }),
    close: (connId) => run({ type: "close", connId }),
    tick: () => run({ type: "tick" }),
    at: (t) => {
      now = t;
    },
    now: () => now,
    inbox: (connId) => mail.get(connId) ?? [],
    lastWakeAt: () => wakeAt,
  };
};

/** 呼ぶたびに変わる乱数。複数の部屋を作るテストで入室コードを重ねないために使う */
export const sequenceRng = (): (() => number) => {
  let i = 0;
  return () => {
    i = (i * 1103515245 + 12345 + 7919) % 2147483648;
    return (i % 1000) / 1000;
  };
};

export const RED: TankColors = { primary: "red", secondary: "red" };
export const BLUE: TankColors = { primary: "blue", secondary: "blue" };

export const createMsg = (nickname: string, colors: TankColors, over: Partial<Extract<ClientMessage, { type: "room.create" }>> = {}): ClientMessage => ({
  type: "room.create",
  playerId: `player-${nickname}`,
  nickname,
  colors,
  title: `${nickname} room`,
  isPublic: true,
  mapName: "valley",
  ...over,
});

export const joinMsg = (code: string, nickname: string, colors: TankColors): ClientMessage => ({
  type: "room.join",
  code,
  playerId: `player-${nickname}`,
  nickname,
  colors,
});

export const types = (messages: readonly ServerMessage[]): string[] => messages.map((m) => m.type);

export const last = <T extends ServerMessage["type"]>(messages: readonly ServerMessage[], type: T): Extract<ServerMessage, { type: T }> | undefined =>
  [...messages].reverse().find((m): m is Extract<ServerMessage, { type: T }> => m.type === type);

/** 2 人が部屋に入り、b が ready、a が開始し、両者が読み込みを終えた状態 */
export const startedMatch = (h: Harness): { code: string; tokenA: string; tokenB: string } => {
  h.open("a");
  h.open("b");
  h.send("a", createMsg("alice", RED));
  const joinedA = last(h.inbox("a"), "room.joined");
  const code = joinedA?.code ?? "";
  h.send("b", joinMsg(code, "bob", BLUE));
  const joinedB = last(h.inbox("b"), "room.joined");
  h.send("b", { type: "room.ready", ready: true });
  h.send("a", { type: "room.start" });
  h.send("a", { type: "match.ready" });
  h.send("b", { type: "match.ready" });
  return { code, tokenA: joinedA?.token ?? "", tokenB: joinedB?.token ?? "" };
};
