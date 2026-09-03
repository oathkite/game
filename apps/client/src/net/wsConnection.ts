import type { ClientMessage, ServerMessage } from "@game/protocol";
import { createListeners, type Connection, type ConnectionStatus } from "./connection";

// WebSocket 1 本の接続。切れたら自動で張り直し、張り直した後の再入室は上位（OnlineFlow）が conn.resume で行う。

export const serverUrl = (): string => {
  const fromEnv = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (fromEnv) return fromEnv;
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/ws`;
};

export const createWsConnection = (url: string = serverUrl()): Connection => {
  const messages = createListeners<ServerMessage>();
  const statuses = createListeners<ConnectionStatus>();
  let status: ConnectionStatus = "connecting";
  let socket: WebSocket | null = null;
  let closed = false;
  let retry: number | null = null;

  const setStatus = (s: ConnectionStatus): void => {
    status = s;
    statuses.emit(s);
  };

  const connect = (): void => {
    if (closed) return;
    setStatus("connecting");
    const ws = new WebSocket(url);
    socket = ws;
    ws.onopen = () => setStatus("open");
    ws.onmessage = (ev) => {
      if (typeof ev.data !== "string") return;
      try {
        const parsed: unknown = JSON.parse(ev.data);
        // type を持つオブジェクトだけを通す。壊れたフレームは捨てる
        if (typeof parsed === "object" && parsed !== null && typeof (parsed as { type?: unknown }).type === "string") messages.emit(parsed as ServerMessage);
      } catch {
        // JSON でないフレームは捨てる
      }
    };
    ws.onclose = () => {
      socket = null;
      if (closed) return;
      setStatus("closed");
      retry = window.setTimeout(connect, 1500);
    };
    ws.onerror = () => ws.close();
  };

  connect();

  return {
    send: (message: ClientMessage) => {
      if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
    },
    subscribe: messages.add,
    onStatus: statuses.add,
    status: () => status,
    close: () => {
      closed = true;
      if (retry !== null) window.clearTimeout(retry);
      socket?.close();
      socket = null;
      setStatus("closed");
    },
  };
};
