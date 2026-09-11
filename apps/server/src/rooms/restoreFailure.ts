import { restoreRoom } from "./runtime.js";
export class UnrecoverableRoom extends Error {
  constructor() { super("room-unrecoverable"); }
}
/** Do not expose the snapshot or parser error, which may contain session secrets. */
export const restoreStoredRoom = (snapshot: string) => {
  try { return restoreRoom(JSON.parse(snapshot)); }
  catch { throw new UnrecoverableRoom(); }
};
