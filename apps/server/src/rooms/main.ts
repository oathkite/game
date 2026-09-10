import { WebSocketServer } from "ws";
import { fileRoomStore } from "./fileStore.js";
import { attachRooms } from "./gateway.js";
const store = fileRoomStore(process.env.ROOM_STORE_DIR ?? ".keropod/rooms");
const initial = await store.load(Date.now());
const wss = new WebSocketServer({ host: "127.0.0.1", port: 8795, maxPayload: 4096,
  verifyClient: ({ origin }: { origin: string }) => ["http://127.0.0.1:5186", "http://localhost:5186"].includes(origin) });
const rooms = attachRooms(wss, { initial, save: store.save });
wss.on("listening", () => console.log("rooms: ws://127.0.0.1:8795"));
const close = () => { rooms.close(); wss.close(); };
process.on("SIGINT", close); process.on("SIGTERM", close);
