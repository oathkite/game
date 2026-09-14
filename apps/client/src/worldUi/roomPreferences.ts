import { MULTIPLAYER_MAPS } from "@game/maps";

type RoomPreferences = { name: string; mapId: string; turnLimit: number };
const key = "game.room-preferences";
const defaults: RoomPreferences = { name: "", mapId: MULTIPLAYER_MAPS[0]!.id, turnLimit: 12 };

export const readRoomPreferences = (): RoomPreferences => {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? "null");
    return {
      name: typeof saved?.name === "string" ? saved.name.slice(0, 32) : defaults.name,
      mapId: saved?.mapId === "random" || MULTIPLAYER_MAPS.some(map => map.id === saved?.mapId) ? saved.mapId : defaults.mapId,
      turnLimit: [12, 24, 36, 0].includes(saved?.turnLimit) ? saved.turnLimit : defaults.turnLimit,
    };
  } catch { return { ...defaults }; }
};

export const saveRoomPreferences = ({ name, mapId, turnLimit }: RoomPreferences): void => {
  try { localStorage.setItem(key, JSON.stringify({ name, mapId, turnLimit })); } catch { /* Storage may be disabled. */ }
};
