import { realClock } from "@game/engine";
import { randomInt } from "node:crypto";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { MAX_MESSAGE_BYTES } from "@game/protocol";
import { createServerState, DEFAULT_SERVER_TIMING } from "./state.js";
import { attachWebSocket } from "./ws.js";

// ゲームサーバーの入口。HTTP は生存確認だけ、対戦は WebSocket 1 本で行う。

const port = Number(process.env.PORT ?? 8787);

const http = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }
  res.writeHead(404);
  res.end();
});

// 接続トークンは席の証明になるので、暗号論的な乱数から引く
const secureRng = (): number => randomInt(0, 2 ** 31) / 2 ** 31;

const state = createServerState({ ...DEFAULT_SERVER_TIMING, rng: secureRng });
const wss = new WebSocketServer({ server: http, maxPayload: MAX_MESSAGE_BYTES });
attachWebSocket(state, wss, realClock, (line) => console.log(line));

http.listen(port, () => {
  console.log(`server listening on :${port}`);
});
