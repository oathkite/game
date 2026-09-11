import { WebSocketServer } from "ws";
import { attachMovementLab } from "./movementWs.js";

// 本番入口からは読み込まない。ネットワーク試作専用のloopback listener。
const wss = new WebSocketServer({ host: "127.0.0.1", port: 8794, maxPayload: 4096,
  verifyClient: ({ origin }: { origin: string }) => ["http://127.0.0.1:5185", "http://localhost:5185", "http://127.0.0.1:5186", "http://localhost:5186"].includes(origin) });
const host = attachMovementLab(wss);
wss.on("listening", () => console.log("movement lab: ws://127.0.0.1:8794"));
const close = (): void => { host.close(); wss.close(); };
process.on("SIGTERM", close);
process.on("SIGINT", close);
