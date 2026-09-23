// 書き出す曲の一覧。名前は apps/client/src/app/musicTracks.ts の MusicName と一致させる。
import hangar from "./hangar.mjs";
import lobby from "./lobby.mjs";
import room from "./room.mjs";
import ridgeline from "./ridgeline.mjs";
import stoneBridge from "./stone-bridge.mjs";
import terraces from "./terraces.mjs";
import skyIslands from "./sky-islands.mjs";
import result from "./result.mjs";

export const TRACKS = [hangar, lobby, room, ridgeline, stoneBridge, terraces, skyIslands, result];
