import { expect, it } from "vitest";
import type { WebSocket } from "ws";
import { createLabSessions } from "../src/lab/sessions";
it("expires only disconnected players at 60 seconds and frees their seats only when requested", () => {
  let now = 1000; const sessions = createLabSessions(() => now);
  const a = {} as WebSocket, b = {} as WebSocket;
  const joined = sessions.join(a, ["p1"]); if ("error" in joined) throw new Error(joined.error);
  expect(sessions.join(b, ["p1"], joined.token)).toEqual({ error: "invalid-session" });
  sessions.disconnect(joined.session, a); now += 59999;
  expect(sessions.expiredPlayerIds()).toEqual([]);
  now += 1;
  expect(sessions.expiredPlayerIds()).toEqual(["p1"]);
  expect(sessions.join(b, ["p1"], joined.token)).toEqual({ error: "invalid-session" });
  expect(sessions.join(b, ["p1"])).toEqual({ error: "full" });
  sessions.releaseExpired();
  expect(sessions.join(b, ["p1"])).toHaveProperty("session.playerId", "p1");
});
it("resuming before expiry cancels the deadline and stale socket close cannot disconnect it", () => {
  let now = 1000; const sessions = createLabSessions(() => now);
  const a = {} as WebSocket, b = {} as WebSocket;
  const joined = sessions.join(a, ["p1"]); if ("error" in joined) throw new Error(joined.error);
  sessions.disconnect(joined.session, a); now += 59000;
  const resumed = sessions.join(b, ["p1"], joined.token); expect(resumed).toHaveProperty("session.socket", b);
  sessions.disconnect(joined.session, a); now += 61000;
  expect(sessions.expiredPlayerIds()).toEqual([]);
});
