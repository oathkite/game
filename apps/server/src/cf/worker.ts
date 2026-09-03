import { DEFAULT_ENGINE_TIMING } from "@game/engine";
import { MAX_MESSAGE_BYTES, parseClientMessage } from "@game/protocol";
import { deserializeState, serializeState, type ServerStateJson } from "../persist.js";
import { handleCommand } from "../server.js";
import { createServerState, DEFAULT_SERVER_TIMING, type Command, type ConnId, type ServerState } from "../state.js";

// Cloudflare Workers + Durable Objects のアダプタ。
// Durable Object 1 つが全部屋を持ち、WebSocket Hibernation で接続を受け、wakeAt を alarm で起こす。
// 命令のたびに状態を storage へ保存し、退避から戻ったら復元する。

type Env = {
  readonly HUB: DurableObjectNamespace;
};

const STATE_KEY = "state";

const secureRng = (): number => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] ?? 0) / 4294967296;
};

const serverConfig = { ...DEFAULT_SERVER_TIMING, rng: secureRng };
const engineConfig = { ...DEFAULT_ENGINE_TIMING, rng: secureRng };

export class Hub implements DurableObject {
  private state: ServerState | null = null;
  private seq = 0;

  constructor(private readonly ctx: DurableObjectState) {}

  private async load(): Promise<ServerState> {
    if (this.state) return this.state;
    const json = await this.ctx.storage.get<ServerStateJson>(STATE_KEY);
    this.state = json ? deserializeState(json, serverConfig, engineConfig) : createServerState(serverConfig);
    this.seq = (await this.ctx.storage.get<number>("seq")) ?? 0;
    return this.state;
  }

  private async run(command: Command): Promise<void> {
    const state = await this.load();
    const result = handleCommand(state, command, Date.now());
    const sockets = new Map<ConnId, WebSocket>();
    for (const ws of this.ctx.getWebSockets()) {
      const tag = this.ctx.getTags(ws)[0];
      if (tag) sockets.set(tag, ws);
    }
    for (const e of result.effects) {
      const ws = sockets.get(e.connId);
      if (ws) ws.send(JSON.stringify(e.message));
    }
    await this.ctx.storage.put(STATE_KEY, serializeState(state));
    if (result.wakeAt === null) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(result.wakeAt);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return new Response("ok");
    if (request.headers.get("Upgrade") !== "websocket") return new Response("expected websocket", { status: 426 });
    await this.load();
    const connId = `c${++this.seq}`;
    await this.ctx.storage.put("seq", this.seq);
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server, [connId]);
    await this.run({ type: "open", connId });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    const connId = this.ctx.getTags(ws)[0];
    if (!connId) return;
    const raw = typeof data === "string" ? data : new TextDecoder().decode(data);
    if (raw.length > MAX_MESSAGE_BYTES) return;
    const parsed = parseClientMessage(raw);
    if (!parsed.ok) return;
    await this.run({ type: "message", connId, message: parsed.message });
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const connId = this.ctx.getTags(ws)[0];
    if (connId) await this.run({ type: "close", connId });
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  async alarm(): Promise<void> {
    await this.run({ type: "tick" });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return new Response("ok");
    // 全部屋を 1 つの Durable Object に載せる。この規模なら十分で、部屋またぎのロビー一覧も 1 箇所で済む
    const id = env.HUB.idFromName("hub");
    return env.HUB.get(id).fetch(request);
  },
};
