import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";
import { DirectoryOutbox } from "../src/cf/directoryOutbox.js";
const summary = { roomId: "ABCDEF", mode: "custom", region: "asia", members: 1, spectators: 0, phase: "waiting", mapId: "moss-valley" } as const;
it("retains failed work across reconstruction and acknowledges only the sent revision", async () => {
  const db = new DatabaseSync(":memory:");
  const adapter = {
    exec: <T extends Record<string, string | number | null>>(query: string, ...args: (string | number | null)[]) => {
      const result = db.prepare(query).all(...args) as T[];
      return { toArray: () => result };
    },
  };
  try {
    let box = new DirectoryOutbox(adapter);
    box.enqueue(summary, 1000);
    await expect(box.flush(1000, async () => { expect(box.deadline(1000)).toBe(6000); }, async () => { throw new Error("offline"); })).rejects.toThrow("offline");
    box = new DirectoryOutbox(adapter);
    expect(box.deadline(1000)).toBe(6000);
    let sent = 0;
    await box.flush(5999, async () => {}, async () => { sent++; });
    expect(sent).toBe(0);
    await box.flush(6000, async () => {}, async value => {
      expect(value.members).toBe(1);
      box.enqueue({ ...summary, members: 0 }, 6001);
      expect(box.deadline(6001)).toBe(11001);
    });
    expect(box.deadline(1000)).toBe(6001);
    await box.flush(6001, async () => {}, async value => { expect(value.members).toBe(0); });
    expect(box.deadline(1000)).toBeNull();
    box = new DirectoryOutbox(adapter);
    box.enqueue({ ...summary, members: 0 }, 7000);
    expect(box.deadline(1000)).toBeNull();
    box.enqueue({ ...summary, members: 0 }, 250000);
    expect(box.deadline(1000)).toBe(250000);
  } finally { db.close(); }
});
