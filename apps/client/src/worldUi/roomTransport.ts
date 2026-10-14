import type { CreateRoomOptions } from "@game/protocol/v2-rooms";
/** 部屋の割り当て（POST /v2/rooms、/v2/quick）が応答を返したうえで断ったことを表す。届かなかった失敗とは分ける。 */
export class RoomAllocationError extends Error {
  constructor(readonly status: number) { super(`room allocation failed: ${status}`); }
}
export const ROOM_UNREACHABLE_STATUS = "対戦サーバーに接続できません。";
export const INVALID_ROOM_SETTINGS_STATUS = "対戦の設定を受け付けられませんでした。設定を変えるか、再読み込みしてから再試行してください。";
export const ROOM_RATE_LIMIT_STATUS = "部屋の割り当てが続いたため、一時的に受け付けを止めています。しばらく待ってから再試行してください。";
/** resolveRoomUrl の失敗を部屋画面の status にする。400 と 429 のほかは、サーバーに届かなかったものとして扱う。 */
export const roomFailureStatus = (error: unknown): string => {
  if (!(error instanceof RoomAllocationError)) return ROOM_UNREACHABLE_STATUS;
  if (error.status === 400) return INVALID_ROOM_SETTINGS_STATUS;
  if (error.status === 429) return ROOM_RATE_LIMIT_STATUS;
  return ROOM_UNREACHABLE_STATUS;
};
const allocatedRoomId = async (response: Response): Promise<string | undefined> => {
  if (!response.ok) throw new RoomAllocationError(response.status);
  return (await response.json() as { roomId?: string }).roomId;
};
export const resolveRoomUrl = async (
  initial: { readonly options?: CreateRoomOptions; readonly type: string; readonly roomId?: string; readonly mode?: string; readonly region?: string }, base: string, savedRoomId: string | null, request: typeof fetch = fetch,
): Promise<string> => {
  const url = new URL(base);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("invalid room server");
  let roomId = initial.type === "room.resume" ? savedRoomId : initial.roomId;
  if (initial.type === "room.quick") {
    roomId = await allocatedRoomId(await request(new URL("/v2/quick", url).href, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: initial.mode, region: initial.region }) }));
  }
  if (initial.type === "room.create") {
    roomId = await allocatedRoomId(await request(new URL("/v2/rooms", url).href, { method: "POST", ...(initial.options ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(initial.options) } : {}) }));
  }
  if (!roomId || !/^[A-F0-9]{6}$/.test(roomId)) throw new Error("missing room");
  url.pathname = `/v2/rooms/${roomId}`; url.search = ""; url.hash = "";
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.href;
};
