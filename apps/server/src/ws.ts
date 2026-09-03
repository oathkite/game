import type { Clock } from "@game/engine";
import { parseClientMessage } from "@game/protocol";
import { WebSocketServer, type WebSocket } from "ws";
import { handleCommand } from "./server.js";
import type { Command, ConnId, ServerState } from "./state.js";

// WebSocket の薄いアダプタ。受信を Zod で検証して命令に変え、効果を各接続に送る。

const HEARTBEAT_MS = 15_000;

export type WsHost = {
  readonly wss: WebSocketServer;
  readonly close: () => void;
};

export const attachWebSocket = (state: ServerState, wss: WebSocketServer, clock: Clock, log: (line: string) => void = () => {}): WsHost => {
  const sockets = new Map<ConnId, WebSocket>();
  const alive = new Set<WebSocket>();
  let seq = 0;
  let cancelWake: (() => void) | null = null;
  let closed = false;

  const run = (command: Command): void => {
    if (closed) return;
    // 1 つの命令の失敗を他の接続や部屋に波及させない
    try {
      const result = handleCommand(state, command, clock.now());
      for (const e of result.effects) {
        const socket = sockets.get(e.connId);
        if (socket && socket.readyState === socket.OPEN) socket.send(JSON.stringify(e.message));
      }
      if (cancelWake) cancelWake();
      cancelWake = result.wakeAt === null ? null : clock.schedule(result.wakeAt, () => run({ type: "tick" }));
    } catch (e) {
      log(`命令の処理に失敗: ${command.type} ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // 半開きのソケットを検出する。応答のない接続は切り、close の経路に載せる
  const heartbeat = setInterval(() => {
    for (const s of sockets.values()) {
      if (!alive.has(s)) {
        s.terminate();
        continue;
      }
      alive.delete(s);
      s.ping();
    }
  }, HEARTBEAT_MS);

  wss.on("connection", (socket) => {
    const connId = `c${++seq}`;
    sockets.set(connId, socket);
    alive.add(socket);
    socket.on("pong", () => alive.add(socket));
    run({ type: "open", connId });
    socket.on("message", (data) => {
      const parsed = parseClientMessage(typeof data === "string" ? data : data.toString());
      // 検証に失敗したメッセージは捨てる
      if (!parsed.ok) {
        log(`${connId} 不正なメッセージ: ${parsed.error.slice(0, 120)}`);
        return;
      }
      run({ type: "message", connId, message: parsed.message });
    });
    socket.on("close", () => {
      sockets.delete(connId);
      alive.delete(socket);
      run({ type: "close", connId });
    });
    socket.on("error", () => {
      socket.close();
    });
  });

  return {
    wss,
    close: () => {
      closed = true;
      clearInterval(heartbeat);
      if (cancelWake) cancelWake();
      cancelWake = null;
      for (const s of sockets.values()) s.close();
      wss.close();
    },
  };
};
