import { mkdir, readdir, readFile, writeFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { disconnectRoom, tickRoom, type RoomState } from "./core.js";
import { restoreRoom, serializeRoom, type RoomSnapshot } from "./runtime.js";
/** Local restart testing; edge rooms use SQLite storage through the same snapshot contract. */
export const fileRoomStore = (directory: string) => {
  const save = async (snapshot: RoomSnapshot): Promise<void> => {
    const id = snapshot.state.roomId;
    if (!/^[A-F0-9]{6}$/.test(id)) throw new Error("invalid room id");
    await mkdir(directory, { recursive: true });
    const path = join(directory, `${id}.json`);
    if (!snapshot.state.sessions.length && !snapshot.state.reports.length) { await rm(path, { force: true }); return; }
    await writeFile(`${path}.tmp`, JSON.stringify(snapshot), { mode: 0o600 });
    await rename(`${path}.tmp`, path);
  };
  const load = async (now: number): Promise<readonly RoomState[]> => {
    await mkdir(directory, { recursive: true });
    const rooms: RoomState[] = [];
    for (const name of await readdir(directory)) {
      if (!/^[A-F0-9]{6}\.json$/.test(name)) continue;
      let state = restoreRoom(JSON.parse(await readFile(join(directory, name), "utf8")));
      if (state.roomId !== name.slice(0, 6)) throw new Error("room snapshot identity mismatch");
      for (const s of state.sessions) if (s.connectionId) state = disconnectRoom(state, s.connectionId, now);
      state = tickRoom(state, now);
      await save(serializeRoom(state));
      if (state.sessions.length || state.reports.length) rooms.push(state);
    }
    return rooms;
  };
  return { save, load };
};
