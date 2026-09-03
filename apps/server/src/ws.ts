import type { Clock } from "@game/engine";
import { parseClientMessage } from "@game/protocol";
import { WebSocketServer, type WebSocket } from "ws";
import { handleCommand } from "./server.js";
import type { Command, ConnId, ServerState } from "./state.js";

// WebSocket の薄いアダプタ。受信を Zod で検証して命令に変え、効果を各接続に送る。

export type WsHost = {
  readonly wss: WebSocketServer;
  readonly close: () => void;
};

export const attachWebSocket = (state: ServerState, wss: WebSocketServer, clock: Clock, log: (line: string) => void = () => {}): WsHost => {
  const sockets = new Map<ConnId, WebSocket>();
  let seq = 0;
  let cancelWake: (() => void) | null = null;

  const run = (command: Command): void => {
    const result = handleCommand(state, command, clock.now());
    for (const e of result.effects) {
      const socket = sockets.get(e.connId);
      if (socket && socket.readyState === socket.OPEN) socket.send(JSON.stringify(e.message));
    }
    if (cancelWake) cancelWake();
    cancelWake = result.wakeAt === null ? null : clock.schedule(result.wakeAt, () => run({ type: "tick" }));
  };

  wss.on("connection", (socket) => {
    const connId = `c${++seq}`;
    sockets.set(connId, socket);
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
      run({ type: "close", connId });
    });
    socket.on("error", () => {
      socket.close();
    });
  });

  return {
    wss,
    close: () => {
      if (cancelWake) cancelWake();
      for (const s of sockets.values()) s.close();
      wss.close();
    },
  };
};
