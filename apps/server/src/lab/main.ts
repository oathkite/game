import { WebSocketServer } from "ws";
import { attachMovementLab } from "./movementWs.js";

// 本番入口からは読み込まない。ネットワーク試作専用のloopback listener。
const wss = new WebSocketServer({ host: "127.0.0.1", port: 8794, maxPayload: 4096,
  verifyClient: ({ origin }: { origin: string }) => origin === "http://127.0.0.1:5185" || origin === "http://localhost:5185" });
const host = attachMovementLab(wss);
wss.on("listening", () => console.log("movement lab: ws://127.0.0.1:8794"));
const close = (): void => { host.close(); wss.close(); };
process.on("SIGTERM", close);
process.on("SIGINT", close);
