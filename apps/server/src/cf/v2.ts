import { RoomObject, type RoomEnv } from "./v2Room.js";
import { RoomDirectory } from "./v2Directory.js";
export { RoomObject, RoomDirectory };
export default {
  async fetch(request: Request, env: RoomEnv): Promise<Response> {
    const url = new URL(request.url), origin = request.headers.get("Origin") ?? "";
    if (url.pathname === "/health") return Response.json({ status: "ok", protocol: 2 });
    if (!env.ALLOWED_ORIGINS.split(",").includes(origin)) return new Response("origin denied", { status: 403 });
    const headers = { "Access-Control-Allow-Origin": origin, "Vary": "Origin", "Cache-Control": "no-store" };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...headers, "Access-Control-Allow-Methods": "GET, POST", "Access-Control-Allow-Headers": "Content-Type" } });
    const directory = env.DIRECTORY.getByName("public");
    if (url.pathname === "/v2/rooms" && request.method === "POST") {
      const roomId = await directory.allocate();
      return Response.json({ roomId }, { headers });
    }
    if (url.pathname === "/v2/rooms" && request.method === "GET") return Response.json(await directory.list(), { headers });
    const roomId = /^\/v2\/rooms\/([A-F0-9]{6})$/.exec(url.pathname)?.[1];
    if (!roomId || request.method !== "GET") return new Response("not found", { status: 404, headers });
    if (!await directory.exists(roomId)) return new Response("room not found", { status: 404, headers });
    return env.ROOMS.getByName(roomId).fetch(request);
  },
};
