import { multiplayerMap } from "@game/maps";
import { RANDOM_MAP } from "@game/protocol";

/** 部屋を作るときに選べるマップか。ランダムは開始のたびに抽選する（設計書 9） */
export const roomMapChoiceAllowed = (mapId: string): boolean => mapId === RANDOM_MAP || multiplayerMap(mapId) !== undefined;
