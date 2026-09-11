import { readSmallJson } from "../rooms/readSmallJson.js";
import { quickRequestSchema, roomPageCursorSchema } from "@game/protocol/v2-rooms";
import { RoomObject, type RoomEnv } from "./v2Room.js";
import { RoomDirectory } from "./v2Directory.js";
export { RoomObject, RoomDirectory };
export default {
  async fetch(request: Request, env: RoomEnv): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") ?? (request.method === "GET" && request.headers.get("Sec-Fetch-Site") === "same-origin" ? url.origin : "");
    if (url.pathname === "/health") return Response.json({ status: "ok", protocol: 2 });
    if (!env.ALLOWED_ORIGINS.split(",").includes(origin)) return new Response("origin denied", { status: 403 });
    const headers = { "Access-Control-Allow-Origin": origin, "Vary": "Origin", "Cache-Control": "no-store" };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...headers, "Access-Control-Allow-Methods": "GET, POST", "Access-Control-Allow-Headers": "Content-Type" } });
    if (request.method === "POST" && ["/v2/rooms", "/v2/quick"].includes(url.pathname)) {
      const { success } = await env.ALLOCATION_LIMITER.limit({ key: request.headers.get("CF-Connecting-IP") ?? "local" });
      if (!success) return new Response("allocation rate limit", { status: 429, headers: { ...headers, "Retry-After": "60" } });
    }
    const directory = env.DIRECTORY.getByName("public");
    if (url.pathname === "/v2/rooms" && request.method === "POST") {
      const roomId = await directory.allocate();
      await env.ROOMS.getByName(roomId, { locationHint: "apac" }).initialize(roomId, "custom", "asia");
      return Response.json({ roomId }, { headers });
    }
    if (url.pathname === "/v2/quick" && request.method === "POST") {
      const input = quickRequestSchema.safeParse(await readSmallJson(request));
      if (!input.success) return new Response("invalid mode", { status: 400, headers });
      const { mode, region } = input.data, roomId = await directory.quick(mode, region);
      const locationHint = ({ asia: "apac", europe: "weur", americas: "enam" } as const)[region];
      await env.ROOMS.getByName(roomId, { locationHint }).initialize(roomId, mode, region);
      return Response.json({ roomId }, { headers });
    }
    if (url.pathname === "/v2/rooms/page" && request.method === "GET") {
      const after = roomPageCursorSchema.safeParse(url.searchParams.get("after") ?? "");
      if (!after.success) return new Response("invalid cursor", { status: 400, headers });
      return Response.json(await directory.page(after.data), { headers });
    }
    if (url.pathname === "/v2/rooms" && request.method === "GET") return Response.json(await directory.list(), { headers });
    const roomId = /^\/v2\/rooms\/([A-F0-9]{6})$/.exec(url.pathname)?.[1];
    if (!roomId || request.method !== "GET") return new Response("not found", { status: 404, headers });
    return env.ROOMS.getByName(roomId).fetch(request);
  },
};
