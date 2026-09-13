import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";
import { RoomInvites } from "../src/cf/roomInvites.js";
it("persists an unguessable invitation and refuses unknown or expired tokens", () => {
  const db = new DatabaseSync(":memory:");
  const sql = { exec: <T extends Record<string, string | number | null>>(query: string, ...args: (string | number | null)[]) => {
    const result = db.prepare(query).all(...args) as T[]; return { toArray: () => result };
  } };
  try {
    let invites = new RoomInvites(sql); const first = invites.issue(1000);
    expect(first.token).toMatch(/^[a-f0-9-]{36}$/);
    invites = new RoomInvites(sql);
    expect(invites.issue(2000)).toEqual(first);
    expect(invites.valid(first.token, first.expiresAt - 1)).toBe(true);
    expect(invites.valid(first.token, first.expiresAt)).toBe(false);
    expect(invites.valid("00000000-0000-4000-8000-000000000000", 1000)).toBe(false);
    expect(invites.valid({}, 1000)).toBe(false);
    expect(invites.issue(first.expiresAt).token).not.toBe(first.token);
  } finally { db.close(); }
});
